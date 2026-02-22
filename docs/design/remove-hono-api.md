# 設計書: Hono API レイヤー削除 → Server Action + 直接関数呼び出しへの統一

**作成日**: 2026-02-22  
**ステータス**: Draft

---

## 背景・課題

現在の実装では `src/app/api/[[...route]]/` 配下に Hono を使った HTTP API エンドポイントを定義しているが、実際の呼び出し実態を調査したところ **HTTP エンドポイントは実質的に使われていない**ことが判明した。

### 現状の呼び出し実態

| 関数 | Hono エンドポイント | 実際の呼ばれ方 |
|---|---|---|
| `startQuizSession()` | `POST /api/quiz/session` | Server Action `startSessionFormAction` が直接インポート |
| `startQuizSession()` | `POST /api/quiz/session` | Server Action `continueSessionFormAction` → `continueSessionQuery` → `honoRpcClient` → **HTTP経由（迂回中）** |
| `submitQuizAnswer()` | `POST /api/quiz/answer` | Server Action `submitQuizAnswerAction` が直接インポート |
| `getDueReviewCount()` | ー | Server Component `learn/page.tsx` が直接インポート |
| `getReviewQueue()` | ー | Server Component `review-queue/page.tsx` が直接インポート |

`continueSessionFormAction` だけが `honoRpcClient`（相対URL `/api`）経由で HTTP リクエストを送っており、他はすべて直接インポートで呼んでいる。

### 問題点

1. **Cloudflare Workers での自己 HTTP fetch が不安定** — 過去に `submitQuizAnswer` で同様の Invalid URL バグを踏んで直接呼び出しに切り替えた。`continueSessionFormAction` にも同じ問題が潜在する
2. **型の二重管理** — `lib/honoRpcClient.ts` に手動型定義 `HonoRpcClient` があり、`quiz.ts` 本体の型と乖離しやすい（現状すでに `history` エンドポイント定義が残骸化している）
3. **不要なバンドルサイズ** — Hono 本体・`@hono/zod-validator`・SWR などが残る
4. **外部クライアントが存在しない** — モバイルアプリ・サードパーティからの HTTP アクセスは現在も将来も予定がない

---

## 解決方針

Hono の HTTP ルーティングレイヤーを完全に削除し、ビジネスロジック関数は **Next.js Server Action または Server Component から直接呼び出す**構成に統一する。

```
変更前:
  Client → SWR / honoRpcClient → HTTP /api/* → Hono → ビジネスロジック関数

変更後:
  Client → Server Action → ビジネスロジック関数
  Server Component → ビジネスロジック関数（直接）
```

---

## ファイル変更一覧

### 削除するファイル

| ファイル | 理由 |
|---|---|
| `src/app/api/[[...route]]/app.ts` | Hono アプリ定義。不要 |
| `src/app/api/[[...route]]/route.ts` | Next.js Route Handler（Hono をアダプタ経由で呼ぶ）。不要 |
| `src/app/api/[[...route]]/errors.ts` | `ApiError` は移動先で再定義するため削除 |
| `src/lib/honoRpcClient.ts` | HTTP クライアント。不要 |
| `src/lib/swr.ts` | `rpcJson` ヘルパー。HTTP クライアントと合わせて不要 |

### 移動・改名するファイル

本プロジェクトは package-by-feature を採用しているため、ビジネスロジックは各 feature ディレクトリの `_api/` 配下にコロケーションする。

| 変更前 | 変更後 | 変更内容 |
|---|---|---|
| `src/app/api/[[...route]]/quiz.ts` | `src/app/(features)/session/_api/mutations.ts` | Hono ルート定義を削除。`startQuizSession` / `submitQuizAnswer` / `getSessionSnapshot` および型定義をここに統合 |
| `src/app/api/[[...route]]/review-queue.ts` | `src/app/(features)/review-queue/_api/query.ts` | Hono ルート定義を削除。`getDueReviewCount` / `getReviewQueue` をここに配置 |
| `src/app/api/[[...route]]/_utils/stripUrlsFromText.ts` | `src/app/(features)/session/_utils/stripUrlsFromText.ts` | session feature の内部ユーティリティとして配置 |

`ApiError` は `session/_api/mutations.ts` 内にローカルで再定義する（HTTP status code は不要になるため、シンプルな `Error` サブクラスで十分）。

### 変更するファイル

#### `src/app/(features)/session/_api/actions.ts`

import 元を新しいパスに変更し、`continueSessionFormAction` の `continueSessionQuery` 経由の HTTP 呼び出しを廃止して `startQuizSession` を直接呼ぶ。

