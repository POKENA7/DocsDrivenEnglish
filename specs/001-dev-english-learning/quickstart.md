# Quickstart: プログラマー向け英語学習サイト（MVP）

**Created**: 2026-01-03  
**Spec**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)

本ドキュメントは Phase 1（Design）として、ローカル開発と Cloudflare deploy の最短導線を定義する。

## Prerequisites

- Node.js（LTS）
- Cloudflare account
- Wrangler CLI（`wrangler`）
- Clerk account/project
- OpenAI API key

## Setup（公式推奨の初期化手順）

この repo には `specs/` が存在するため、Next.js は公式推奨の `create-next-app` を使い、アプリ本体を `frontend/` に作成する（`--src-dir` により `frontend/src/*` を使用）。

### Next.js（App Router）

例:

- `npx create-next-app@latest frontend --ts --eslint --tailwind --app --src-dir`

Notes:
- 以降のコマンドは基本 `frontend/` 配下で実行する

### ESLint + Prettier（lint/format）

ESLint は Next.js の公式テンプレート（`--eslint`）により標準で有効になる。

Prettier は追加で導入し、ESLint と競合しないように `eslint-config-prettier` を入れる。

例:

- `cd frontend`
- `npm install -D prettier eslint-config-prettier`

### shadcn/ui

例:

- `cd frontend`
- `npx shadcn@latest init`

### features ディレクトリ

feature 実装は `frontend/src/app/(features)/<feature>` にコロケーションする（例: `frontend/src/app/(features)/document/*`）。

## Local Development（2モード）

### 1) Fast UI iteration（UI中心）

- 目的: UI開発を高速化する（Cloudflare binding 依存を最小化）
- 例（想定）:
  - install: `cd frontend && npm install`
  - run: `cd frontend && npm run dev`

### 2) Production-like（Cloudflare Workers / OpenNext）

- 目的: Cloudflare bindings（D1/Secrets）を含めて本番に近い挙動で検証する
- 方針:
  - OpenNext build → Workers-like preview を起動
  - D1 は `--persist-to` を固定してローカルDBを維持する

例（想定）:
- build: `cd frontend && npm run build`
- preview: `cd frontend && npm run preview`

## D1（SQLite）

- binding 名: `DB`
- migration:
  - generate: `drizzle-kit generate`
  - apply (local): `npx wrangler d1 migrations apply <DB_NAME> --local --persist-to .wrangler/state`
  - apply (remote): `npx wrangler d1 migrations apply <DB_NAME> --remote`

Notes:
- Drizzle の schema を source of truth とし、migration SQL は生成して運用する

## Secrets / Env

- Secrets（OpenAI API key, Clerk secrets 等）: `npx wrangler secret put ...` を利用
- Non-secret（`NEXT_PUBLIC_*` 等）: Wrangler の `vars` を利用
- ローカル用の secret/vars は gitignore 対象とする

## Deploy（Cloudflare Workers / OpenNext）

- 方針:
  1. D1 migration を remote に apply
  2. Worker を deploy

例（想定）:
- `cd frontend`
- `npx wrangler d1 migrations apply <DB_NAME> --remote`
- `npx wrangler deploy`

## Reference

- Cloudflare Next boilerplate（local dev / bindings / OpenNext 構成の参考）
  - https://github.com/lilpacy/cloudflare-next-boilerplate
