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
        <button className="btn btn-destructive whitespace-nowrap text-xs" disabled={isPending}>
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
