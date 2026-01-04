# Research: プログラマー向け英語学習サイト（MVP）

**Created**: 2026-01-03  
**Spec**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)

本ドキュメントは Phase 0（Outline & Research）として、plan.md の `NEEDS CLARIFICATION` を解消し、技術選定の理由と代替案を残す。

## 0. Project bootstrap（公式推奨セットアップ）

- Decision:
  - Next.js は公式推奨の `create-next-app` で初期化し、アプリ本体は `frontend/` に配置する（`--src-dir` により `frontend/src/*` を使用）。
  - feature 実装は `frontend/src/app/(features)/<feature>` にコロケーションする。
  - RSC では `"use client"` / `"use server"` を「バンドル境界（door）」として扱い、Client Boundary を最小化する。
  - server-only なモジュール（DB access / secret access / fetch layer）は `server-only` で保護する。
- Rationale:
  - この repo には `specs/` などが既に存在し、repo root は「空ディレクトリ」ではないため、`create-next-app` を安全に適用できる配置が必要。
  - `frontend/` 配下に app を寄せることで、将来的に backend / infra を追加しても責務が混ざりにくい。
  - route と実装を `src/app/(features)/<feature>` に寄せることで、feature 単位のコロケーションが徹底しやすい。
- Alternatives considered:
  - repo root 直下に Next.js を生成（既存ファイルにより `create-next-app` が失敗する可能性がある）
  - `apps/web` のような monorepo ルート（MVP時点では階層が増えて運用が複雑になりやすい）
  - `features/` のまま運用（命名ルールと不一致）

## 0.1 Lint / Format（ESLint + Prettier）

- Decision:
  - Lint は Next.js 標準の ESLint（`create-next-app --eslint`）を採用する。
  - Format は Prettier を採用し、ESLint との競合回避のため `eslint-config-prettier` を導入する。
  - Biome は採用しない。
- Rationale:
  - Next.js テンプレートの標準に寄せることで、初期の躓きを減らせる。
  - format と lint の責務を分け、ツール間の衝突を最小化できる。
- Alternatives considered:
  - Biome（高速だが、今回の方針として採用しない）

## 0.2 RSC / Client Boundary（設計原則の参照）

- Decision:
  - RSC を前提に `"use client"` を最小化し、Client Component は state/event が必要な箇所だけに限定する（Composition パターンを優先）。
  - server-only なモジュールは `server-only` で保護する。
- Rationale:
  - `"use client"` / `"use server"` は「実行環境」ではなく「バンドル境界」として扱うほうが誤解が少ない。
  - Client Boundary の暗黙伝播を避ける設計（末端に閉じ込める）により、bundle size と data fetching の設計が安定する。
- Alternatives considered:
  - 最初から Client Components 中心（実装は簡単でも、bundle/依存境界が崩れやすい）

Notes:
- 参考: https://github.com/AkifumiSato/zenn-article/tree/main/books/nextjs-basic-principle

## 0.3 Folder Structure（Container/Presentational in RSC）

- Decision:
  - `frontend/src/app/(features)/<feature>/page.tsx` は routing の責務のみを担い、`_components/<Feature>Page.tsx` を呼び出す。
  - `_components/<Feature>Page.tsx` は Container（RSC）とし、data fetch など server-side 処理のみを担う。
  - 具体的な UI は `_components/` 配下に実装する（Presentational / Client Components）。
- Rationale:
  - RSC は従来の React Testing Library（RTL）などで直接 `render()` しにくいケースがあり、data fetching と UI 表現を分離しておくとテスト容易性が上がる。
  - feature ディレクトリ直下の `_components/_api/_hooks/_utils` に集約することで、依存方向が読みやすくなる。
- Alternatives considered:
  - 全てを Client Components で実装（テストはしやすいが、Client Boundary が広がりやすい）
  - Presentational を `frontend/src/components` に集約（共有化はしやすいが、route 専用 UI が散らばりやすい）

Notes:
- 参考: https://zenn.dev/akfm/books/nextjs-basic-principle/viewer/part_2_container_presentational_pattern

## 0.4 Data Mutation（Server Actions の利用）

- Decision:
  - App Router の data mutation は Server Actions を基本とする。
  - Server Actions は `frontend/src/app/(features)/<feature>/_api/actions.ts` に定義する。
  - クライアント側から `fetch` が必要な場合は `frontend/src/app/(features)/<feature>/_api/query.ts` に定義する。
  - feature の custom hooks は `frontend/src/app/(features)/<feature>/_hooks/` に定義する。
- Rationale:
  - Server Actions は Next.js の revalidate/redirect と統合しやすく、data mutation をシンプルに実装できる。
  - `redirect()` を Server Actions 内で呼び出すと、遷移先の RSC Payload を同じレスポンスで返せるため通信効率が良い。
  - `revalidatePath()` / `revalidateTag()` は Router Cache 破棄の影響があるため必要最小限にする。
- Alternatives considered:
  - data mutation を全て Route Handler + client fetch で実装（cache/revalidate の統合を自前で持ちやすい）

Notes:
- 参考: https://zenn.dev/akfm/books/nextjs-basic-principle/viewer/part_3_data_mutation

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
