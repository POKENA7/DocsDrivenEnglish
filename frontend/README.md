This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## ローカル動作確認

このアプリはローカルで2つのモードで動かせます。

- Fast UI iteration: `next dev`（UI中心・最速）
- Production-like: OpenNext build + `wrangler dev --local`（Cloudflare bindings（D1/Secrets）込みで本番に近い）

### Prerequisites

- Node.js（LTS）
- OpenAI API key（`OPENAI_API_KEY` は必須）
- （任意）Clerk keys（ログイン/履歴永続化の動作確認をする場合）

### Install

```bash
cd frontend
npm install
```

### Env（重要）

`next dev` 用の環境変数は `frontend/.env.local` に設定します。

```bash
# required
OPENAI_API_KEY=...

# optional (auth)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
```

`wrangler dev --local`（`npm run preview`）用は、`frontend/.dev.vars` を使うのが簡単です（Wrangler が読み込みます）。

```bash
# required
OPENAI_API_KEY=...

# optional (auth)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
```

Note:

- `.env*` は `.gitignore` 対象です（コミットしないでください）。

### 1) Fast UI iteration（Next.js dev server）

```bash
cd frontend
npm run dev
```

- http://localhost:3000 を開く
- 手動チェックの流れ（最小）:
	- `/learn` で公開ドキュメントURLを入力し、mode（word/reading）を選んで学習開始
	- 問題を回答して「正誤 + explanation + 出典」が表示される
	- `/history` を開き、未ログインなら login CTA、ログイン済みなら集計が表示される

### 2) Production-like（Cloudflare Workers / OpenNext + Wrangler）

このモードは D1 binding（`DB`）を含めて確認できます。初回は migration を適用してください。

```bash
cd frontend
npm run db:migrate:local
npm run build
npm run preview
```

- `npm run preview` は `wrangler dev --local --persist-to .wrangler/state` を起動します
- 表示されるURL（例: http://localhost:8787）を開く

ローカルDBをリセットしたい場合は `frontend/.wrangler/state` を削除します。

### 自動テスト / 静的チェック

```bash
cd frontend
npm run test:run
npm run lint
npm run format:check
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
