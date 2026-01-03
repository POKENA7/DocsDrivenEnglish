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

### DocumentSource

- Purpose: 学習対象となる入力URL（1ページ）と取得結果のメタデータ

Fields:
- `documentSourceId` (string, required, unique)
- `inputUrl` (string, required)
- `canonicalUrl` (string, required)
- `fetchedAt` (datetime, required)
- `title` (string, optional)
- `contentHash` (string, required) — 同一ページ判定用

Validation:
- `inputUrl` は `https://` を推奨（`http://` は許容するかは実装で決定）
- URL長の上限を設定（例: 2048 chars）

### LearningCorpus

- Purpose: DocumentSource から抽出した本文を「出題可能な教材」として保持する

Fields:
- `corpusId` (string, required, unique)
- `documentSourceId` (FK, required)
- `extractedText` (string, required) — 出題生成の基礎
- `extractedMarkdown` (string, optional) — code block を保持した表現
- `sourceQuoteText` (string, required) — FR-011 用の短い引用
- `sourceUrl` (string, required) — 入力URL
- `createdAt` (datetime, required)
- `extractionMeta` (json/string, optional) — 抽出方式/閾値/制限等

Relationship:
- DocumentSource 1 - 1..N LearningCorpus（入力URLを再学習した場合に複数生成し得る）

### ExtractedTerm

- Purpose: 単語モード出題の候補

Fields:
- `termId` (string, required, unique)
- `corpusId` (FK, required)
- `term` (string, required) — 例: "deprecated", "workaround"
- `frequency` (number, required)
- `exampleSentence` (string, optional) — 文脈表示用

Validation:
- 機能語（冠詞/前置詞/助動詞など）は除外（FR-005）

### Question

- Purpose: 出題単位（単語/読解）

Fields:
- `questionId` (string, required, unique)
- `corpusId` (FK, required)
- `mode` (enum: "word" | "reading", required)
- `prompt` (string, required) — 問題文
- `choices` (array[4] of string, required)
- `correctIndex` (number 0..3, required)
- `explanation` (string, required) — 英語の意味 + 技術背景 + 使用シーン（FR-010）
- `sourceQuoteText` (string, required)
- `sourceUrl` (string, required)
- `createdAt` (datetime, required)

### StudySession

- Purpose: 10問単位の学習セッション（FR-018/FR-019）

Fields:
- `sessionId` (string, required, unique)
- `userId` (FK to User, optional) — 未ログインは null
- `corpusId` (FK, required)
- `mode` (enum, required)
- `plannedCount` (number, required) — 原則10
- `actualCount` (number, required) — 10未満の場合はX
- `createdAt` (datetime, required)
- `completedAt` (datetime, optional)

### Attempt

- Purpose: 1問の回答結果

Fields:
- `attemptId` (string, required, unique)
- `sessionId` (FK, required)
- `questionId` (FK, required)
- `selectedIndex` (number 0..3, required)
- `isCorrect` (boolean, required)
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
