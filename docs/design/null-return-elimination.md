# query 関数の null 返却廃止設計書

## 背景・問題

`server/quiz/query.ts` の2つの関数が `null` を返す設計になっており、呼び出し元がそれぞれ好き勝手に null を処理することで、エラーが隠蔽されたり意味的に不正確なエラーコードが返る問題が発生している。

---

## 問題箇所の詳細

### 問題1: `getSessionSnapshot` が `SessionRecord | null` を返す

**現状**

```ts
// server/quiz/query.ts
export async function getSessionSnapshot(sessionId: string): Promise<SessionRecord | null> {
  // ...
  if (!session) return null;
  // ...
}
```

呼び出し元の処理が非対称になっている。

| ファイル | null 時の処理 | 問題 |
|---|---|---|
| `learn/[sessionId]/page.tsx` | 独自エラーメッセージをレンダリング | 正規の 404 にならない（ステータスコードが 200 のまま） |
| `learn/[sessionId]/complete/page.tsx` | `session?.topic ?? null` / `session?.mode ?? null` で無視 | エラーが隠蔽され、UI が壊れた状態で表示される |

```tsx
// learn/[sessionId]/page.tsx（現状）
const session = await getSessionSnapshot(sessionId);
if (!session) {
  return (
    <main>
      <p>セッションが見つかりませんでした。</p>  {/* 200 OK のまま */}
    </main>
  );
}

// learn/[sessionId]/complete/page.tsx（現状）
const session = await getSessionSnapshot(sessionId);
return (
  <SessionCompletePage
    topic={session?.topic ?? null}  // null が黙って渡る
    mode={session?.mode ?? null}
  />
);
```

`sessionId` は URL パラメータ由来であり、存在しない場合の正しい HTTP セマンティクスは **404 Not Found** である。

---

### 問題2: `getQuestion` が `QuestionRecord | null` を返す

**現状**

```ts
// server/quiz/query.ts
export async function getQuestion(questionId: string): Promise<QuestionRecord | null> {
  // ...
  if (!row) return null;
  // ...
}
```

```ts
// server/quiz/answer.ts（現状）
const q = await getQuestion(input.questionId);
if (!q || q.sessionId !== input.sessionId) {
  throw new ApiError("BAD_REQUEST", "問題が見つかりませんでした");
}
```

| ケース | 現状のエラーコード | 正しいエラーコード |
|---|---|---|
| 問題が DB に存在しない | `BAD_REQUEST` | `NOT_FOUND` |
| questionId と sessionId が不一致 | `BAD_REQUEST` | `BAD_REQUEST`（正しい） |

問題不存在（NOT_FOUND）と入力不正（BAD_REQUEST）を同一条件で同一エラーコードに混在させており、エラーの意味的な精度が低い。

---

## 修正方針

### `getSessionSnapshot` の修正

`page.tsx` から呼び出される関数であるため、`next/navigation` の `notFound()` を用いて Next.js の 404 ページに委譲する。

```ts
// After: server/quiz/query.ts
import { notFound } from "next/navigation";

export async function getSessionSnapshot(sessionId: string): Promise<SessionRecord> {
  // ...
  if (!session) notFound();  // 404 を throw
  // ...
  return { ... };  // 返り値は non-nullable
}
```

**呼び出し元の変更**

```tsx
// After: learn/[sessionId]/page.tsx
const session = await getSessionSnapshot(sessionId);  // null チェック不要
return <SessionPage session={session} />;

// After: learn/[sessionId]/complete/page.tsx
const session = await getSessionSnapshot(sessionId);  // null チェック不要
return (
  <SessionCompletePage
    sessionId={sessionId}
    topic={session.topic}   // non-nullable になる
    mode={session.mode}
  />
);
```

`SessionCompletePage` の props 型も `topic: string | null` から `topic: string` へ変更する。

---

### `getQuestion` の修正

`answer.ts`（Server Action）から呼ばれるため `notFound()` は使用できない。`ApiError("NOT_FOUND", ...)` を関数内で throw する。

```ts
// After: server/quiz/query.ts
export async function getQuestion(questionId: string): Promise<QuestionRecord> {
  // ...
  if (!row) throw new ApiError("NOT_FOUND", "問題が見つかりませんでした");
  // ...
  return { ... };  // 返り値は non-nullable
}
```

```ts
// After: server/quiz/answer.ts
const q = await getQuestion(input.questionId);  // NOT_FOUND の場合は throw で終了
if (q.sessionId !== input.sessionId) {
  throw new ApiError("BAD_REQUEST", "セッションが一致しません");  // sessionId 不一致のみ
}
```

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `server/quiz/query.ts` | `getSessionSnapshot` → `notFound()` + 返り値を `SessionRecord` に変更 |
| `server/quiz/query.ts` | `getQuestion` → `ApiError("NOT_FOUND", ...)` + 返り値を `QuestionRecord` に変更 |
| `server/quiz/answer.ts` | `getQuestion` の null チェック削除、sessionId 不一致のみ `BAD_REQUEST` に修正 |
| `app/(features)/learn/[sessionId]/page.tsx` | null チェック削除 |
| `app/(features)/learn/[sessionId]/complete/page.tsx` | `session?.topic ?? null` → `session.topic` に修正 |
| `app/(features)/learn/_components/SessionCompletePage.tsx` | props 型 `topic: string \| null` → `topic: string` に変更（`mode` も同様に見直す） |

---

## テスト方針

- `quiz-answer.test.ts` の `getQuestion` が null を返すケースのモックを `ApiError("NOT_FOUND", ...)` を throw するように更新する
- `quiz-session-errors.test.ts` のエラーコード検証を `NOT_FOUND` に修正する
