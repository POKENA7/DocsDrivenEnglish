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
