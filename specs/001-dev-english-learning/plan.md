# Implementation Plan: プログラマー向け英語学習サイト（MVP）

**Branch**: `001-dev-english-learning` | **Date**: 2026-01-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from [spec.md](spec.md)

## Summary

- ユーザーが入力した公開ドキュメントURL（1ページのみ）を本文抽出し、単語モード/読解モードの4択クイズを（最大）10問単位で出題する。
- 回答確定後に「正誤 + 解説（英語の意味/技術背景/使用シーン）+ 出典（引用テキスト + 元URL）」を表示する。
- 未ログインでも学習は可能。ログイン時（Clerk）は Attempt を Cloudflare D1 に永続化し、履歴集計（問題数/正答率/学習日数）を表示する。

## Technical Context

**Language/Version**: TypeScript（Node.js LTS）  
**Primary Dependencies**: Next.js（App Router）, Hono（RPC）, Drizzle, Cloudflare D1, Clerk, OpenAI API, @mozilla/readability, linkedom/worker, turndown, valibot, TailwindCSS, shadcn/ui  
**Storage**: Cloudflare D1（SQLite）  
**Testing**: Vitest（unit/integration）  
**Target Platform**: Cloudflare Workers（OpenNext）  
**Project Type**: web（Next.js App Router）  
**Performance Goals**: SC-001「有効URL入力→最初の問題表示まで3秒以内」を最優先  
**Constraints**:
- Server Components First（`"use client"` を末端に閉じ込め、Client Boundary を最小化）
- server-only なモジュール（DB/secret/fetch layer）は `server-only` で保護する
- lint/format は ESLint + Prettier（Biome は使わない）
- OpenAI API は server side のみで呼び出し、timeout/出力上限を固定する
**Scale/Scope**: MVP（URL 1ページのみ、10問単位、未ログイン可/ログインで永続化）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- I. Code Quality: TypeScript + lint/format を前提にし、error handling を共通化する。
- II. Testing Standards: 主要な API contract / integration test を用意し、flaky を避ける。
- III. UX Consistency: 既存の component/pattern を reuse。UI検討は Constitution の UI Design Thinking フォーマットに従う。
- IV. Performance Requirements: SC-001 を gate とし、AI call は timeout + 出力上限制御を必須にする。
- V. Simplicity & Maintainability: Next.js App Router を中心に、MVPで境界（packages/backend分離等）を増やさない。
- 追加 gate（設計原則）: Server Components First / `server-only` / Composition パターンを優先し、Client Components の利用理由を明記する。

## Project Structure

### Documentation (this feature)

```text
specs/001-dev-english-learning/
├── plan.md              # This file (/speckit.plan)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── openapi.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
frontend/                          # Next.js app（create-next-app で生成）
├── src/
│   ├── app/                       # App Router
│   │   ├── (marketing)/
│   │   │   └── page.tsx
│   │   ├── (features)/
│   │   │   ├── layout.tsx
│   │   │   ├── mode/
│   │   │   │   ├── page.tsx               # routing only → _components/ModePage.tsx
│   │   │   │   ├── _api/
│   │   │   │   │   ├── actions.ts         # Server Actions
│   │   │   │   │   └── query.ts           # client fetch が必要な場合のみ
│   │   │   │   ├── _components/
│   │   │   │   │   ├── ModePage.tsx       # Container（Server Components: data fetch のみ）
│   │   │   │   │   └── ...                # Presentational / Client Components
│   │   │   │   ├── _hooks/
│   │   │   │   └── _utils/
│   │   │   ├── session/
│   │   │   │   ├── page.tsx               # routing only（必要なら redirect 等）
│   │   │   │   ├── [sessionId]/
│   │   │   │   │   ├── page.tsx           # routing only → ../_components/SessionPage.tsx
│   │   │   │   │   └── complete/
│   │   │   │   │       └── page.tsx       # routing only → ../../_components/SessionCompletePage.tsx
│   │   │   │   ├── _api/
│   │   │   │   │   ├── actions.ts
│   │   │   │   │   └── query.ts
│   │   │   │   ├── _components/
│   │   │   │   │   ├── SessionPage.tsx
│   │   │   │   │   ├── SessionComplete.tsx
│   │   │   │   │   └── ...
│   │   │   │   ├── _hooks/
│   │   │   │   └── _utils/
│   │   │   ├── history/
│   │   │   │   ├── page.tsx               # routing only → _components/HistoryPage.tsx
│   │   │   │   ├── _api/
│   │   │   │   │   ├── actions.ts
│   │   │   │   │   └── query.ts
│   │   │   │   ├── _components/
│   │   │   │   │   ├── HistoryPage.tsx
│   │   │   │   │   └── ...
│   │   │   │   ├── _hooks/
│   │   │   │   └── _utils/
│   │   │   └── document/
│   │   │       ├── page.tsx               # routing only → _components/DocumentPage.tsx
│   │   │       ├── _api/
│   │   │       │   ├── actions.ts
│   │   │       │   └── query.ts
│   │   │       ├── _components/
│   │   │       │   ├── DocumentPage.tsx
│   │   │       │   └── ...
│   │   │       ├── _hooks/
│   │   │       └── _utils/
│   │   ├── api/
│   │   │   └── [[...route]]/
│   │   │       └── route.ts       # Hono catch-all
│   │   └── globals.css
│   ├── components/                # shared UI（shadcn/ui）
│   ├── db/
│   │   ├── schema.ts
│   │   └── migrations/
│   └── middleware.ts
└── tests/
    ├── integration/
    └── unit/
```

**Structure Decision**: feature ごとの実装は `frontend/src/app/(features)/<feature>` にコロケーションし、`page.tsx` は routing の責務のみを担う。実 UI は `_components` 配下へ集約し、RSC-first を前提に Client Boundary を最小化する。

### UI Folder Rules（Colocation + Container/Presentational）

- `frontend/src/app/(features)/<feature>/page.tsx` は routing の責務のみを担い、`_components/<Feature>Page.tsx` を呼び出す。
    - 例: `frontend/src/app/(features)/auth/page.tsx` → `_components/AuthPage.tsx`
- `_components/<Feature>Page.tsx` は Container とし、データフェッチなどの server-side 処理のみを担う（RSC）。
- 具体的な UI（Presentational / Client Components）は `_components/` 配下に実装する。
- `hooks`（state/event を含む custom hooks）は `_hooks/` に定義する。
- data mutation は `_api/actions.ts`（Server Actions）を基本とし、client fetch が必要な場合のみ `_api/query.ts` を用意する。
- feature 内の補助関数は `_utils/` に置く（必要な場合のみ）。

## Complexity Tracking

N/A
