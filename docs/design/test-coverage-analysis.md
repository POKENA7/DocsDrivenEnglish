# テスト状況の棚卸しと追加方針メモ

## 概要

`frontend/tests` と `frontend/src` を確認し、現状どのテストがあり、どの領域のテストが不足しているかを整理した。  
今回の目的は **いきなりテストを追加することではなく、追加候補を優先度つきで見える化すること** である。

---

## 現状のテスト基盤

- テストランナーは Vitest
- 設定ファイルは `frontend/vitest.config.ts`
- `include` は `tests/**/*.test.ts`
- `environment` は `node`
- `server-only` の shim はあるが、`jsdom` や React Testing Library は未導入

このため、現状のテスト基盤は **Server / utility のロジック検証に寄っている**。  
React hooks / Client Component のテストを本格的に増やす場合は、単にテストを書く前に `vitest.config.ts` と依存関係の拡張要否を判断する必要がある。

---

## 現状のテスト一覧

2026-03-07 時点で、`frontend/tests` には **11 ファイル / 41 ケース** のテストがある。

### Unit Tests

| テストファイル | ケース数 | 主な対象 | 確認していること |
|---|---:|---|---|
| `frontend/tests/unit/strip-urls-from-text.test.ts` | 4 | `app/(features)/learn/_utils/stripUrlsFromText.ts` | markdown link / bare URL / autolink / anchor link の除去 |
| `frontend/tests/unit/history-aggregate.test.ts` | 6 | `server/history/query.ts` | 履歴集計、日別集計、月またぎの値変換 |
| `frontend/tests/unit/get-session-result.test.ts` | 4 | `server/quiz/query.ts` | セッション結果集計、順序保持、未回答時の扱い、notFound |

### Integration Tests

| テストファイル | ケース数 | 主な対象 | 確認していること |
|---|---:|---|---|
| `frontend/tests/integration/quiz-session.test.ts` | 3 | `server/quiz/session.ts` | topic 必須、セッション開始、questionCount 指定 |
| `frontend/tests/integration/quiz-session-errors.test.ts` | 3 | `server/quiz/session.ts` | 空 topic、空白 topic、LLM が空配列を返した時の失敗 |
| `frontend/tests/integration/quiz-answer.test.ts` | 6 | `server/quiz/answer.ts` | 正誤判定、string の `selectedIndex`、question/session 不整合 |
| `frontend/tests/integration/review-queue.test.ts` | 4 | `server/quiz/answer.ts` / `server/quiz/session.ts` | 不正解時の復習登録、正解時の `reviewNextAt`、復習問題の先頭挿入 |
| `frontend/tests/integration/shared-session.test.ts` | 2 | `server/quiz/shared-session.ts` | 共有問題がない場合の `NOT_FOUND` |
| `frontend/tests/integration/retry-review-item.test.ts` | 4 | `server/quiz/session.ts` | 単一復習セッション作成、`questionIdsJson` 保存、`NOT_FOUND` |
| `frontend/tests/integration/review-queue-delete.test.ts` | 3 | `server/review/delete.ts` | 復習キュー削除の例外非発生 |
| `frontend/tests/integration/more-explanation-auth.test.ts` | 2 | `app/(features)/learn/_api/actions.ts` | `fetchMoreExplanationAction` の認証分岐 |

### いまのテスト傾向

- 重点は `server/quiz/*` のセッション開始・回答・復習まわり
- DB や OpenAI は `vi.mock()` による置き換え前提
- 正常系と一部エラー系はあるが、**境界値** と **DB 更新内容の詳細** はまだ薄い
- UI / hooks / page レイヤーのテストは未着手

---

## 足りている点

現状でも、以下のような「壊れると学習フロー全体が止まりやすい部分」は最低限押さえられている。

- セッション開始時の基本バリデーション
- 回答時の正誤判定
- Cloudflare Workers 経由で数値が文字列化されるケース
- 復習キュー登録の有無
- セッション結果集計の順序保持
- `fetchMoreExplanationAction` の認証必須

そのため、**テストがまったく無い状態ではない**。  
一方で、今後追加するなら「同じ種類の薄いテストを増やす」より、未カバーの重要ロジックを埋める方が効果が高い。

---

## 足りていないテスト

### 優先度: 高

#### 1. AI 問題生成の正常系・境界値

- 対象: `frontend/src/server/quiz/generate.ts`
- 現状:
  - `startQuizSession` 経由で「空配列なら失敗」は見ている
  - 生成された問題の整形や schema 依存挙動は直接見ていない
- 足りない観点:
  - `topic.trim()` 後に空なら `[]` を返すこと
  - `word` / `reading` で prompt が切り替わること
  - `choices` / `prompt` / `explanation` の trim
  - `questionCount` に応じて `items` の上限 schema が変わること
- 追加したい理由:
  - サービス価値の中心が AI 生成であり、ここが壊れると全機能に影響するため

#### 2. 回答後の復習間隔計算

- 対象: `frontend/src/server/quiz/answer.ts`
- 現状:
  - 不正解で復習登録されること
  - 正解時に `reviewNextAt` が返ること
- 足りない観点:
  - `intervalDays * 2` の更新式
  - 30 日上限
  - 不正解時に `intervalDays = 1` へ戻すこと
  - `wrongCount` の increment
