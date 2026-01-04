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

- [ ] T001 Next.js App Router（TypeScript）を公式推奨で初期化（`npx create-next-app@latest frontend --ts --eslint --tailwind --app --src-dir`）
- [ ] T002 アプリ側の基本構造を作成（`frontend/src/app`, `frontend/src/components`, `frontend/src/db`, `frontend/tests/`）
- [ ] T002 `src/app/(features)/<feature>` の雛形を用意（例: `frontend/src/app/(features)/document/{page.tsx,_components/,_hooks/,_api/,_utils/}`）
- [ ] T002 `page.tsx` は routing のみ、`_components/<Feature>Page.tsx` を呼ぶルールを徹底する（例: `DocumentPage.tsx`）
- [ ] T003 [P] ESLint（Next 標準）+ Prettier を導入し format/lint を設定（`frontend/.prettierrc*`, `frontend/.prettierignore`, `frontend/package.json` scripts、`npm install -D prettier eslint-config-prettier`）
- [ ] T004 [P] Vitest を導入し unit/integration の土台を作成（`frontend/vitest.config.ts`, `frontend/tests/unit`, `frontend/tests/integration`）
- [ ] T005 [P] shadcn/ui を公式推奨で初期化し、design system primitives を有効化（`cd frontend && npx shadcn@latest init`、`frontend/src/app/globals.css`）
- [ ] T006 Cloudflare Workers（OpenNext）+ Wrangler の最小設定を追加（`frontend/wrangler.toml` と build/preview scripts）
- [ ] T007 local dev 2モード手順を `README.md` に反映（[quickstart.md](quickstart.md) と整合）

---

## Phase 2: Foundational（Blocking Prerequisites）

**Purpose**: 全 user story に共通する基盤（DB / API / auth / error handling / validation）

- [ ] T008 Drizzle + D1 の初期セットアップ（`frontend/src/db/schema.ts`, `frontend/src/db/migrations/`）
- [ ] T009 D1 migration 運用（generate/apply）を scripts 化（`frontend/package.json` scripts、[quickstart.md](quickstart.md) と一致）
- [ ] T010 [P] valibot の schema は feature にコロケーションして定義（例: `frontend/src/app/(features)/document/_utils/validation.ts`）
- [ ] T011 [P] API の共通 error 形式と handler を作成（`frontend/src/app/api/[[...route]]/errors.ts`, `frontend/src/app/api/[[...route]]/http.ts`）
- [ ] T012 Next.js API Routes catch-all + Hono RPC の基盤を実装（`frontend/src/app/api/[[...route]]/route.ts`, `frontend/src/app/api/[[...route]]/hono.ts`）
- [ ] T013 [P] Hono router を feature ごとに分割する土台を作成（`frontend/src/app/(features)/document/_api/route.ts`, `frontend/src/app/(features)/session/_api/route.ts`, `frontend/src/app/(features)/history/_api/route.ts`）
- [ ] T014 [P] Clerk の導入（App Router）と auth 判定の共通 util を作成（`frontend/src/middleware.ts` と、必要なら `(features)/auth/_api/*`）
- [ ] T015 ロギング（最低限）を整備（`frontend/src/app/api/[[...route]]/logger.ts`）
- [ ] T016 OpenAI API client（Workers secrets 前提）をラップし、timeout と出力上限を固定（`frontend/src/app/api/[[...route]]/openai.ts`）
- [ ] T017 [P] HTML fetch + Readability + turndown の抽出パイプラインを共通関数化（`frontend/src/app/(features)/document/_utils/extract.ts`）

**Checkpoint**: Foundation ready - user story 実装に着手可能

---

## Phase 3: User Story 1 - ドキュメントURLからクイズ学習する（Priority: P1）🎯 MVP

**Goal**: URL入力→教材化→モード選択→（最大）10問の出題→回答→解説→次へ を完走できる

**Independent Test**: 公開ドキュメントURLを入力して、10問（または10未満なら全X問）を「出題→回答→解説→次へ」で完走できる

### Tests（US1）

- [ ] T018 [P] [US1] `/api/document/start` の contract/integration test を追加（`frontend/tests/integration/document-start.test.ts`）
- [ ] T019 [P] [US1] `/api/quiz/session/start` の contract/integration test を追加（`frontend/tests/integration/session-start.test.ts`）
- [ ] T020 [P] [US1] `/api/quiz/answer` の contract/integration test を追加（`frontend/tests/integration/submit-answer.test.ts`）

### Implementation（US1）

