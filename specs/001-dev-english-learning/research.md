# Research: プログラマー向け英語学習サイト（MVP）

**Created**: 2026-01-03  
**Spec**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)

本ドキュメントは Phase 0（Outline & Research）として、plan.md の `NEEDS CLARIFICATION` を解消し、技術選定の理由と代替案を残す。

## 1. ドキュメント本文抽出（HTML → 教材テキスト）

- Decision: `@mozilla/readability` + `linkedom/worker` を利用し、入力URLのHTMLから本文（main content）を抽出する。抽出後は `turndown` で HTML→Markdown（または準Markdown）へ変換し、`code block` を fenced block として保持する。
- Rationale:
  - headless browser を使わずに「本文らしい部分」を安定して取れる。
  - Cloudflare Workers のような DOM-less 環境でも `linkedom/worker` で DOM を提供できる。
  - Readability の抽出結果（excerpt / content）を利用して、FR-011 の引用テキストをページ本文から安全に生成できる。
- Alternatives considered:
  - Cloudflare `HTMLRewriter` + selector/heuristics: 軽量だがサイトごとのselector調整が必要になりやすい。
  - Selectorベース抽出（main/article 等の最大テキストを拾う）: docs site に強いが例外処理が増えやすい。
  - `@postlight/parser`: リッチだが Worker/Edge での相性と保守性の不確実性がある。

### FR-011（引用テキスト + 元URL）の扱い

- Decision: 引用テキストは「抽出後の本文DOM」から、`excerpt` または最初の十分長い段落（`<p>`）を優先し、`maxQuoteChars`（例: 300 chars）で sentence boundary を意識して切り詰める。巨大な code sample は引用に含めない。
- Rationale: ナビ/フッター等を除外しつつ、過剰引用を防げる。
- Alternatives considered: 取得HTMLの先頭N文字を引用にする（ノイズが混ざりやすい）。

## 2. OpenAI API（教材抽出/解説生成）

- Decision: OpenAI API 呼び出しは Next.js API Routes（server side）から行い、Cloudflare Workers 上では Secret binding（`wrangler secret`）で key を管理する。可能なら Cloudflare AI Gateway を経由して observability（token/cost）と rate limit を統合する。
- Rationale:
  - API key を browser に露出させない。
  - Workers/Edge での timeout/retry を明示し、latency/cost をコントロールできる。
- Alternatives considered:
  - Workers AI: CFネイティブだがモデル/品質要件の制約がある可能性。
  - 別サーバにAI専用backendを置く: 運用負荷が増える。

### latency/cost 制御

- Decision: `AbortController` で timeout を必ず設定し、`max_tokens` 等で出力上限を固定する。キャッシュは PII を含まない入力に限定する（例: 同一URL+同一mode の教材生成結果）。
- Rationale: 3秒目標に対して、AI call の暴発を防ぐ。
- Alternatives considered: 無制限生成（運用/費用が不安定）。

## 3. Hono RPC + Next.js API Routes

- Decision: Next.js App Router の catch-all route（`src/app/api/[[...route]]/route.ts`）で Hono app を `handle(app)` して `/api/*` を一括で受け、Hono 側で router を分割（`document`, `quiz`, `history`）する。type sharing は `AppType` を export して `hc<AppType>()` で client を生成する。
- Rationale:
  - endpoint を1箇所に集約でき、OpenNext/Workers デプロイでも構成が単純。
  - RPC の型を front/back で共有できる。
- Alternatives considered:
  - Next.js Route Handlers のみ（Honoなし）: 最小だが RPC typing を捨てる。
  - API を別Workerに分離（Service Binding）: 境界は綺麗だがMVPの構成が増える。

## 4. Drizzle + Cloudflare D1（migration と local dev）

- Decision: schema は TypeScript（`drizzle-orm/sqlite-core`）を source of truth とし、migration SQL は `drizzle-kit generate` で作成し、適用は Wrangler の `wrangler d1 migrations apply` を利用する。ローカルは `--persist-to` を固定してDBを永続化する。
- Rationale:
  - D1 の標準運用（Wrangler）に揃えることでデプロイ手順が明確。
  - Drizzle の schema と migration を一致させやすい。
- Alternatives considered:
  - Drizzle の別migration runner を併用（混乱しやすい）。

## 5. Clerk（Auth） + Cloudflare Workers（OpenNext）

- Decision: `@clerk/nextjs` を利用し、`clerkMiddleware` + `auth()` を中心に「匿名（signed out）/ログイン（signed in）」を分岐する。OpenNext の Workers runtime では Node compatibility（`nodejs_compat`）を有効化する前提で運用する。
- Rationale:
  - Next.js App Router の標準パターンに沿い、UXと実装の一貫性を保ちやすい。
- Alternatives considered:
  - 独自実装のOAuth（GitHub）: セキュリティ/運用コストが上がる。

## 6. Cloudflare local dev / deploy（参考boilerplateの知見）

- Decision: ローカル開発は2モードを前提にする。
  - Fast UI iteration: `next dev`（UI作業向け）
  - Production-like: OpenNext build + Workers-like preview（D1 binding を含む実運用に近い検証向け）

  D1 は `DB` binding を標準化し、preview/prod を分離する。secret は `wrangler secret`、非secret は `vars` を使う。
- Rationale:
  - UI開発の速度と、Cloudflare binding を含む検証の再現性を両立できる。
- Alternatives considered:
  - 1モードに統一（UIかinfraのどちらかが犠牲になりやすい）。
