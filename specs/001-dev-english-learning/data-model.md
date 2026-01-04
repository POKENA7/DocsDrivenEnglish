# Data Model: プログラマー向け英語学習サイト（MVP）

**Created**: 2026-01-03  
**Spec**: [spec.md](spec.md)

本ドキュメントは Phase 1（Design）として、MVPに必要な entity と relationship、validation、集計の考え方を定義する。

## Entity

### User

- Purpose: 学習履歴の永続化と複数デバイス参照
- Notes:
  - Auth は Clerk を利用するため、アプリ側は `clerkUserId` を主キー相当として扱う

Fields (conceptual):
- `clerkUserId` (string, required, unique)
- `createdAt` (datetime)

### DocumentSource（optional / non-MVP）

MVPでは `/api/quiz/session` に URL入力〜本文抽出〜出題開始を一本化するため、教材（corpus）を永続化する entity は必須ではない。

一方で、将来的に同一URLの再利用（cache）や抽出の再現性を高めたい場合に備えて、DocumentSource を optional として残す。

- Purpose: 学習対象となる入力URL（1ページ）と取得結果のメタデータ（cache/運用向け）

Fields:
- `documentSourceId` (string, required, unique)
- `inputUrl` (string, required)
- `canonicalUrl` (string, optional)
- `fetchedAt` (datetime, required)
- `title` (string, optional)
- `contentHash` (string, optional) — 同一ページ判定用

Validation:
- `inputUrl` は `https://` を推奨（`http://` は許容するかは実装で決定）
- URL長の上限を設定（例: 2048 chars）

### Question

- Purpose: 出題単位（単語/読解）

Fields:
- `questionId` (string, required, unique)
- `sessionId` (FK to StudySession, required)
- `mode` (enum: "word" | "reading", required)
- `prompt` (string, required) — 問題文
- `choices` (array[4] of string, required)
- `correctIndex` (number 0..3, required)
- `explanation` (string, optional) — 英語の意味 + 技術背景 + 使用シーン（FR-010）
- `sourceQuoteText` (string, required)
- `sourceUrl` (string, required)
- `createdAt` (datetime, required)

Notes:
- 生成コスト/速度の観点から、`explanation` は session start 時に各Questionにつき1つ生成し、Question に保存する。

### StudySession

- Purpose: 10問単位の学習セッション（FR-018/FR-019）

Fields:
- `sessionId` (string, required, unique)
- `userId` (FK to User, optional) — 未ログインは null
- `inputUrl` (string, required)
- `sourceUrl` (string, required) — canonicalize 後のURLなど
- `sourceQuoteText` (string, required)
- `title` (string, optional)
- `fetchedAt` (datetime, required)
- `mode` (enum, required)
- `plannedCount` (number, required) — 原則10
- `actualCount` (number, required) — 10未満の場合はX
- `createdAt` (datetime, required)
- `completedAt` (datetime, optional)

Notes:
- 本設計では「教材（corpus）を永続化しない」ため、本文抽出結果（extractedText / extractedMarkdown）は session start 時に生成して question 生成へ利用し、必要に応じて破棄する。
- 出典表示（FR-011）のために `sourceUrl` / `sourceQuoteText` は StudySession と Question（および SubmitAnswerResponse）で参照できるようにする。

### Attempt

- Purpose: 1問の回答結果

Fields:
- `attemptId` (string, required, unique)
- `sessionId` (FK, required)
- `questionId` (FK, required)
- `selectedIndex` (number 0..3, required)
- `isCorrect` (boolean, required)
- `explanation` (string, optional) — 回答時点の解説を固定したい場合に保存する
- `answeredAt` (datetime, required)

## Derived / Aggregation

### StudySummary

表示要件（FR-015）:
- 学習した問題数: `Attempt` の件数
- 正答率: `isCorrect=true` / `Attempt` 件数
- 継続学習日数: ログインユーザーの `Attempt.answeredAt` を日付単位でユニーク集計

Notes:
- 継続学習日数は「連続 streak」ではなく「学習した日数（distinct days）」としてMVPでは扱う

## State Transitions

- StudySession:
  - Created → Completed
  - Completed は「10問目」または「最終問題（10未満）」の解説確認時に成立
