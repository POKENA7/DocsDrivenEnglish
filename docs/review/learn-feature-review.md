# learn 機能コードレビュー

対象ファイル:

- `frontend/src/app/(features)/learn/page.tsx`
- `frontend/src/app/(features)/learn/_api/actions.ts`
- `frontend/src/app/(features)/learn/_api/query.ts`
- `frontend/src/app/(features)/learn/_components/LearnPage.tsx`
- `frontend/src/app/(features)/learn/_components/SubmitButton.tsx`
- （関連）`frontend/src/app/api/[[...route]]/review-queue.ts`（`getDueReviewCount`）

レビュー日: 2026-02-20

---

## 🔴 Critical

### 1. デッドコード — `startSessionAction` / `query.ts` 全体

**ファイル**: `actions.ts` L12–14、`query.ts` 全体

`startSessionAction` は export されているが、どこからも import・呼び出しされていない。  
設計上は `useLearnStart.ts` フック経由で呼ぶ想定だったが、そのフックが存在しない（`_hooks/` は `.gitkeep` のみ）。  
`query.ts` の `startSessionQuery` も同様に呼び出し元がない状態。

```typescript
// actions.ts — これは完全にデッドコード
export async function startSessionAction(input: StartSessionInput): Promise<StartSessionResponse> {
  return startSessionQuery(input);
}
```

さらに `query.ts` では `honoRpcClient` 経由で `/api` を叩く実装になっており、  
Cloudflare Workers 環境では相対 URL で Invalid URL エラーになる問題も内包している  
（`startSessionFormAction` が直接 `startQuizSession` を呼ぶように修正された背景と同じ問題）。

**対応**: `startSessionAction`、`query.ts`（`startSessionQuery`）を削除する。  
`StartSessionInput` 型も `actions.ts` 内への移動または削除を検討する。

---

## 🟠 High

### 2. セキュリティ — Server Action でのエラー時サイレントリターン

**ファイル**: `actions.ts` L32–35

```typescript
if (!topic) return;
if (mode !== "word" && mode !== "reading") return;
const { userId } = await auth();
if (!userId) return;
```

未認証ユーザーの場合に何も返さず関数終了している。  
`form action` として呼ばれているため、リダイレクトもエラーも発生せず、ユーザーはフォームを送信しても何も起こらない状態になる。

**対応**: 未認証時は `redirect("/sign-in")` または `throw` でエラーを呼び出し側に伝える。  
Server Actions でのセキュリティガイドライン（`server-auth-actions`）に則り、  
`requireUserId()`（`src/lib/auth.ts` に実装済み）を利用すべき。

```typescript
// 修正例
const userId = await requireUserId(); // 未認証なら ApiError を throw
```

### 3. セキュリティ — `topic` 入力の最大長バリデーションなし

**ファイル**: `actions.ts` / `quiz.ts`

`startSessionFormAction` で受け取る `topic` に対して文字数上限チェックがない。  
悪意あるユーザーが数万文字のトピックを送信すると、そのままプロンプトに展開されて OpenAI API へ送信される。

**対応**: Server Action と `startQuizSession` のどちらかで上限（例: 200字）を設ける。

```typescript
// actions.ts
const topic = String(formData.get("topic") ?? "").trim().slice(0, 200);
```

---

## 🟡 Medium

### 4. パフォーマンス — `getDueReviewCount` が不要なデータを全件ロード

**ファイル**: `review-queue.ts` L87–99

```typescript
const rows = await db
  .select({ id: reviewQueue.id })
  .from(reviewQueue)
  .where(and(eq(reviewQueue.userId, userId), lte(reviewQueue.nextReviewAt, nowMs)));

return rows.length; // JavaScript 側でカウント
```

条件に合致するレコードの `id` を全件取得した後、JS 側で `length` を数えている。  
件数が多い場合に不要な転送が発生するため、SQL `COUNT(*)` を使うべき。