```typescript
// 変更前
import { submitQuizAnswer, startQuizSession } from "@/app/api/[[...route]]/quiz";

export async function continueSessionFormAction(formData: FormData): Promise<void> {
  const session = await continueSessionQuery({ topic, mode }); // honoRpcClient 経由
  redirect(`/session/${session.sessionId}`);
}

// 変更後
import { submitQuizAnswer, startQuizSession } from "./mutations";

export async function continueSessionFormAction(formData: FormData): Promise<void> {
  const { userId } = await auth();
  const session = await startQuizSession({ topic, mode, userId: userId ?? "" }); // 直接呼び出し
  redirect(`/session/${session.sessionId}`);
}
```

#### `src/app/(features)/session/_api/query.ts`

`continueSessionQuery` 関数（`honoRpcClient` 依存）を削除する。ファイルが空になる場合はファイルごと削除。

#### `src/app/(features)/session/_api/mutations.ts` （新規作成）

`quiz.ts` からビジネスロジック関数・型定義をすべて移動し、Hono ルート定義は含めない。

#### `src/app/(features)/review-queue/_api/query.ts` （新規作成）

`review-queue.ts` から `getDueReviewCount` / `getReviewQueue` を移動し、Hono ルート定義は含めない。

#### `src/app/(features)/learn/page.tsx`

import パスを `@/app/(features)/review-queue/_api/query` に更新する。

#### `src/app/(features)/review-queue/page.tsx`

import パスを `./_api/query` に更新する。

#### `src/app/(features)/session/_hooks/useQuizAnswer.ts`

`useSWRMutation` を `useState` に置き換える。SWR の本来の価値（キャッシュ・再検証・重複排除）はこのユースケース（ボタン押下ごとの1回限りの mutation）では活きていないため、`useState` で十分に代替できる。

```typescript
// 変更前
import useSWRMutation from "swr/mutation";

export function useQuizAnswer() {
  const mutation = useSWRMutation("quiz/answer", async (_key, { arg }) => {
    return submitQuizAnswerAction(arg);
  });
  return { submit: mutation.trigger, isSubmitting: mutation.isMutating };
}

// 変更後
import { useState } from "react";

export function useQuizAnswer() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  async function submit(arg: { sessionId: string; questionId: string; selectedIndex: number }) {
    setIsSubmitting(true);
    try {
      return await submitQuizAnswerAction(arg);
    } finally {
      setIsSubmitting(false);
    }
  }
  return { submit, isSubmitting };
}
```

#### テストファイル

`tests/` 配下の import パスを新しいパスに合わせて更新する。

---

## 移行後のアーキテクチャ

```
src/
  lib/
    openaiClient.ts    # 変更なし
    auth.ts            # 変更なし
  app/
    (features)/
      session/
        _api/
          mutations.ts # startQuizSession / submitQuizAnswer / getSessionSnapshot / 型定義（quiz.ts から移動）
          actions.ts   # startSessionFormAction / continueSessionFormAction / submitQuizAnswerAction
        _utils/
          stripUrlsFromText.ts  # （_utils/ から移動）
        _hooks/
          useQuizAnswer.ts      # useSWRMutation → useState に置き換え
      learn/
        page.tsx       # getDueReviewCount を review-queue/_api/query からインポート
      review-queue/
        _api/
          query.ts     # getDueReviewCount / getReviewQueue（review-queue.ts から移動）
        page.tsx       # _api/query から直接インポート
    api/               # ディレクトリごと削除
```

---

## 移行手順

1. `session/_api/mutations.ts` を新規作成（`quiz.ts` からビジネスロジック関数・型を移動、Hono ルート削除）
2. `review-queue/_api/` ディレクトリを作成し `query.ts` を新規作成（`review-queue.ts` から関数を移動、Hono ルート削除）
3. `session/_utils/stripUrlsFromText.ts` を新規作成（パスのみ変更）
4. `session/_api/actions.ts` の import パスを更新し、`continueSessionFormAction` を直接呼び出しに変更
5. `session/_api/query.ts` の `continueSessionQuery` を削除（ファイルが空になれば削除）
6. `learn/page.tsx` の import パスを更新
7. `review-queue/page.tsx` の import パスを更新
8. `session/_hooks/useQuizAnswer.ts` を `useSWRMutation` → `useState` に書き換え
9. テストファイルの import パスを更新
10. `src/app/api/[[...route]]/` ディレクトリを削除
11. `src/lib/honoRpcClient.ts`, `src/lib/swr.ts` を削除
12. `pnpm run lint && pnpm run test:run && pnpm run format:check` で確認

---

## 依存パッケージの整理（任意）

移行完了後、以下のパッケージが不要になる可能性がある。使用箇所がなくなったことを確認してから削除する。

- `hono`
- `@hono/zod-validator`
- `swr`（`useQuizAnswer.ts` が最後の使用箇所であるため、置き換え完了後に削除する）

---

## 影響範囲

- **DB 変更なし**
- **UI 変更なし**
- **ユーザー向け挙動の変更なし**
- **外部向け API の破壊的変更なし**（そもそも外部クライアントが存在しない）
