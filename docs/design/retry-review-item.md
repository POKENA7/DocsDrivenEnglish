# 設計書: 復習問題の個別再挑戦機能

## Issue

[#22 復習問題を個別で再度解ける機能の追加](https://github.com/POKENA7/DocsDrivenEnglish/issues/22)

## 概要

`/review-queue` ページに表示されている各復習問題カードに「再度解く」ボタンを追加する。  
クリックすると、その問題1問だけを含む新規クイズセッションを作成し、`/learn/[sessionId]` にリダイレクトして出題する。

---

## 実装方針

### 基本フロー

1. ユーザーが `review-queue` ページの問題カードにある「再度解く」ボタンを押す
2. Server Action が `questionId` を受け取る
3. DBから該当問題の情報（`prompt`, `choices`, `correctIndex`, `explanation`）と、親セッションの `topic` を JOIN で取得する
4. `sourceQuestionId` に元の `questionId` をセットした1問だけのセッションを作成して DB に保存する
5. `/learn/[newSessionId]` にリダイレクトする

`sourceQuestionId` をセットすることで、既存の `submitQuizAnswer` ロジックによる `reviewQueue` の更新（正解 → 30日後、不正解 → 翌日）がそのまま動作する。

---

## 変更ファイル一覧

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/server/quiz/session.ts` | 追加 | `startSingleReviewSession()` 関数 |
| `src/app/(features)/review-queue/_api/actions.ts` | 新規 | `retryReviewItemAction` Server Action |
| `src/app/(features)/review-queue/page.tsx` | 変更 | 各カードに「再度解く」ボタンを追加 |

---

## 詳細設計

### 1. `src/server/quiz/session.ts` に関数追加

```typescript
export async function startSingleReviewSession(input: {
  questionId: string;
  userId: string;
}): Promise<{ sessionId: string }> {
  const db = getOptionalDb();
  if (!db) throw new ApiError("INTERNAL", "DB接続に失敗しました");

  // 対象問題と親セッションの topic を取得
  const [row] = await db
    .select({
      prompt: questionsTable.prompt,
      choicesJson: questionsTable.choicesJson,
      correctIndex: questionsTable.correctIndex,
      explanation: questionsTable.explanation,
      topic: studySessions.topic,
      mode: studySessions.mode,
    })
    .from(questionsTable)
    .innerJoin(studySessions, eq(questionsTable.sessionId, studySessions.sessionId))
    .where(eq(questionsTable.questionId, input.questionId))
    .limit(1);

  if (!row) throw new ApiError("NOT_FOUND", "問題が見つかりません");

  const sessionId = crypto.randomUUID();
  const now = new Date();

  const question: QuestionRecord = {
    questionId: crypto.randomUUID(),
    sessionId,
    prompt: row.prompt,
    choices: JSON.parse(row.choicesJson) as [string, string, string, string],
    correctIndex: row.correctIndex,
    explanation: row.explanation,
    sourceQuestionId: input.questionId, // reviewQueue 更新に必要
  };

  await persistSession(db, {
    sessionId,
    topic: row.topic,
    mode: row.mode as Mode,
    plannedCount: 1,
    actualCount: 1,
    questions: [question],
  });

  return { sessionId };
}
```

### 2. `src/app/(features)/review-queue/_api/actions.ts` を新規作成

```typescript
"use server";

import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { startSingleReviewSession } from "@/server/quiz/session";

export async function retryReviewItemAction(formData: FormData): Promise<void> {
  const questionId = String(formData.get("questionId") ?? "").trim();
  if (!questionId) return;

  const userId = await requireUserId();
  const { sessionId } = await startSingleReviewSession({ questionId, userId });
  redirect(`/learn/${sessionId}`);
}
```

### 3. `src/app/(features)/review-queue/page.tsx` のカード変更

各 `<li>` の `card-compact` に「再度解く」ボタン用フォームを追加する。

```tsx
<li key={item.questionId} className="card-compact flex items-start justify-between gap-4">
  <div>
    <p className="text-sm font-medium">{extractLabel(item.prompt)}</p>
    <p className="mt-1 text-xs text-muted-foreground">
      不正解回数: {item.wrongCount}　次回: 今日
    </p>
  </div>
  <form action={retryReviewItemAction}>
    <input type="hidden" name="questionId" value={item.questionId} />
    <button type="submit" className="btn-secondary shrink-0 text-xs">
      再度解く
    </button>
  </form>
</li>
```

`upcomingItems` 側のカードも同様に変更する。

---

## DBスキーマ変更

なし。既存の `questions`, `study_sessions`, `review_queue` テーブルをそのまま使用する。

---

## 動作確認ポイント

| ケース | 期待動作 |
|---|---|
| dueItems の「再度解く」をクリック | 1問セッション作成 → `/learn/[id]` にリダイレクト |
| upcomingItems の「再度解く」をクリック | 同上（期限前でも即時挑戦可能） |
| 正解した場合 | `reviewQueue.nextReviewAt` が30日後に更新される |
| 不正解した場合 | `reviewQueue.nextReviewAt` が翌日に更新・`wrongCount` インクリメント |
| DB未接続時 | ApiError を throw → エラー画面 |

---

## テスト方針

`tests/integration/` に以下を追加する。

- `retry-review-item.test.ts`
  - `startSingleReviewSession` が正常にセッションを作成できること
  - `sourceQuestionId` が正しくセットされること
  - 存在しない `questionId` を渡すと `NOT_FOUND` エラーになること
