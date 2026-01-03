# Implementation Plan: プログラマー向け英語学習サイト（MVP）

**Branch**: `001-dev-english-learning` | **Date**: 2026-01-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-dev-english-learning/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

ユーザーが入力した公式ドキュメントURL（1ページのみ）を教材として、単語モード/読解モードの4択クイズを提供し、解説（英語の意味 + 技術背景 + 使用シーン）と出典（引用テキスト + 元URL）を表示する。未ログインでも学習可能で、ログイン（Clerk）ユーザーは学習履歴を永続化し複数デバイスで参照できる。

技術的には Next.js App Router をFrontend/Backendの両方として利用し、Backendは Next.js API Routes + Hono RPC で構成する。教材抽出/解説生成には OpenAI API を利用する（詳細は research.md で確定）。永続化は Cloudflare D1(SQLite) + Drizzle を利用する。

Phase 0/1 成果物:
- [research.md](research.md)
- [data-model.md](data-model.md)
- [contracts/openapi.yaml](contracts/openapi.yaml)
- [quickstart.md](quickstart.md)

## Technical Context

**Language/Version**: TypeScript（Next.js App Router 16.0.10）  
**Primary Dependencies**: Next.js（App Router）, Hono RPC, TailwindCSS, shadcn/ui, OpenAI API, valibot, Drizzle, Clerk  
**Storage**: Cloudflare D1(SQLite)  
**Testing**: vitest  
**Target Platform**: Cloudflare Workers（OpenNext）  
**Project Type**: web  
**Performance Goals**: 最初の問題表示まで3秒以内（SC-001）を満たす。主要API（セッション生成/回答採点）は server time p95 < 800ms を初期目標とし、vitest の integration test で baseline を確認する。  
**Constraints**: package by feature（コロケーション重視）。ローカル開発環境を必須（Cloudflare系のローカル実行を含む）。linter/formatter は biome。  
**Scale/Scope**: MVPは「入力URLの1ページ」×「最大10問/セッション」。複数ページの横断分析は対象外。

### Key Technical Decisions (resolved in Phase 0)

- ドキュメント本文抽出: `@mozilla/readability` + `linkedom/worker`（詳細: [research.md](research.md)）
- HTML→教材テキスト変換: `turndown`（code block を fenced block として保持、詳細: [research.md](research.md)）
- OpenAI API: server side から呼び出し、secret は `wrangler secret` で管理（可能なら Cloudflare AI Gateway を利用、詳細: [research.md](research.md)）
- Hono RPC: Next.js catch-all API Route で `/api/*` を Hono に集約（詳細: [research.md](research.md)）
- Drizzle + D1 migration: `drizzle-kit generate` + `wrangler d1 migrations apply`（詳細: [research.md](research.md)）
- Auth: Clerk（詳細: [research.md](research.md)）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*


GATE（Phase 0開始前に必須）:

- I. Code Quality: biome を導入し、format/lint を通す。Error handling を必須化し、失敗を呼び出し側へ伝播できる形で返す。
- II. Testing Standards: 抽出ロジック/validation は unit test（vitest）。主要導線（URL入力→出題→回答→解説→履歴）は integration test（可能な範囲）を用意する。
- III. UX Consistency: UIは TailwindCSS + shadcn/ui のみを利用し、新規の色/フォント/shadow をハードコードしない。
- IV. Performance Requirements: SC-001（3秒）を満たすため、教材生成はキャッシュ/非同期化の方針を plan/tasks で明記し、p95 latency の計測対象を決める。
- V. Simplicity & Maintainability: MVPでは crawl しない・10問単位・補填しない等、仕様の境界を守る。

Deviations: なし（現時点）。

Re-check（Phase 1 design後 / 2026-01-03）:

- I〜V の方針に反する設計判断なし
- performance goals/constraints を plan に明記済み
- UX は TailwindCSS + shadcn/ui を前提とし、追加のUX拡張は計画しない

## Project Structure

### Documentation (this feature)

```text
specs/001-dev-english-learning/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── app/                              # Next.js App Router
│   ├── (marketing)/                  # トップ等（MVPの最小構成）
│   ├── (learn)/                      # モード選択/学習/解説/履歴
│   └── api/                          # Next.js API Routes（Hono RPC endpoint を含む）
│
├── features/                         # package by feature（コロケーション）
│   ├── document/                     # URL検証、取得、本文抽出
│   ├── quiz/                         # 問題生成、出題、採点
│   ├── explanation/                  # 解説生成
│   ├── history/                      # 学習履歴（集計/表示）
│   └── auth/                         # Clerk integration
│
├── db/                               # Drizzle schema/migrations
└── lib/                              # 横断util（logger等）

tests/
├── unit/
└── integration/
```

**Structure Decision**: web（Next.js単体）で、UI（app）とdomain（features）を分離しつつ、package by feature を優先する。

## Design Thinking

UIを実装する前に、必ずコンテキストを理解し、明確で一貫した aesthetic direction を決定する。

- **Purpose**: この interface は何の課題を解決するか？誰が使うか？
- **Tone**: 極端を選ぶ（例: brutally minimal / maximalist chaos / retro-futuristic / organic/natural / luxury/refined / playful/toy-like / editorial/magazine / brutalist/raw / art deco/geometric / soft/pastel / industrial/utilitarian など）。参考にしつつ、今回の文脈に本当に合う1つにコミットする。
- **Constraints**: 技術要件（Next.js, performance, accessibility など）と、既存の design system 制約。
- **Differentiation**: 忘れられない要素は何か？ユーザーが1つだけ覚えて帰るとしたら何か？

**CRITICAL**: 方向性は「強さ」より「意図の一貫性」。bold maximalism でも refined minimalism でも、狙いを明確にし、細部まで正確に実行する。

その上で、実装は以下を満たすこと:

- Production-grade で functional
- 視覚的に印象が残り、記憶に残る
- aesthetic point-of-view が一貫している
- 細部（spacing/typography/state）まで丁寧に仕上げる

### Frontend Aesthetics Guidelines

Focus on:

- **Typography**: 美しく個性がある font choice を重視する。ただし本プロジェクトは TailwindCSS + shadcn/ui の design system を優先し、**新しい font family をハードコードしない**（必要がある場合は theme 設定として扱い、差分と理由を plan/tasks に明記する）。
- **Color & Theme**: 一貫した theme にコミットする。CSS variables（および既存の theme primitives / Tailwind tokens）で統一し、**新しい色のハードコードは禁止**。
- **Motion**: 高インパクトな瞬間に集中して animation を使う。無闇な micro-interactions を増やさない。可能な範囲で CSS-only を優先し、React で必要な場合のみ適切な library を検討する。
- **Spatial Composition**: 余白の設計と情報密度のコントロールを意図的に行う（asymmetry / overlap / grid-breaking などは、UXを壊さない範囲で採用する）。
- **Backgrounds & Visual Details**: 雰囲気と奥行きを作る。ただし **新しい shadow/texture をハードコードしない**。使う場合は既存の token / primitive の範囲で実現する。

NEVER:

- 文脈に合わない、テンプレ的で cookie-cutter な layout / component pattern に収束させない。
- 既存の design system を無視して、色・font・shadow を直接値で埋め込まない。

**IMPORTANT**: implementation complexity は aesthetic vision に合わせる。minimal な方向性なら restraint と精度、maximalist なら構成・state・animation を含めた一貫性を優先する。
