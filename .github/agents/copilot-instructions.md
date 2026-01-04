# DocsDrivenEnglish Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-04

## Active Technologies
- TypeScript（Node.js LTS） (001-dev-english-learning)
- Next.js（App Router）, Hono RPC, TailwindCSS, shadcn/ui, Clerk, Drizzle, OpenAI API, zod, @mozilla/readability, linkedom, turndown (001-dev-english-learning)
- Cloudflare D1（SQLite） (001-dev-english-learning)


## Project Structure

```text
frontend/
	├── src/
	│   ├── app/
	│   ├── features/
	│   ├── components/
	│   ├── db/
	│   └── lib/
	└── tests/
```

## Commands

cd frontend && npm test && npm run lint

## Code Style

TypeScript（Next.js App Router）: Follow standard conventions

## Recent Changes
- 001-dev-english-learning: Added TypeScript（Node.js LTS） + Next.js（App Router）, Hono（RPC）, Drizzle, Cloudflare D1, Clerk, OpenAI API, @mozilla/readability, linkedom/worker, turndown, zod, TailwindCSS, shadcn/ui
- 001-dev-english-learning: Updated tech context from plan.md


<!-- MANUAL ADDITIONS START -->
## Folder Convention（RSC Container/Presentational）

- feature は `frontend/src/app/(features)/<feature>` にコロケーションする。
- `page.tsx` は routing のみとし、`_components/<Feature>Page.tsx` を呼び出す。
- `_components/<Feature>Page.tsx` は Container（Server Components: data fetch のみ）。具体 UI は `_components/` 配下に実装する。

## Data Mutation Convention（Server Actions / Query / Hooks）

- Server Actions は `frontend/src/app/(features)/<feature>/_api/actions.ts` に定義する（data mutation を基本とする）。
- client fetch が必要な場合は `frontend/src/app/(features)/<feature>/_api/query.ts` に定義する。
- feature の custom hooks は `frontend/src/app/(features)/<feature>/_hooks/` に定義する。

## Avoid Over-Abstraction in lib

- `frontend/src/lib` に domain logic や過度に抽象化した処理を集約しない。
- server-only で API 層専用の処理は `frontend/src/app/api/[[...route]]/`（`route.ts` と同階層）へコロケーションする。
- feature 固有の処理は `frontend/src/app/(features)/<feature>/_utils` などへコロケーションする。
<!-- MANUAL ADDITIONS END -->
