# learn / session 統合 設計書

## 背景・問題

現在 `(features)/learn` と `(features)/session` の 2 feature が存在するが、Package by Feature の観点でいくつかの問題がある。

1. **feature 間の内部依存**  
   `learn/_api/actions.ts` が `session/_api/mutations.ts` を直接 import しており、feature の境界が崩れている。

2. **ユーザーフローが feature をまたぐ**  
   `/learn`（入力）→ `/session/[id]`（クイズ）→ `/session/[id]/complete`（完了）と、1 つのユースケースが 2 feature にまたがっている。

3. **`session/` feature の中核ロジックが外部参照される**  
   `mutations.ts` に `startQuizSession`, `submitQuizAnswer`, `getSessionSnapshot` などコアロジックがあり、`learn/` や `history/` から参照されている。

## 方針

`session/` を廃止し、`learn/` に統合する。  
「クイズ学習」という 1 つのユースケースを `learn/` feature で完結させる。

---

## URL 変更

| 現在 | 統合後 |
|---|---|
| `GET /learn` | `GET /learn`（変更なし） |
| `GET /session/[sessionId]` | `GET /learn/[sessionId]` |
| `GET /session/[sessionId]/complete` | `GET /learn/[sessionId]/complete` |

---

## ディレクトリ構成（統合後）

```
(features)/
  learn/
    page.tsx                        ← 変更なし（/learn 開始フォーム）
    [sessionId]/
      page.tsx                      ← session/[sessionId]/page.tsx から移動
      complete/
        page.tsx                    ← session/[sessionId]/complete/page.tsx から移動
    _api/
      actions.ts                    ← startSessionFormAction などの Server Action を配置
      mutations.ts                  ← session/_api/mutations.ts から移動
    _components/
      LearnPage.tsx                 ← 変更なし
      SubmitButton.tsx              ← 変更なし
      SessionPage.tsx               ← session/_components/ から移動
      SessionProgress.tsx           ← session/_components/ から移動
      SessionCompletePage.tsx       ← session/_components/ から移動
    _hooks/
      useQuizSession.ts             ← session/_hooks/ から移動（redirect 先 URL を変更）
      useQuizAnswer.ts              ← session/_hooks/ から移動
    _utils/
      stripUrlsFromText.ts          ← session/_utils/ から移動
  session/                          ← ディレクトリごと削除
```

---

## 変更ファイル一覧

### 新規作成 / 移動

| 操作 | 移動元 | 移動先 |
|---|---|---|
| 移動 | `session/_api/mutations.ts` | `learn/_api/mutations.ts` |
| 移動 | `session/_components/SessionPage.tsx` | `learn/_components/SessionPage.tsx` |
| 移動 | `session/_components/SessionProgress.tsx` | `learn/_components/SessionProgress.tsx` |
| 移動 | `session/_components/SessionCompletePage.tsx` | `learn/_components/SessionCompletePage.tsx` |
| 移動 | `session/_hooks/useQuizSession.ts` | `learn/_hooks/useQuizSession.ts` |
| 移動 | `session/_hooks/useQuizAnswer.ts` | `learn/_hooks/useQuizAnswer.ts` |
| 移動 | `session/_utils/stripUrlsFromText.ts` | `learn/_utils/stripUrlsFromText.ts` |
| 移動 | `session/[sessionId]/page.tsx` | `learn/[sessionId]/page.tsx` |
| 移動 | `session/[sessionId]/complete/page.tsx` | `learn/[sessionId]/complete/page.tsx` |

### 内容変更

| ファイル | 変更内容 |
|---|---|
| `learn/_api/actions.ts` | 学習開始・回答送信などの Server Action を配置 |
| `learn/_hooks/useQuizSession.ts` | `router.push` の redirect 先を `/session/[id]/complete` → `/learn/[id]/complete` に変更 |
| `learn/[sessionId]/page.tsx` | import パスを `session/_api/mutations` → `learn/_api/mutations` に変更 |
| `learn/[sessionId]/complete/page.tsx` | import パスを `session/_api/mutations` → `learn/_api/mutations` に変更 |
| `learn/_components/SessionCompletePage.tsx` | セッション結果表示と `/learn` への導線を担当 |
| `history/_api/mutations.ts` | `session/_api/mutations` への import がある場合は修正（現状は直接 DB 操作のため不要な可能性大） |

### 削除

| ファイル |
|---|
| `session/` ディレクトリ全体 |

---

## テスト変更

| ファイル | 変更内容 |
|---|---|
| `tests/integration/quiz-answer.test.ts` | import パスを `session/_api/mutations` → `learn/_api/mutations` に変更 |
| `tests/integration/quiz-session.test.ts` | 同上 |
| `tests/integration/quiz-session-errors.test.ts` | 同上 |
| `tests/unit/strip-urls-from-text.test.ts` | import パスを `session/_utils/...` → `learn/_utils/...` に変更 |

---

## 依存関係の整理（統合後）

```
learn/
  _api/mutations.ts       ← DB 直接操作・OpenAI 呼び出し（外部依存なし）
  _api/actions.ts         ← mutations.ts を呼ぶ・redirect
  _components/            ← actions.ts / hooks を消費
  _hooks/                 ← actions.ts の submitQuizAnswerAction を呼ぶ

history/
  _api/mutations.ts       ← DB 直接操作（learn/ への依存なし）

review-queue/
  _api/query.ts           ← DB 直接操作（learn/ への依存なし）
```

feature 間の import はゼロになる。

---

## 実装順序

1. `feature/learn-session-consolidation` ブランチを切る
2. `session/_api/mutations.ts` を `learn/_api/mutations.ts` へ移動・import パス修正
3. `learn/_api/actions.ts` に学習開始・回答送信の Server Action を集約
4. `learn/_hooks/`, `_utils/`, `_components/` へ残ファイルを移動・import パス修正
5. `learn/[sessionId]/` と `learn/[sessionId]/complete/` を作成（page.tsx 移動）
6. `session/` を削除
7. テストの import パス修正
8. `pnpm run lint && pnpm run test:run && pnpm run format:check` で確認
9. `docs/SPEC.md` の URL 仕様箇所を更新
10. PR 作成
