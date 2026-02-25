# もっと解説機能 設計書

**作成日**: 2026-02-25  
**対象 Issue**: [#18 もっと解説機能](https://github.com/POKENA7/DocsDrivenEnglish/issues/18)

---

## 1. 概要

クイズ回答後の解説カードの下に「もっと解説」ボタンを追加し、押すと OpenAI API が生成した追加解説を表示する機能。

英文の文法・語源・使用シーン、または技術的な背景についてより深く知りたいユーザーのニーズに応える。

---

## 2. ユーザーフロー

```
クイズ回答
  ↓
正誤判定 + 通常解説が表示される（既存）
  ↓
[もっと解説] ボタンをクリック（新規）
  ↓
ボタンがローディング状態になる
  ↓
追加解説が解説カード下部に表示される
  ↓
（1問につき1回のみ取得可能）
```

---

## 3. UI 設計

### 3-1. ボタン配置

`SessionPage.tsx` の解説カード（`result` 表示時）の **下部** に「もっと解説」ボタンを追加する。

```
┌─────────────────────────────────────────┐
│ 解説                                     │
│ 〇〇は△△を意味します。...               │
│                                         │
│ [もっと解説]  ← 新規追加                │
└─────────────────────────────────────────┘

↓ クリック後

┌─────────────────────────────────────────┐
│ 解説                                     │
│ 〇〇は△△を意味します。...               │
│                                         │
│ ─────────────────────────────────────  │
│ より詳しい解説                           │
│ 語源: ...                               │
│ 使用シーン: ...                          │
│ 技術的な背景: ...                        │
└─────────────────────────────────────────┘
```

### 3-2. ボタンの状態管理

| 状態 | 表示 |
|------|------|
| 初期状態（回答前） | ボタン非表示 |
| 回答後・未取得 | `「もっと解説」` ボタンを表示 |
| 取得中 | ボタンを disabled + `「取得中...」` |
| 取得済み | ボタンを非表示にし、追加解説テキストを表示 |
| エラー | エラーメッセージを表示、ボタンは再試行可能 |

---

## 4. 実装設計

既存の `submitQuizAnswerAction`（Server Action）と同じ層構造を採用する。  
**API Route は使用しない。**

### 4-1. 変更・追加ファイル一覧

| ファイル | 種別 | 内容 |
|---------|------|------|
| `frontend/src/server/quiz/types.ts` | 変更 | `MoreExplanationInput` / `MoreExplanationResponse` 型を追加 |
| `frontend/src/lib/openaiClient.ts` | 変更 | `createOpenAIText` ヘルパーを追加 |
| `frontend/src/server/quiz/moreExplanation.ts` | 新規 | OpenAI 呼び出しのサーバーロジック |
| `frontend/src/app/(features)/learn/_api/actions.ts` | 変更 | `fetchMoreExplanationAction` Server Action を追加 |
| `frontend/src/app/(features)/learn/_hooks/useMoreExplanation.ts` | 新規 | Client Hook |
| `frontend/src/app/(features)/learn/_components/SessionPage.tsx` | 変更 | ボタン・追加解説 UI を追加 |
| `docs/SPEC.md` | 変更 | もっと解説機能を仕様書に追記 |

---

### 4-2. 型定義

**`frontend/src/server/quiz/types.ts` に追記**

```ts
export type MoreExplanationInput = {
  questionId: string;
  prompt: string;       // 問題文（文脈としてプロンプトに渡す）
  explanation: string;  // 既存解説（追加解説の出発点）
};

export type MoreExplanationResponse = {
  moreExplanation: string;
};
```

---

### 4-3. OpenAI テキスト生成ヘルパー

**`frontend/src/lib/openaiClient.ts` に追記**

既存の `createOpenAIParsedText`（構造化出力用）に加え、プレーンテキスト生成用の `createOpenAIText` を追加する。

```ts
export async function createOpenAIText(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  options?: { maxOutputTokens?: number },
): Promise<string> {
  // ...
}
```

---

### 4-4. サーバーロジック

**`frontend/src/server/quiz/moreExplanation.ts`（新規）**

```ts
import "server-only";
import { createOpenAIText } from "@/lib/openaiClient";
import type { MoreExplanationInput, MoreExplanationResponse } from "./types";

const MODEL = "gpt-5-mini";

export async function fetchMoreExplanation(
  input: MoreExplanationInput,
): Promise<MoreExplanationResponse> {
  // ...
}
```

---

### 4-5. Server Action

**`frontend/src/app/(features)/learn/_api/actions.ts` に追記**

```ts
export async function fetchMoreExplanationAction(
  input: MoreExplanationInput,
): Promise<MoreExplanationResponse> {
  return fetchMoreExplanation(input);
}
```

> `"use server"` は既にファイル先頭に宣言済みのため追記不要。

---

### 4-6. Client Hook

**`frontend/src/app/(features)/learn/_hooks/useMoreExplanation.ts`（新規）**

```ts
export function useMoreExplanation() {
  const [moreExplanation, setMoreExplanation] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMoreExplanation(null);
    setError(null);
  }

  async function fetch(input: MoreExplanationInput) {
    if (moreExplanation !== null) return;
    // ...
  }

  return { moreExplanation, isFetching, error, fetch, reset };
}
```

> `useQuizAnswer.ts` と同じ設計パターン。

---

### 4-7. UI 変更（SessionPage.tsx）

`useMoreExplanation` を追加し、解説カード内にボタンと追加解説を追記する。

問題が変わったとき（`current.questionId` が変わったとき）に `useEffect` で `reset()` を呼び、状態をリセットする。

```tsx
const { moreExplanation, isFetching, error, fetch: fetchMore, reset } = useMoreExplanation();

useEffect(() => {
  reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [current.questionId]);
```

---

## 5. コスト・レート制限の考慮

| 項目 | 方針 |
|------|------|
| モデル | `gpt-5-mini`（低コスト） |
| トークン上限 | `maxOutputTokens: 400` で上限設定 |
| 呼び出しタイミング | ユーザーが明示的にボタンを押したときのみ（自動取得なし） |
| 1問あたりの上限 | Hook 内で「取得済みは再取得しない」制御を実装済み |
| 認証 | 既存の学習機能と同様にログイン必須（`auth()` の userId は渡さず制限しない） |

---

## 6. 状態リセット設計

`useMoreExplanation` の state は1問ごとにリセットが必要。  
`SessionPage.tsx` 内で `useEffect` を使い、`current.questionId` の変化を監視して `reset()` を呼ぶ。

```tsx
useEffect(() => {
  reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [current.questionId]);
```

---

## 7. 受け入れ基準

- [ ] 回答後の解説カードに「もっと解説」ボタンが表示される
- [ ] ボタン押下中はローディング表示になる
- [ ] 追加解説が正常に表示される
- [ ] 「もっと解説」取得済みの場合、ボタンが消え解説テキストが表示される
- [ ] 次の問題へ進むと追加解説の状態がリセットされる
- [ ] API エラー時はエラーメッセージが表示され、再試行できる
- [ ] 未回答状態ではボタンは表示されない
