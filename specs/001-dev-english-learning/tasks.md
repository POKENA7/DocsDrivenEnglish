---
description: "Task list for feature implementation"
---

# Tasks: プログラマー向け英語学習サイト（MVP）

**Input**: Design documents from `/specs/001-dev-english-learning/`

- plan.md: [plan.md](plan.md)
- spec.md: [spec.md](spec.md)
- data model: [data-model.md](data-model.md)
- contracts: [contracts/openapi.yaml](contracts/openapi.yaml)
- research: [research.md](research.md)
- quickstart: [quickstart.md](quickstart.md)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: parallelizable（別ファイルで衝突しない / 依存がない）
- **[US1]** など: 該当 user story
- すべてのタスクは具体的な file path を含む

## Phase 1: Setup（Shared Infrastructure）

**Purpose**: プロジェクト初期化と開発基盤の整備（Next.js / Cloudflare / lint / test）

- [ ] T001 リポジトリ直下の基本構造を作成（`src/app`, `src/features`, `src/db`, `src/lib`, `tests/`）
- [ ] T002 Next.js App Router（TypeScript）を初期化し、`src/` 配下に配置する設定を追加（`tsconfig.json`, `next.config.ts`, `package.json`）
- [ ] T003 [P] biome を導入し format/lint を設定（`biome.json`, `package.json` scripts）
- [ ] T004 [P] vitest を導入し unit/integration の土台を作成（`vitest.config.ts`, `tests/unit`, `tests/integration`）
- [ ] T005 [P] TailwindCSS + shadcn/ui を導入し、design system primitives を有効化（`tailwind.config.*`, `src/app/globals.css`）
- [ ] T006 Cloudflare Workers（OpenNext）+ Wrangler の最小設定を追加（`wrangler.toml` と build/preview scripts）
- [ ] T007 local dev 2モード手順を `README.md` に反映（[quickstart.md](quickstart.md) と整合）

---

## Phase 2: Foundational（Blocking Prerequisites）

**Purpose**: 全 user story に共通する基盤（DB / API / auth / error handling / validation）

- [ ] T008 Drizzle + D1 の初期セットアップ（`src/db/schema.ts`, `src/db/migrations/`）
- [ ] T009 D1 migration 運用（generate/apply）を scripts 化（`package.json` scripts、[quickstart.md](quickstart.md) と一致）
- [ ] T010 [P] valibot による request/response validation の共通 util を作成（`src/lib/validation.ts`）
- [ ] T011 [P] API の共通 error 形式と handler を作成（`src/lib/errors.ts`, `src/lib/http.ts`）
- [ ] T012 Next.js API Routes catch-all + Hono RPC の基盤を実装（`src/app/api/[[...route]]/route.ts`, `src/lib/hono.ts`）
- [ ] T013 [P] Hono router を feature ごとに分割する土台を作成（`src/features/document/api.ts`, `src/features/quiz/api.ts`, `src/features/history/api.ts`）
- [ ] T014 [P] Clerk の導入（App Router）と auth 判定の共通 util を作成（`src/features/auth/clerk.ts`, `src/middleware.ts`）
- [ ] T015 ロギング（最低限）を整備（`src/lib/logger.ts`）
- [ ] T016 OpenAI API client（Workers secrets 前提）をラップし、timeout と出力上限を固定（`src/lib/openai.ts`）
- [ ] T017 [P] HTML fetch + Readability + turndown の抽出パイプラインを共通関数化（`src/features/document/extract.ts`）

**Checkpoint**: Foundation ready - user story 実装に着手可能

---

## Phase 3: User Story 1 - ドキュメントURLからクイズ学習する（Priority: P1）🎯 MVP

**Goal**: URL入力→教材化→モード選択→（最大）10問の出題→回答→解説→次へ を完走できる

**Independent Test**: 公開ドキュメントURLを入力して、10問（または10未満なら全X問）を「出題→回答→解説→次へ」で完走できる

### Tests（US1）

- [ ] T018 [P] [US1] `/api/document/start` の contract/integration test を追加（`tests/integration/document-start.test.ts`）
- [ ] T019 [P] [US1] `/api/quiz/session/start` の contract/integration test を追加（`tests/integration/session-start.test.ts`）
- [ ] T020 [P] [US1] `/api/quiz/answer` の contract/integration test を追加（`tests/integration/submit-answer.test.ts`）

### Implementation（US1）

- [ ] T021 [US1] URL validation（http/https, empty 等）を実装し、エラーを返せるようにする（`src/features/document/validation.ts`）
- [ ] T022 [US1] `POST /api/document/start` を実装（fetch→extract→corpus 作成→`corpusId/sourceUrl/sourceQuoteText/title` を返す）（`src/features/document/api.ts`）
- [ ] T023 [P] [US1] D1 schema を追加（DocumentSource/LearningCorpus/Question/StudySession/Attempt の最小）し migration を生成（`src/db/schema.ts`, `src/db/migrations/*`）
- [ ] T024 [US1] quiz 生成（mode=word/reading）を実装し、最大10問（不足時はactualCount）を生成できるようにする（`src/features/quiz/generate.ts`）
- [ ] T025 [US1] `POST /api/quiz/session/start` を実装（session + questions を作成し返す）（`src/features/quiz/api.ts`）
- [ ] T026 [US1] `POST /api/quiz/answer` を実装（採点 + explanation + 出典を返す）（`src/features/quiz/api.ts`）
- [ ] T027 [US1] Top（URL入力）画面を実装（`src/app/(marketing)/page.tsx`）
- [ ] T028 [US1] Mode 選択画面を実装（`src/app/(learn)/mode/page.tsx`）
- [ ] T029 [US1] Quiz 画面（問題表示/選択/確定→結果表示→次へ）を実装（`src/app/(learn)/session/[sessionId]/page.tsx`）
- [ ] T030 [US1] セッション完了（10問 or 全X問）UI と「続行（次の10問）」導線を実装（`src/app/(learn)/session/[sessionId]/complete/page.tsx`）
- [ ] T031 [US1] 出典表示（引用テキスト + 元URL）を UI に組み込む（`src/app/(learn)/session/[sessionId]/page.tsx`）