- 追加したい理由:
  - 復習キューの学習体験を左右するコアロジックで、回帰すると気づきにくい

#### 3. セッション保存の詳細

- 対象: `frontend/src/server/quiz/session.ts`
- 現状:
  - セッション作成自体は見ている
  - 復習問題の先頭挿入も 1 ケースだけある
- 足りない観点:
  - `sessions` テーブルへ保存される `questionIdsJson` の中身
  - 新規問題と復習問題が混在した時の順序
  - `newQuestionCount <= 0` の時に新規生成しないこと
  - `allQuestionIds.length === 0` 時の失敗
- 追加したい理由:
  - セッションの中身と結果表示の整合に直結するため

#### 4. Server Action の境界値

- 対象: `frontend/src/app/(features)/learn/_api/actions.ts`
- 現状:
  - `fetchMoreExplanationAction` の認証分岐のみ
- 足りない観点:
  - `questionCount` の 1 / 20 / 範囲外
  - `reviewQuestionCount > questionCount - 1` の自動調整
  - 不正入力時のエラーメッセージ
  - `startSharedSessionFormAction` の `NOT_FOUND` ハンドリング
- 追加したい理由:
  - フォーム入力からサーバー処理へ入る最初の関門で、バグがユーザー操作に直結するため

### 優先度: 中

#### 5. 共有クイズの正常系

- 対象: `frontend/src/server/quiz/shared-session.ts`
- 現状:
  - 問題が 0 件の時の失敗のみ
- 足りない観点:
  - 他ユーザー問題が取得できた時のセッション生成
  - 復習問題を先頭に混ぜるケース
  - `questionIdsJson` の保存順

#### 6. 履歴記録・復習一覧取得

- 対象:
  - `frontend/src/server/history/record.ts`
  - `frontend/src/server/review/query.ts`
- 現状:
  - `query.ts` 側の集計はある
  - `recordAttempt` や `getReviewQueue` / `getDueReviewCount` は未テスト
- 足りない観点:
  - INSERT payload が正しいこと
  - `dueItems` / `upcomingItems` の分類
  - `Date.now()` 境界での due 判定

#### 7. OpenAI ラッパーのフォールバック

- 対象: `frontend/src/lib/openaiClient.ts`
- 現状:
  - 直接テストなし
- 足りない観点:
  - `output_parsed !== null` の通常系
  - `output_text` fallback の JSON parse
  - incomplete response の失敗
- 追加したい理由:
  - OpenAI SDK 依存部分で、障害時の挙動を固定しておきたい

### 優先度: 低

#### 8. React hooks / Client Component

- 対象:
  - `frontend/src/app/(features)/learn/_hooks/useQuizSession.ts`
  - `frontend/src/app/(features)/learn/_hooks/useQuizAnswer.ts`
  - `frontend/src/app/(features)/learn/_hooks/useMoreExplanation.ts`
  - `frontend/src/app/(features)/learn/_components/SessionPage.tsx`
- 足りない観点:
  - `next()` の完了時ルーティング
  - `isSubmitting` / `isFetching` の状態遷移
  - 解説表示と追加解説取得の UI 挙動
- ただし:
  - これらを追加するには、現状の `node` 環境だけでは足りず、`jsdom` や React Testing Library 導入の判断が先になる

---

## 今すぐ追加したほうがよいか

結論として、**追加したほうがよい**。ただし順番が重要。

### まず追加したい

1. `generate.ts`
2. `answer.ts` の復習間隔計算
3. `session.ts` の保存内容
4. `actions.ts` の境界値

この 4 つは、既存のテスト基盤（Vitest + mock）だけで追加しやすく、学習体験への影響も大きい。

### 後からでよい

1. hooks / Client Component
2. 静的ページ
3. レイアウトやスタイル

ここはテスト価値が低いというより、**今の基盤に対してコストが高い**。  
先に Server / action レイヤーを厚くしてから、必要なら UI テスト基盤を増やす方が自然。

---

## 追加しなくてよい / 後回しでよい観点

| 項目 | 理由 |
|---|---|
| `frontend/src/app/(marketing)/page.tsx` などの静的ページ | 文言変更中心で、ロジックがほぼ無い |
| Clerk 自体の挙動 | アプリ独自ロジックではなく、action 側の分岐を押さえれば十分 |
| Drizzle ORM / migration 自体 | フレームワーク固有の責務で、ここを直接細かくテストする優先度は低い |
| CSS / 見た目 | Unit test よりも目視確認や将来的な E2E の方が適している |

---

## 推奨する追加順

### フェーズ 1

- `server/quiz/generate.ts`
- `server/quiz/answer.ts`
- `server/quiz/session.ts`
- `app/(features)/learn/_api/actions.ts`

### フェーズ 2

- `server/quiz/shared-session.ts`
- `server/history/record.ts`
- `server/review/query.ts`
- `src/lib/openaiClient.ts`

### フェーズ 3

- hooks / Client Component 用のテスト基盤を作るか判断する
- 必要ならその後に `useQuizSession` / `SessionPage` などを追加する

---

## 補足

今回の調査ではテスト追加そのものは行っていない。  
まずは「どこから増やすと効果が高いか」を明確にすることを優先し、既存の 41 ケースの偏りと、追加候補の優先順位を整理した。
