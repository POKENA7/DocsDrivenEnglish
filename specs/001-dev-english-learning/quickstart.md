# Quickstart: プログラマー向け英語学習サイト（MVP）

**Created**: 2026-01-03  
**Spec**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)

本ドキュメントは Phase 1（Design）として、ローカル開発と Cloudflare deploy の最短導線を定義する。

## Prerequisites

- Node.js（LTS）
- Cloudflare account
- Wrangler CLI
- Clerk account/project
- OpenAI API key

## Local Development（2モード）

### 1) Fast UI iteration（UI中心）

- 目的: UI開発を高速化する（Cloudflare binding 依存を最小化）
- 例（想定）:
  - install: `npm install`
  - run: `npm run dev`

### 2) Production-like（Cloudflare Workers / OpenNext）

- 目的: Cloudflare bindings（D1/Secrets）を含めて本番に近い挙動で検証する
- 方針:
  - OpenNext build → Workers-like preview を起動
  - D1 は `--persist-to` を固定してローカルDBを維持する

例（想定）:
- build: `npm run build`
- preview: `npm run preview`

## D1（SQLite）

- binding 名: `DB`
- migration:
  - generate: `drizzle-kit generate`
  - apply (local): `wrangler d1 migrations apply <DB_NAME> --local --persist-to .wrangler/state`
  - apply (remote): `wrangler d1 migrations apply <DB_NAME> --remote`

Notes:
- Drizzle の schema を source of truth とし、migration SQL は生成して運用する

## Secrets / Env

- Secrets（OpenAI API key, Clerk secrets 等）: `wrangler secret put ...` を利用
- Non-secret（`NEXT_PUBLIC_*` 等）: Wrangler の `vars` を利用
- ローカル用の secret/vars は gitignore 対象とする

## Deploy（Cloudflare Workers / OpenNext）

- 方針:
  1. D1 migration を remote に apply
  2. Worker を deploy

例（想定）:
- `wrangler d1 migrations apply <DB_NAME> --remote`
- `wrangler deploy`

## Reference

- Cloudflare Next boilerplate（local dev / bindings / OpenNext 構成の参考）
  - https://github.com/lilpacy/cloudflare-next-boilerplate