**Checkpoint**: US1 が単独で完走できる

---

## Phase 4: User Story 2 - 未ログインでも学習を続けられる（Priority: P2）

**Goal**: 未ログインでも学習でき、セッション中の集計が見える。履歴画面はログイン誘導を表示する。

**Independent Test**: 未ログインで5問回答し、セッション内で「学習した問題数」「正答率」が更新され、履歴画面で永続化されない旨とログイン誘導が表示される

### Tests（US2）

- [ ] T032 [P] [US2] 未ログイン状態の履歴画面表示（ログイン誘導）を test（`tests/integration/history-signed-out.test.ts`）

### Implementation（US2）

- [ ] T033 [US2] セッション内集計（attemptCount/correctRate）を表示する UI を追加（`src/app/(learn)/session/[sessionId]/page.tsx`）
- [ ] T034 [US2] 履歴画面（未ログイン時はログイン誘導のみ）を実装（`src/app/(learn)/history/page.tsx`）

**Checkpoint**: 未ログインでの体験が誤解なく成立する

---

## Phase 5: User Story 3 - ログインで学習履歴が永続化される（Priority: P3）

**Goal**: ログインユーザーの Attempt を永続化し、履歴集計（問題数/正答率/継続学習日数）を参照できる

**Independent Test**: ログイン状態で学習→履歴表示→ログアウト→再ログイン→履歴が残る、を確認できる

### Tests（US3）

- [ ] T035 [P] [US3] `/api/history/summary` の認可（401/200）を test（`tests/integration/history-summary.test.ts`）

### Implementation（US3）

- [ ] T036 [US3] Attempt の保存を「ログイン時のみ userId 付き」で行うように実装（`src/features/quiz/persist.ts`）
- [ ] T037 [US3] `GET /api/history/summary` を実装（attemptCount/correctRate/studyDays を返す）（`src/features/history/api.ts`）
- [ ] T038 [US3] 履歴画面（ログイン時は集計表示、未ログイン時は誘導）を完成させる（`src/app/(learn)/history/page.tsx`）
- [ ] T039 [US3] Clerk UI（Sign in/out）導線を header など最小箇所に追加（`src/app/(learn)/layout.tsx`）

**Checkpoint**: ログインユーザーの履歴が永続化される

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 複数 story に跨る改善（性能/運用/ドキュメント）

- [ ] T040 エラー時の UX（fetch失敗/抽出失敗/AI失敗）を整理し、ユーザーに理由が分かる表示に統一（`src/lib/errors.ts`, `src/app/(learn)/*`）
- [ ] T041 SC-001（最初の問題表示まで3秒）を意識し、AI call の timeout とキャッシュ方針を実装/調整（`src/lib/openai.ts`, `src/features/quiz/generate.ts`）
- [ ] T042 [P] OpenAPI（[contracts/openapi.yaml](contracts/openapi.yaml)）と実装の差分をレビューし整合（`src/features/*/api.ts`）
- [ ] T043 [P] quickstart の手順が実際に動くことを検証し、必要なら修正（[quickstart.md](quickstart.md)）

---

## Dependencies & Execution Order

- Setup（Phase 1）→ Foundational（Phase 2）→ US1（Phase 3）→ US2（Phase 4）→ US3（Phase 5）→ Polish（Phase 6）
- US2 は US1 の UI/セッション前提に依存
- US3 は auth + DB + attempt 保存の前提に依存

```text
Dependency graph（簡易）

Phase 1 (Setup)
	↓
Phase 2 (Foundational)
	↓
US1 (P1)
	↓
US2 (P2)
	↓
US3 (P3)
	↓
Phase 6 (Polish)
```

## Parallel Opportunities（例）

- Setup: T003/T004/T005 は並列可能
- Foundational: T010/T011/T013/T014/T015/T016/T017 は並列可能
- US1: T018/T019/T020（tests）と、T023（schema/migration）は並列に進めやすい

## Parallel Examples（User Story 別）

### US1

```text
例: US1 を並列で進める

Tests:
- T018, T019, T020

DB/Schema:
- T023

UI:
- T027, T028
```

### US2

```text
例: US2 を並列で進める

Tests:
- T032

UI:
- T033, T034
```

### US3

```text
例: US3 を並列で進める

Tests:
- T035

API/DB:
- T036, T037

UI:
- T038, T039
```

## Implementation Strategy

- **MVP scope**: Phase 1〜3（US1）を最短で end-to-end で成立させる
- US1 完了後に、未ログイン UX（US2）→ 永続化（US3）を追加する
