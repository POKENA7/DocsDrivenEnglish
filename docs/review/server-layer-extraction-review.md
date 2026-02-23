# server-layer-extraction 設計レビュー

対象: `docs/design/server-layer-extraction.md`
レビュー日: 2026-02-24

## 総評

方向性は妥当です。`app/` からドメインロジックを分離して `server/` に集約する方針は、依存の見通し・テスト容易性・将来拡張性のいずれにも効きます。

一方で、現状の記述だと「責務境界の切り方」と「移行手順」がやや粗く、実装フェーズで再び密結合を生むリスクがあります。特に `review_queue` 更新責務の扱いは、今回の主目的（feature 間依存の排除）に対して追加明確化が必要です。

---

## 良い点

- UI 層を「薄い委譲層」に限定する方針が明確
- `server/quiz`, `server/review`, `server/history` の分割意図がわかりやすい
- テスト import を `@/server/*` に統一する方針は、層の独立性向上に有効
- 将来の `server/progress` 拡張を先に示しており、設計の延長線が描けている

---

## 指摘事項

### 🔴 Critical 1: review ドメインの「書き込み責務」が未定義

現行課題として「`learn` が `review_queue` を直接操作」を挙げていますが、変更後構成では `server/review/query.ts`（読み取り）しか定義されておらず、`submitQuizAnswer` 側で再び `review_queue` を直接更新する実装になりやすいです。

この状態だと、配置は変わっても責務の混在は残ります。

**改善提案**

- `server/review/command.ts` を追加し、以下を review ドメインに集約する
  - `registerWrongAnswer(...)`
  - `rescheduleOnCorrectAnswer(...)`
- `server/quiz/answer.ts` は review 更新の詳細を持たず、上記 command を呼ぶだけにする

---

### 🔴 Critical 2: 認証責務の境界が曖昧（再利用性低下リスク）

`server/history/*` の依存先に `lib/auth` を含めていますが、domain 関数が内部で `requireUserId()` を持つ設計は、他ドメインからの再利用時に隠れた副作用を作りやすいです。

Server Action / page で userId を確定し、server 層には明示的に渡す構成の方が依存方向を保ちやすくなります。

**改善提案**

- `server/history/record.ts`
  - `recordAttempt(input & { userId: string })` に変更
- `server/history/query.ts`
  - `getHistorySummaryQuery(userId: string)` に変更
- `lib/auth` 依存は `app/(features)/*/_api/actions.ts` と `page.tsx` 側へ寄せる

---

### 🟠 High 1: 移行手順が Big Bang 前提で、差分が大きすぎる

設計書は最終形が中心で、段階的移行の記述が不足しています。`learn/_api/mutations.ts` 分割・import 置換・テスト移行を一気に行うと、レビュー/デバッグ負荷が高くなります。

**改善提案（段階移行）**

1. `server/*` 新設＋既存処理をコピー（呼び出し元はまだ変えない）
2. `learn/_api/actions.ts` だけ `server/*` を参照
3. `page.tsx` / `HistoryPage.tsx` の query import を移行
4. テスト import を移行
5. 旧 `app/(features)/*/_api/{mutations,query}.ts` を削除

各ステップを別 PR に分けると安全です。

---

### 🟠 High 2: 依存ルールの「運用強制」がない

設計方針では依存方向を定義していますが、運用時に逸脱を防ぐ仕組みが書かれていません。

**改善提案**

- ESLint `no-restricted-imports` で以下を禁止
  - `app/(features)/learn/**` から `app/(features)/history/**` への直接 import
  - `app/(features)/**` から `app/(features)/**/_api/*` の feature 横断 import
- `src/server/**` に `import "server-only";` を必須化

---

### 🟡 Medium 1: 型配置方針をもう一段明記した方がよい

`Mode`, `QuestionRecord`, `SessionRecord` を `server/quiz/types.ts` に移す方針は妥当ですが、将来 client component が必要とする型まで server 専用に寄せると境界が曖昧になります。

**改善提案**

- 「server 内部型」と「UI 共有 DTO」を分離して定義する
  - 例: `server/quiz/types.ts`（内部）
  - 例: `app/(features)/learn/_types/view-model.ts`（UI 表示用）

---

### 🟡 Medium 2: 完了条件（Done Definition）が不足

設計としての完了基準が「フォルダ移動」中心になっており、品質ゲートが弱いです。

**改善提案**

- 完了条件に以下を追加
  - `pnpm run lint` 成功
  - `pnpm run test:run` 成功
  - `pnpm run format:check` 成功
  - `app/(features)/**/_api` から business logic が削除され、委譲のみであること

---

## 推奨追記（設計書にそのまま足せる内容）

- `server/review/command.ts` を追加する
- server 関数は原則 `userId` を引数で受け取る（内部で auth しない）
- 段階移行の 5 ステップを明記する
- ESLint で依存方向を機械的に強制する
- 完了条件に lint/test/format と層責務チェックを追加する

---

## 最終判定

**Approve with changes（要修正で承認）**。

設計の主方向は正しいため進行可能ですが、上記 Critical 2点（review 書き込み責務 / 認証責務境界）を先に設計へ反映してから実装に入ることを推奨します。
