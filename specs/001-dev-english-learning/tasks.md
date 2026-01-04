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

補足:
- spec.md の "User Scenarios & Testing" が mandatory のため、本 tasks.md では各 User Story に test task（自動/手動）を含める
- tech term は英語のまま表記する

## Phase 1: Setup（Shared Infrastructure）

**Purpose**: プロジェクト初期化と開発基盤の整備（Next.js / Cloudflare / lint / test）

- [ ] T001 Next.js App Router（TypeScript）を公式推奨で初期化し `frontend/` を作成（`frontend/package.json`, `frontend/src/app/layout.tsx`）
- [ ] T002 App Router の route colocation 方針どおり、features の雛形を作成（`frontend/src/app/(features)/mode/`, `frontend/src/app/(features)/session/`, `frontend/src/app/(features)/history/`）
- [ ] T003 [P] Prettier を導入し ESLint と競合しない設定を追加（`frontend/.prettierrc.cjs`, `frontend/.prettierignore`, `frontend/package.json`）
- [ ] T004 [P] Vitest を導入し unit/integration の土台を作成（`frontend/vitest.config.ts`, `frontend/tests/unit/`, `frontend/tests/integration/`）
- [ ] T005 [P] shadcn/ui を初期化し design system primitives を利用可能にする（`frontend/components.json`, `frontend/src/components/`）
- [ ] T006 Cloudflare Workers（OpenNext）+ Wrangler の最小設定を追加（`frontend/wrangler.toml`, `frontend/package.json`）
- [ ] T007 quickstart の2モード手順（next dev / production-like）を README に反映（`README.md`）

---

## Phase 2: Foundational（Blocking Prerequisites）

**Purpose**: 全 user story に共通する基盤（DB / API / auth / error handling / validation）

- [ ] T008 Drizzle + Cloudflare D1 の初期セットアップ（client/schema）を追加（`frontend/src/db/client.ts`, `frontend/src/db/schema.ts`）
- [ ] T009 D1 migration（generate/apply）を scripts 化し quickstart と一致させる（`frontend/drizzle.config.ts`, `frontend/package.json`, `specs/001-dev-english-learning/quickstart.md`）
- [ ] T010 [P] env/secrets を valibot で validation する（server-only）仕組みを追加（`frontend/src/server/env.ts`）
- [ ] T011 Next.js API Routes catch-all + Hono app の基盤を実装（`frontend/src/app/api/[[...route]]/route.ts`, `frontend/src/app/api/[[...route]]/app.ts`）
- [ ] T012 [P] API の共通 error 形式と mapping を作成（`frontend/src/app/api/[[...route]]/errors.ts`）
- [ ] T013 [P] OpenAI client を server side のみでラップし、timeout / max output を固定（`frontend/src/server/openai/client.ts`）
- [ ] T014 [P] HTML fetch + Readability + turndown の抽出パイプラインを共通関数化（`frontend/src/server/document/extract.ts`）
- [ ] T015 [P] URL validation（http/https/empty 等）を共通 util として作成（`frontend/src/server/validation/url.ts`）
- [ ] T016 [P] Clerk（App Router）を導入し auth 判定 util と middleware を追加（`frontend/src/middleware.ts`, `frontend/src/server/auth.ts`）
- [ ] T017 API routing を domain ごとに分割する土台を作成（`frontend/src/app/api/[[...route]]/routes/document.ts`, `frontend/src/app/api/[[...route]]/routes/quiz.ts`, `frontend/src/app/api/[[...route]]/routes/history.ts`）

**Checkpoint**: Foundation ready - user story 実装に着手可能

---

## Phase 3: User Story 1 - ドキュメントURLからクイズ学習する（Priority: P1）🎯 MVP

**Goal**: URL入力→教材化→モード選択→（最大）10問の出題→回答→解説→次へ を完走できる

**Independent Test**: 公開ドキュメントURLを入力して、10問（または10未満なら全X問）を「出題→回答→解説→次へ」で完走できる

### Tests（US1）

