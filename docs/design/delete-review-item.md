# 設計書: 復習問題の削除機能 (Issue #23)

## 概要

`review-queue` ページに表示されている各復習問題に「削除」ボタンを追加する。
削除された問題は `review_queue` テーブルから除去され、以後の復習対象から外れる。

---

## 要件

- 今日出題予定・今後の予定、双方のリストにある全アイテムに「削除」ボタンを表示する
- ボタンを押すと確認ダイアログを表示し、ユーザが「削除する」を選択した場合のみ `review_queue` テーブルから該当レコードを削除してページをリフレッシュする
- 削除はそのユーザのキューからのみ行い、他ユーザのデータには影響しない
- DBスキーマ変更・マイグレーションは不要

---

## 実装方針

既存の `retryReviewItemAction` と同じパターン（Server Action）で削除ロジックを実装する。
確認ダイアログには shadcn/ui の `AlertDialog` を使用する。
`AlertDialog` はクライアントインタラクションが必要なため、削除ボタン部分だけを `"use client"` のクライアントコンポーネント（`DeleteReviewItemButton`）として切り出す。
`page.tsx` はサーバーコンポーネントのまま維持する。

---

## 変更ファイル一覧

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/server/review/delete.ts` | 新規作成 | DB削除ロジック |
| `src/app/(features)/review-queue/_api/actions.ts` | 変更 | `deleteReviewItemAction` 追加 |
| `src/app/(features)/review-queue/_components/DeleteReviewItemButton.tsx` | 新規作成 | AlertDialog付き削除ボタン（クライアントコンポーネント） |
| `src/app/(features)/review-queue/page.tsx` | 変更 | `DeleteReviewItemButton` の組み込み |
| `tests/integration/review-queue-delete.test.ts` | 新規作成 | 統合テスト |

### 事前作業: shadcn/ui AlertDialog のインストール

```bash
npx shadcn add alert-dialog
```

---

## 詳細設計

### 1. `src/server/review/delete.ts`（新規）

```typescript
import "server-only";

import { getDb } from "@/db/client";
import { reviewQueue } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function deleteReviewItem({
  userId,
  questionId,
}: {
  userId: string;
  questionId: string;
}): Promise<void> {
  const db = getDb();
  await db
    .delete(reviewQueue)
    .where(and(eq(reviewQueue.userId, userId), eq(reviewQueue.questionId, questionId)));
}
```

### 2. `src/app/(features)/review-queue/_api/actions.ts`（変更）

クライアントコンポーネントから `questionId` を直接受け取るシグネチャにする。

```typescript
export async function deleteReviewItemAction(questionId: string): Promise<void> {
  if (!questionId) return;

  const userId = await requireUserId();
  await deleteReviewItem({ userId, questionId });
  revalidatePath("/review-queue");
}
```

- `redirect` ではなく `revalidatePath` でページを更新する（同ページに留まる）
- `requireUserId` による認証でユーザを特定し、他ユーザのデータを操作できないことを保証する

### 3. `src/app/(features)/review-queue/_components/DeleteReviewItemButton.tsx`（新規）

```tsx
"use client";

import { useTransition } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { deleteReviewItemAction } from "../_api/actions";

export function DeleteReviewItemButton({ questionId }: { questionId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteReviewItemAction(questionId);
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          className="btn btn-destructive whitespace-nowrap text-xs"
          disabled={isPending}
        >
          削除
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>復習問題を削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            この操作は取り消せません。この問題は今後の復習対象から外れます。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>削除する</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### 4. `src/app/(features)/review-queue/page.tsx`（変更）

各 `<li>` 内のボタン群を横並びにし、`DeleteReviewItemButton` を組み込む。

```tsx
<div className="flex shrink-0 gap-2">
  <form action={retryReviewItemAction}>
    <input type="hidden" name="questionId" value={item.questionId} />
    <button type="submit" className="btn btn-secondary whitespace-nowrap text-xs">
      再度解く
    </button>
  </form>
  <DeleteReviewItemButton questionId={item.questionId} />
</div>
```

- `dueItems` と `upcomingItems` の両セクションに同様の変更を適用する

### 5. `tests/integration/review-queue-delete.test.ts`（新規）

テストケース:

| # | ケース | 期待結果 |
|---|---|---|
| 1 | 存在するキューアイテムを自身のユーザIDで削除する | `review_queue` からレコードが消える |
| 2 | 存在しないアイテムを削除しても例外が発生しない | 正常終了 |
| 3 | 別ユーザのアイテムは削除されない | 他ユーザのレコードが残る |

---

## UIイメージ

```
┌──────────────────────────────────────────────────────────────┐
│ React hooks in functional components                         │
│ 不正解回数: 2　次回: 今日                                     │
│                               [再度解く]  [削除]             │
└──────────────────────────────────────────────────────────────┘
```

---

## 考慮事項

- **shadcn/ui AlertDialog を使用**: 誤タップによる意図しない削除を防ぐ。ブラウザネイティブの `confirm()` より視覚的に親しみやすい UI を実現する
- **`DeleteReviewItemButton` クライアントコンポーネントに分離**: `page.tsx` をサーバーコンポーネントのまま維持しつつ、インタラクティブな確認ダイアログを実現する
- **取り消し機能は設けない**: 削除前の確認ダイアログで代替
- **スキーマ変更なし**: `review_queue` テーブルからの DELETE のみ
- **`questions` テーブルは削除しない**: 解答履歴（`attempts`）は保持する
