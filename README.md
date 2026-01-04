# DocsDrivenEnglish

プログラマー向け英語学習サイト（MVP）。公開ドキュメントURL（1ページ）から教材を生成し、最大5問単位のクイズ学習を行います。

## Development

### Prerequisites

- Node.js（LTS）

### Install

```sh
cd frontend
npm install
```

### Local Development（2モード）

#### 1) Fast UI iteration（UI中心）

```sh
cd frontend
npm run dev
```

#### 2) Production-like（Cloudflare Workers / OpenNext）

```sh
cd frontend
npm run build
npm run preview
```

Notes:
- Cloudflare（Wrangler/D1/Secrets）周りの詳細は [specs/001-dev-english-learning/quickstart.md](specs/001-dev-english-learning/quickstart.md) を参照してください。

## Deployment（Production）

Cloudflare Workers（OpenNext）へデプロイします。

### 初めての方向け：事前準備（Cloudflare）

#### A) Cloudflare account

- Cloudflare にサインアップしてログインできる状態にします

#### B) Wrangler の準備

Wrangler は Cloudflare の公式 CLI です。

```sh
npm install -g wrangler
wrangler --version
```

Cloudflare へログインします（ブラウザが開きます）。

```sh
wrangler login
wrangler whoami
```

#### C) Secrets を commit しない

- `OPENAI_API_KEY` / `CLERK_SECRET_KEY` などは必ず `wrangler secret put ...` で登録します
- `.env*` / `.dev.vars` を commit しないでください

### Prerequisites

- Cloudflare account
- Wrangler（ローカルにインストール済み）
- `frontend/wrangler.toml` の `[[d1_databases]]` に、本番の D1 を紐づけ済み
	- `database_id` は初期状態だと placeholder のため、実 ID に更新してください

### 1) Install

```sh
cd frontend
npm install
```

### 2) Create / Configure D1（初回のみ）

Cloudflare 側で D1 を作成し、`frontend/wrangler.toml` の `database_id` を更新します。

```sh
cd frontend
wrangler d1 create <YOUR_DB_NAME>
```

### 3) Set Secrets

本番環境の Secrets を Cloudflare 側に登録します（commit しません）。

```sh
cd frontend
wrangler secret put OPENAI_API_KEY
```

（Auth を使う場合のみ）

```sh
cd frontend
wrangler secret put CLERK_SECRET_KEY
```

### 4) Run DB migrations（Remote）

```sh
cd frontend
npm run db:migrate:remote
```

### 5) Deploy

```sh
cd frontend
npm run deploy
```