- [ ] T021 [US1] URL validation（http/https, empty 等）を実装し、エラーを返せるようにする（`frontend/src/app/(features)/document/_utils/validation.ts`）
- [ ] T022 [US1] Server Actions で「URL入力→fetch→extract→corpus 作成」を実装（`frontend/src/app/(features)/document/_api/actions.ts`）
- [ ] T022a [US1] `/api/document/start` を実装（contract test 用の Route Handler / RPC entry）（`frontend/src/app/(features)/document/_api/route.ts`）
- [ ] T023 [P] [US1] D1 schema を追加（DocumentSource/LearningCorpus/Question/StudySession/Attempt の最小）し migration を生成（`frontend/src/db/schema.ts`, `frontend/src/db/migrations/*`）
- [ ] T024 [US1] quiz 生成（mode=word/reading）を実装し、最大10問（不足時はactualCount）を生成できるようにする（`frontend/src/app/(features)/session/_utils/generate.ts`）
- [ ] T025 [US1] Server Actions で session start を実装（`frontend/src/app/(features)/session/_api/actions.ts`）
- [ ] T025a [US1] `/api/quiz/session/start` を実装（contract test 用の Route Handler / RPC entry）（`frontend/src/app/(features)/session/_api/route.ts`）
- [ ] T026 [US1] Server Actions で answer submit を実装（`frontend/src/app/(features)/session/_api/actions.ts`）
- [ ] T026a [US1] `/api/quiz/answer` を実装（contract test 用の Route Handler / RPC entry）（`frontend/src/app/(features)/session/_api/route.ts`）
- [ ] T027 [US1] Top（URL入力）画面を実装（`frontend/src/app/(marketing)/page.tsx`）
- [ ] T028 [US1] Mode 選択画面を実装（routing only: `frontend/src/app/(features)/mode/page.tsx` → `frontend/src/app/(features)/mode/_components/ModePage.tsx`）
- [ ] T029 [US1] Quiz 画面（問題表示/選択/確定→結果表示→次へ）を実装（routing only: `frontend/src/app/(features)/session/[sessionId]/page.tsx` → `frontend/src/app/(features)/session/_components/SessionPage.tsx`）
- [ ] T030 [US1] セッション完了（10問 or 全X問）UI と「続行（次の10問）」導線を実装（routing only: `frontend/src/app/(features)/session/[sessionId]/complete/page.tsx` → `frontend/src/app/(features)/session/_components/SessionCompletePage.tsx`）
- [ ] T031 [US1] 出典表示（引用テキスト + 元URL）を UI に組み込む（`frontend/src/app/(features)/session/_components/*`）

Note（RSC）:
- page/layout は Server Components を維持し、インタラクションが必要な最小の部品のみ `"use client"` に分離する（Composition パターンを優先）

**Checkpoint**: US1 が単独で完走できる

---

## Phase 4: User Story 2 - 未ログインでも学習を続けられる（Priority: P2）

**Goal**: 未ログインでも学習でき、セッション中の集計が見える。履歴画面はログイン誘導を表示する。

**Independent Test**: 未ログインで5問回答し、セッション内で「学習した問題数」「正答率」が更新され、履歴画面で永続化されない旨とログイン誘導が表示される

### Tests（US2）

- [ ] T032 [P] [US2] 未ログイン状態の履歴画面表示（ログイン誘導）を test（`frontend/tests/integration/history-signed-out.test.ts`）

### Implementation（US2）

- [ ] T033 [US2] セッション内集計（attemptCount/correctRate）を表示する UI を追加（`frontend/src/app/(features)/session/_components/*`）
- [ ] T034 [US2] 履歴画面（未ログイン時はログイン誘導のみ）を実装（routing only: `frontend/src/app/(features)/history/page.tsx` → `frontend/src/app/(features)/history/_components/HistoryPage.tsx`）

**Checkpoint**: 未ログインでの体験が誤解なく成立する

---

## Phase 5: User Story 3 - ログインで学習履歴が永続化される（Priority: P3）

**Goal**: ログインユーザーの Attempt を永続化し、履歴集計（問題数/正答率/継続学習日数）を参照できる

**Independent Test**: ログイン状態で学習→履歴表示→ログアウト→再ログイン→履歴が残る、を確認できる

### Tests（US3）

- [ ] T035 [P] [US3] `/api/history/summary` の認可（401/200）を test（`frontend/tests/integration/history-summary.test.ts`）

### Implementation（US3）

- [ ] T036 [US3] Attempt の保存を「ログイン時のみ userId 付き」で行うように実装（`frontend/src/app/(features)/session/_utils/persist.ts`）
- [ ] T037 [US3] `GET /api/history/summary` を実装（attemptCount/correctRate/studyDays を返す）（`frontend/src/app/(features)/history/_api/route.ts`）
- [ ] T037a [P] [US3] 履歴取得の client fetch wrapper を用意（必要な場合のみ）（`frontend/src/app/(features)/history/_api/query.ts`）
- [ ] T038 [US3] 履歴画面（ログイン時は集計表示、未ログイン時は誘導）を完成させる（`frontend/src/app/(features)/history/_components/*`）
- [ ] T039 [US3] Clerk UI（Sign in/out）導線を header など最小箇所に追加（`frontend/src/app/(features)/layout.tsx`）

**Checkpoint**: ログインユーザーの履歴が永続化される

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 複数 story に跨る改善（性能/運用/ドキュメント）

- [ ] T040 エラー時の UX（fetch失敗/抽出失敗/AI失敗）を整理し、ユーザーに理由が分かる表示に統一（`frontend/src/app/api/[[...route]]/errors.ts`, `frontend/src/app/(features)/*`）
- [ ] T041 SC-001（最初の問題表示まで3秒）を意識し、AI call の timeout とキャッシュ方針を実装/調整（`frontend/src/app/api/[[...route]]/openai.ts`, `frontend/src/app/(features)/session/_utils/generate.ts`）
- [ ] T042 [P] OpenAPI（[contracts/openapi.yaml](contracts/openapi.yaml)）と実装の差分をレビューし整合（`frontend/src/app/(features)/*/_api/route.ts`）

Note（RSC / Client Boundary）:
- `page.tsx` / `layout.tsx` は原則 Server Components を維持する。
- state/event が必要な部品のみ `frontend/src/components/*` や route segment 配下の `_components` に切り出して `"use client"` を付ける。
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
