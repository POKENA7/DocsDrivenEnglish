## Project Overview

DocsDrivenEnglish は、ユーザから入力された技術要素から英語学習教材を生成する、「プログラマー向け英語学習サイト」です。

## 技術スタック
- Frontend/Server: Next.js (App Router)
- Language: Typescript
- Auth: Clerk
- LLM: OpenAI Responses API
- DB: Cloudflare D1 (SQLite) + Drizzle ORM
- Test: vitest
- formatting: Prettier（`pnpm run format` / `pnpm run format:check`）
- lint: ESLint（`pnpm run lint`）
- Deploy: OpenNext (@opennextjs/cloudflare) + Wrangler

## 基本ルール

- 返答は日本語で行うこと
- ドキュメントは日本語で記述すること
- 技術用語（Next.js / Cloudflare Workers / D1 / Wrangler / Drizzle / Vitest など）は英語のまま記載すること
- ユーザから「設計して」と言われた場合は、 `docs/design` にmdファイルで設計書を出力すること

## Repository Layout

- `frontend/`: アプリ本体
- `docs/SPEC.md`:仕様ドキュメント
- `docs`: 設計ドキュメント

## Git

- 実装を始める際は、ghコマンドを使ってmainブランチからfeature/機能名ブランチを切ってから作業すること
- 実装完了後は、featureブランチをリモートにPushし、mainブランチに向けて適切なOverviewを記載したPRを作成すること

## Coding Rule

- ** IMPORTANT: 必要十分かつシンプルな実装を心がけ、過度なエラーハンドリング、フォールバック処理は行わないこと **
- 人間がソースコードを読みやすいように、処理を過度に関数に切り分けないこと
- 新規プロダクトのため、技術スタックの変更やリファクタリング時に、過度に既存の実装を残そうとしないこと
- ** レビュワーがかなり厳しいため、絶対指摘されないコードに仕上げること **
- 最低限 `pnpm run lint` / `pnpm run test:run` / `pnpm run format:check` を通すこと
- 新規機能の追加や仕様変更があった場合は、必ずテストを書くこと
- ユーザに影響がある新機能追加や仕様変更があった場合は、 `/docs/SPEC.md` を更新すること