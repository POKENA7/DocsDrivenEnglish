# 設計書: continue learning 導線の削除

**作成日**: 2026-03-07  
**ステータス**: Done  
**Issue**: #65

---

## 背景

セッション完了画面（`/learn/[sessionId]/complete`）には、同じトピックで次の 5 問を開始する continue learning 導線が存在していた。  
一方で現在の学習導線では、完了後はいったん `/learn` に戻って次の学習条件を明示的に選び直すほうがシンプルで、仕様書や設計書にも完了後の分岐が残っていた。

---

## 変更方針

- `SessionCompletePage` から continue learning 用フォームを削除する
- 完了画面のアクションは `/learn` への Link のみにする
- continue learning 専用コンポーネントと Server Action を削除する
- `docs/SPEC.md` と関連設計書から continue learning への言及を取り除く

---

## 変更対象

| ファイル | 変更内容 |
|---|---|
| `frontend/src/app/(features)/learn/_components/SessionCompletePage.tsx` | `/learn` への Link のみを表示 |
| `frontend/src/app/(features)/learn/_components/ContinueForm.tsx` | 削除 |
| `frontend/src/app/(features)/learn/_components/ContinueButton.tsx` | 削除 |
| `frontend/src/app/(features)/learn/_api/actions.ts` | `continueSessionInput` / `continueSessionFormAction` を削除 |
| `docs/SPEC.md` | 完了画面は `/learn` へ戻る仕様に更新 |
| `docs/design/*.md` | continue learning 参照を削除 |

---

## 完了条件

- セッション完了画面に continue learning 用フォームが存在しない
- 完了画面から `/learn` に戻れる
- continue learning 専用の UI / Server Action がコードベースから削除されている
- `pnpm run lint`
- `pnpm run test:run`
- `pnpm run format:check`
- `pnpm run build`
