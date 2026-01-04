# AGENTS.md

このファイルは coding agent 向けの作業手引きです（human 向けの概要は README.md を参照）。

## 基本ルール

- 返答は日本語で行うこと
- ドキュメントは日本語で記述すること
- 技術用語（Next.js / Cloudflare Workers / D1 / Wrangler / Drizzle / Vitest など）は英語のまま記載すること

## Project Overview

DocsDrivenEnglish は、公開ドキュメントURLから教材を生成し、最大10問単位のクイズで学習する「プログラマー向け英語学習サイト（MVP）」です。

- Frontend/Server: Next.js (App Router)
- API: Next.js route 上で Hono を利用
- Auth (optional): Clerk
- LLM: OpenAI Responses API
- DB: Cloudflare D1 (SQLite) + Drizzle ORM
- Deploy: OpenNext (@opennextjs/cloudflare) + Wrangler

## Repository Layout

- `frontend/`: アプリ本体（基本的にここで作業する）
- `specs/`: 仕様・設計ドキュメント（Docs-driven の参照元）

## Setup Commands

前提:

- Node.js (LTS)
- （Production-like / deploy を触る場合）Cloudflare account + Wrangler

依存関係のインストール:

```sh
cd frontend
npm install
```

## Environment Variables

必須:

- `OPENAI_API_KEY`

任意（Auth/履歴の動作確認をする場合）:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

### `next dev` 用（Fast UI iteration）

`frontend/.env.local` に設定します。

```sh
OPENAI_API_KEY=...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
```

### `wrangler dev --local` 用（Production-like preview）

`frontend/.dev.vars` に設定するのが簡単です（Wrangler が読み込みます）。

```sh
OPENAI_API_KEY=...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
```

重要:

- `.env*` / `.dev.vars` は commit しないこと（Secrets を含む）

## Development Workflow

このリポジトリは「2モード」で動かします。

### 1) Fast UI iteration（Next.js dev server）

UI開発を最速で回す用途です。

```sh
cd frontend
npm run dev
```

- URL: http://localhost:3000

### 2) Production-like（Cloudflare Workers / OpenNext + Wrangler）

Cloudflare bindings（D1/Secrets）込みで、本番に近い挙動を確認します。

初回（またはmigration追加後）は local に migration を適用してください。

```sh
cd frontend
npm run db:migrate:local
npm run build
npm run preview
```

- `npm run preview` は `wrangler dev --local --persist-to .wrangler/state` を起動します
- 表示されるURL（例: http://localhost:8787）を開きます

ローカルDBをリセットしたい場合:

- `frontend/.wrangler/state` を削除

## Database (D1 / Drizzle)

- D1 binding 名: `DB`（wrangler.toml の `[[d1_databases]]`）
- schema: `frontend/src/db/schema.ts`
- migrations: `frontend/src/db/migrations/`

migration 生成（SQLの生成）:

```sh
cd frontend
npm run db:generate
```

migration 適用:

```sh
cd frontend
npm run db:migrate:local
```

remote 適用（deploy 前など）:

```sh
cd frontend
npm run db:migrate:remote
```

注意:

- `frontend/wrangler.toml` の `database_id` は placeholder のため、実運用では `wrangler d1 create` 後に実IDへ更新すること

## Testing Instructions

テストは Vitest を使用します（`frontend/tests/**/*.test.ts`）。

全テスト（watch）:

```sh
cd frontend
npm test
```

全テスト（CI想定・1回実行）:

```sh
cd frontend
npm run test:run
```

特定テストだけ回す例:

```sh
cd frontend
npm run test:run -- -t "<test name>"
```

## Code Style / Conventions

- Language: TypeScript
- UI: Next.js App Router（`frontend/src/app/`）
- feature 実装は `(features)` 配下にコロケーションする（例: `frontend/src/app/(features)/learn/*`）
- formatting: Prettier（`npm run format` / `npm run format:check`）
- lint: ESLint（`npm run lint`）

フォーマット:

```sh
cd frontend
npm run format
```

静的チェック（最低限）:

```sh
cd frontend
npm run lint
npm run format:check
```

## Build and Deployment

build（OpenNext）:

```sh
cd frontend
npm run build
```

deploy（Wrangler）:

```sh
cd frontend
npm run deploy
```

deploy 前の典型手順:

1. `npm run db:migrate:remote`
2. `wrangler secret put OPENAI_API_KEY`（必要に応じて Clerk も）
3. `npm run deploy`

## Security / Secrets

- `OPENAI_API_KEY` や `CLERK_SECRET_KEY` は Secrets として扱い、commit しない
- ローカルは `.env.local` / `.dev.vars` を使い、Cloudflare 側は `wrangler secret put ...` を使う

## Troubleshooting

- `npm run preview` が D1 で落ちる: `wrangler.toml` の `d1_databases.database_id` が未設定/誤りの可能性。`wrangler d1 create` 後に正しい ID を設定する
- ローカルDBを作り直したい: `frontend/.wrangler/state` を削除してから `npm run db:migrate:local`
- LLM 呼び出しで失敗する: `OPENAI_API_KEY` が未設定、または権限/請求設定の問題の可能性

## PR / Change Guidelines

- 変更に合わせて `specs/` の該当ドキュメントも更新する（Docs-driven を維持）
- 可能なら最低限 `npm run lint` / `npm run test:run` / `npm run format:check` を通す