```typescript
// 修正例（Drizzle ORM）
import { count } from "drizzle-orm";

const [result] = await db
  .select({ count: count() })
  .from(reviewQueue)
  .where(and(eq(reviewQueue.userId, userId), lte(reviewQueue.nextReviewAt, nowMs)));

return result?.count ?? 0;
```

### 5. パフォーマンス — ページ全体が `getDueReviewCount` の完了まで待機

**ファイル**: `page.tsx`

```typescript
export default async function LearnIndexPage() {
  const { userId } = await auth();
  const dueCount = userId ? await getDueReviewCount(userId) : 0;
  return <LearnPage dueCount={dueCount} />;
}
```

DB クエリが完了するまでページ全体のレンダリングがブロックされる。  
バナー（`dueCount > 0` の部分）は非クリティカルなアクセサリー情報であるため、  
`Suspense` でラップしてストリーミングさせることで FCP を改善できる。

```tsx
// 修正例
export default async function LearnIndexPage() {
  return (
    <Suspense fallback={<LearnPage dueCount={0} />}>
      <LearnPageWithDueCount />
    </Suspense>
  );
}

async function LearnPageWithDueCount() {
  const { userId } = await auth();
  const dueCount = userId ? await getDueReviewCount(userId) : 0;
  return <LearnPage dueCount={dueCount} />;
}
```

### 6. Client Component の範囲が広すぎる

**ファイル**: `LearnPage.tsx`

`LearnPage` 全体が `"use client"` になっているが、クライアント状態（`useState`）を使う理由は `questionCount` と `reviewQuestionCount` の連動バリデーションのみ。  
静的な UI 部分（ヘッダー、説明文、mode ラジオボタン）もバンドルに含まれている。

現時点ではコンポーネントが小さいため深刻ではないが、UI が大きくなった場合に備え、interactive な部分だけを Client Component に切り出す設計を検討する価値がある。

---

## 🟢 Low / 改善提案

### 7. `handleQuestionCountChange` のインライン定義

**ファイル**: `LearnPage.tsx` L13–20

`handleQuestionCountChange` は毎レンダー再生成されている。  
直接の子 `SubmitButton` へは渡していないため現状では再レンダーは発生しないが、  
将来的に子コンポーネントに渡す場合を考慮して `useCallback` でラップするのが望ましい。

### 8. 復習問題バナーのアクセシビリティ

**ファイル**: `LearnPage.tsx` L35–42

```tsx
<div role="status" ...>
  📚 復習問題が {dueCount} 件あります — ...
</div>
```

絵文字 `📚` がスクリーンリーダーに読まれるが、意味のある情報は持たないため  
`aria-hidden="true"` を付けることが望ましい。

```tsx
<span aria-hidden="true">📚</span> 復習問題が {dueCount} 件あります — ...
```

### 9. `getOptionalDb` の重複

**ファイル**: `quiz.ts` L63–72、`review-queue.ts` L17–26

まったく同一の `getOptionalDb` 関数が両ファイルに存在する。  
`_utils/` や `db/client.ts` に切り出して共有することで保守性が上がる。  
（ただし AGENTS.md の「過度に関数を切り分けない」方針との兼ね合いで優先度は低い）

---

## ✅ 問題なし

| 観点 | 評価 |
|------|------|
| `SubmitButton` での `useFormStatus` 利用 | 適切。`form` 内部の子として正しく機能する |
| Server Action で直接 `startQuizSession` を呼ぶ | 正しい。Cloudflare Workers 環境での HTTP 自己参照問題を回避 |
| `mode` の型アサーション（`as "word" \| "reading"`）| Server Action 側でも文字列比較チェック済みのため安全 |
| `reviewQuestionCount` の上限（`questionCount - 1`）| Server Action・UI 両側でバリデーション済み |
| `React.cache` による `getDueReviewCount` の重複排除 | 適切。同一リクエスト内での多重呼び出しに対応 |
| `autoComplete="off"` on topic input | 技術トピック入力として適切 |
| `required` 属性 on topic input | ブラウザ側バリデーションとして機能し、空送信を防止 |
