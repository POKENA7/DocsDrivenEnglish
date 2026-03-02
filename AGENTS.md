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

## 作業フロー

** IMPORTANT: 作業を開始する際は、必ず以下のフローに沿うこと **
1. 必ずgit worktreeを使い、mainブランチからfeature/機能名ブランチを切る(git checkout -bは禁止)
2. 最初から実装は行わず、まずは `docs/design` にmdファイルで設計書を出力する
3. 設計書の作成が完了したら、人間に承認を求める
4. 人間による承認後、実装を開始する
5. 実装完了後、featureブランチをリモートにPushし、mainブランチに向けて適切なOverviewを記載したPRを作成する
6. PR提出後、人間からの承認を得られた場合は、worktreeを削除して最新のmainブランチにcheckoutすること

## Coding Rule

- ** IMPORTANT: 必要十分かつシンプルな実装を心がけ、過度なエラーハンドリング、フォールバック処理は行わないこと **
- 人間がソースコードを読みやすいように、処理を過度に関数に切り分けないこと
- 新規プロダクトのため、技術スタックの変更やリファクタリング時に、過度に既存の実装を残そうとしないこと
- ** レビュワーがかなり厳しいため、絶対指摘されないコードに仕上げること **
- 最低限 `pnpm run lint` / `pnpm run test:run` / `pnpm run format:check` を通すこと
- 新規機能の追加や仕様変更があった場合は、必ずテストを書くこと
- ユーザに影響がある新機能追加や仕様変更があった場合は、 `/docs/SPEC.md` を更新すること

## Repository Layout

- `frontend/`: アプリ本体
- `docs/SPEC.md`:仕様ドキュメント
- `docs`: 設計ドキュメント