- [ ] T018 [P] [US1] URL validation の unit test を追加（`frontend/tests/unit/url-validation.test.ts`）
- [ ] T019 [P] [US1] document extraction（Readability + turndown）の unit test を追加（`frontend/tests/unit/document-extract.test.ts`）
- [ ] T020 [P] [US1] `POST /api/quiz/session`（url+mode）成功の integration test を追加（`frontend/tests/integration/quiz-session.test.ts`）
- [ ] T021 [P] [US1] `POST /api/quiz/session`（URL不正/取得失敗/抽出失敗）の integration test を追加（`frontend/tests/integration/quiz-session-errors.test.ts`）
- [ ] T022 [P] [US1] `POST /api/quiz/answer` の integration test を追加（`frontend/tests/integration/quiz-answer.test.ts`）

### Implementation（US1）

- [ ] T023 [US1] D1 schema（StudySession/Question の最小）を追加し migration を生成（`frontend/src/db/schema.ts`, `frontend/src/db/migrations/`）
- [ ] T024 [US1] quiz 生成（word/reading, 4 choices, function words exclude）を実装（`frontend/src/server/quiz/generate.ts`）
- [ ] T025 [US1] 解説生成（英語の意味 + 技術背景 + 使用シーン）を session start 時に各Questionにつき1つ生成する（`frontend/src/server/quiz/explain.ts`）
- [ ] T026 [US1] Session/Question の永続化（作成/取得）を repository として実装（`frontend/src/server/repositories/sessionRepo.ts`）
- [ ] T027 [US1] `POST /api/quiz/session` の入力（url+mode）validation と error mapping を実装（`frontend/src/app/api/[[...route]]/routes/quiz.ts`, `frontend/src/app/api/[[...route]]/errors.ts`）
- [ ] T028 [US1] `POST /api/quiz/session`（URL→fetch→extract→最大10問+解説生成→session開始）を実装（`frontend/src/app/api/[[...route]]/routes/quiz.ts`）
- [ ] T029 [US1] `POST /api/quiz/answer`（採点 + 解説 + 出典）を実装（`frontend/src/app/api/[[...route]]/routes/quiz.ts`）
- [ ] T030 [US1] URL入力（Top）画面を実装（`frontend/src/app/(marketing)/page.tsx`, `frontend/src/app/(marketing)/_components/StartForm.tsx`）
- [ ] T031 [US1] Mode 選択画面を実装（`frontend/src/app/(features)/mode/page.tsx`, `frontend/src/app/(features)/mode/_components/ModePage.tsx`）
- [ ] T032 [US1] Quiz 画面（問題表示/選択/確定→結果表示→次へ）を実装（`frontend/src/app/(features)/session/[sessionId]/page.tsx`, `frontend/src/app/(features)/session/_components/SessionPage.tsx`）
- [ ] T033 [US1] セッション完了（10問 or 全X問）UI と「続行（次の10問）」導線を実装（`frontend/src/app/(features)/session/[sessionId]/complete/page.tsx`, `frontend/src/app/(features)/session/_components/SessionCompletePage.tsx`）
- [ ] T034 [US1] 出典表示（引用テキスト + 元URL）を UI に組み込む（`frontend/src/app/(features)/session/_components/SourceAttribution.tsx`）

Note（RSC）:
- page/layout は Server Components を維持し、インタラクションが必要な最小の部品のみ `"use client"` に分離する（Composition パターンを優先）

**Checkpoint**: US1 が単独で完走できる

---

## Phase 4: User Story 2 - 未ログインでも学習を続けられる（Priority: P2）

**Goal**: 未ログインでも学習でき、セッション中の集計が見える。履歴画面はログイン誘導を表示する。

**Independent Test**: 未ログインで5問回答し、セッション内で「学習した問題数」「正答率」が更新され、履歴画面で永続化されない旨とログイン誘導が表示される

### Tests（US2）

- [ ] T035 [P] [US2] 未ログイン体験の manual test checklist を追加（`specs/001-dev-english-learning/checklists/requirements.md`）

### Implementation（US2）

- [ ] T036 [US2] セッション内集計（attemptCount/correctRate）を表示する UI を追加（`frontend/src/app/(features)/session/_components/SessionProgress.tsx`）
- [ ] T037 [US2] 履歴画面（未ログイン時は永続化されない旨 + login CTA）を実装（`frontend/src/app/(features)/history/page.tsx`, `frontend/src/app/(features)/history/_components/HistoryPage.tsx`）

**Checkpoint**: 未ログインでの体験が誤解なく成立する

---

## Phase 5: User Story 3 - ログインで学習履歴が永続化される（Priority: P3）

**Goal**: ログインユーザーの Attempt を永続化し、履歴集計（問題数/正答率/継続学習日数）を参照できる

**Independent Test**: ログイン状態で学習→履歴表示→ログアウト→再ログイン→履歴が残る、を確認できる

### Tests（US3）

- [ ] T038 [P] [US3] `GET /api/history/summary` の認可（401/200）を integration test（`frontend/tests/integration/history-summary.test.ts`）
- [ ] T039 [P] [US3] studyDays（distinct days）集計の unit test を追加（`frontend/tests/unit/history-aggregate.test.ts`）

### Implementation（US3）

- [ ] T040 [US3] Attempt の保存を「ログイン時のみ userId 付き」で行う repository を実装（`frontend/src/server/repositories/attemptRepo.ts`）
- [ ] T041 [US3] history 集計 service（attemptCount/correctRate/studyDays）を実装（`frontend/src/server/history/summary.ts`）
- [ ] T042 [US3] `GET /api/history/summary` を実装（`frontend/src/app/api/[[...route]]/routes/history.ts`）
- [ ] T043 [US3] 履歴画面（ログイン時は集計表示、未ログイン時は誘導）を完成（`frontend/src/app/(features)/history/_components/HistoryPage.tsx`）
- [ ] T044 [US3] Clerk UI（Sign in/out）導線を最小箇所に追加（`frontend/src/app/(features)/layout.tsx`, `frontend/src/app/(features)/_components/AuthButton.tsx`）

**Checkpoint**: ログインユーザーの履歴が永続化される

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 複数 story に跨る改善（性能/運用/ドキュメント）

Note（RSC / Client Boundary）:
- `page.tsx` / `layout.tsx` は原則 Server Components を維持する
- state/event が必要な部品のみ route segment 配下の `_components` に切り出して `"use client"` を付ける

- [ ] T045 API error と UI error を統一し、edge case（URL不正/timeout/抽出失敗）で理由が分かる文言に揃える（`frontend/src/app/api/[[...route]]/errors.ts`, `frontend/src/app/(marketing)/_components/StartForm.tsx`）
- [ ] T046 生成コスト/速度のため、解説生成を session start 時にまとめて行い、OpenAI call の timeout/max output を最終調整（`frontend/src/server/openai/client.ts`, `frontend/src/server/quiz/explain.ts`）
- [ ] T047 [P] OpenAPI と実装の差分をレビューし、必要なら契約を更新（`specs/001-dev-english-learning/contracts/openapi.yaml`）
- [ ] T048 [P] quickstart を実行検証し、差分があれば更新（`specs/001-dev-english-learning/quickstart.md`）

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

## User Story Dependencies

- US1（P1）: Phase 2 完了後に開始可能（他USへの依存なし）
- US2（P2）: US1 の UI/セッション表示が前提（同じ session 画面へ機能追加）
- US3（P3）: Clerk（auth）+ DB（Attempt 保存/集計）に依存（Phase 2 完了後、US1 の flow があると検証しやすい）

## Parallel Opportunities（例）

- Setup: T003/T004/T005 は並列可能
- Foundational: T010/T012/T013/T014/T015/T016/T017 は並列可能
- US1: T018/T019/T020/T021/T022（tests）と、T023（schema/migration）は並列に進めやすい

## Parallel Examples（User Story 別）

### US1

```text
例: US1 を並列で進める

Tests:
- T018, T019, T020, T021, T022

DB/Schema:
- T023

API/Logic:
- T024, T025, T026, T027, T028, T029

UI:
- T030, T031, T032, T033, T034
```

### US2

```text
例: US2 を並列で進める

Tests:
- T035

UI:
- T036, T037
```

### US3

```text
例: US3 を並列で進める

Tests:
- T038, T039

API/DB:
- T040, T041, T042

UI:
- T043, T044
```

## Implementation Strategy

- **MVP scope**: Phase 1〜3（US1）を最短で end-to-end で成立させる
- US1 完了後に、未ログイン UX（US2）→ 永続化（US3）を追加する
