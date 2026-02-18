---
description: DBスキーマ変更（Drizzle + Cloudflare D1）の安全なワークフロー。schema.ts 編集 → migration 生成 → ローカル適用 → 動作確認。
---

## ユーザー入力

```text
$ARGUMENTS
```

`$ARGUMENTS` が空でない場合は、必ず内容を考慮してから進むこと。

---

## このSkillについて

DocsDrivenEnglish は Drizzle ORM + Cloudflare D1（SQLite）を使用している。

- **スキーマ定義**: `frontend/src/db/schema.ts`
- **マイグレーション**: `frontend/src/db/migrations/`
- **DB binding 名**: `DB`（`frontend/wrangler.toml` に定義）

このSkillは、テーブル追加・カラム追加・カラム削除などのスキーマ変更を
安全に行うためのワークフローをガイドする。

---

## 手順

### 1. 変更内容の確認

ユーザー入力から以下を把握する。

- **変更するテーブル名** または **新規テーブル名**
- **変更内容**（カラム追加 / カラム削除 / カラム型変更 / テーブル追加 / テーブル削除）
- **カラムの型・制約**（NOT NULL, DEFAULT, PRIMARY KEY など）

### 2. 現在のスキーマを確認

`frontend/src/db/schema.ts` を読み、現在の定義を把握する。

既存テーブル:
- `studySessions`: セッション情報（`session_id`, `user_id`, `topic`, `mode`, etc.）
- `questions`: 問題情報（`question_id`, `session_id`, `prompt`, `choices_json`, etc.）
- `attempts`: 回答記録（`attempt_id`, `session_id`, `question_id`, `user_id`, etc.）

### 3. schema.ts の編集

Drizzle ORM の SQLite 型関数を使用する。主な型関数:

```typescript
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// 文字列
text("column_name")              // TEXT
text("column_name").notNull()    // TEXT NOT NULL
text("column_name").default("")  // TEXT DEFAULT ''

// 整数
integer("column_name")                           // INTEGER
integer("column_name", { mode: "boolean" })      // INTEGER（boolean として扱う）
integer("column_name", { mode: "timestamp_ms" }) // INTEGER（timestamp_ms として扱う）
integer("column_name").notNull()

// プライマリキー
text("id").primaryKey()
```

**重要**: D1（SQLite）はカラムの削除・型変更ができない。削除が必要な場合は
新テーブル作成 + データ移行 + 旧テーブル削除のアプローチが必要。

### 4. マイグレーションの生成

スキーマ変更後、Drizzle Kit でマイグレーション SQL を生成する。

```bash
cd frontend
npm run db:generate
```

生成されたファイルを `frontend/src/db/migrations/` で確認し、
意図した変更が含まれているかチェックする。

**確認ポイント**:
- 意図しないテーブル削除が含まれていないか
- カラムの型が正しいか
- NULL 制約・DEFAULT 値が正しいか

### 5. ローカル D1 への適用

```bash
cd frontend
npm run db:migrate:local
```

エラーが出た場合:
- マイグレーション SQL の構文エラー → 生成ファイルを確認
- 既存データとの競合 → ローカルDBをリセット（`.wrangler/state` を削除）して再実行

### 6. 動作確認

スキーマ変更がアプリケーション側で正しく動作するか確認する。

```bash
cd frontend
npm run build
npm run preview
```

または開発サーバーで確認:

```bash
cd frontend
npm run dev
```

### 7. テストの確認

```bash
cd frontend
npm run test:run
npm run lint
npm run format:check
```

スキーマ変更に合わせてアプリケーションコードの修正が必要な場合は実施する。

### 8. リモート適用（deploy 時）

本番環境への適用は deploy 前に実施する。

```bash
cd frontend
npm run db:migrate:remote
```

---

## チェックリスト

- [ ] `frontend/src/db/schema.ts` を変更
- [ ] `npm run db:generate` でマイグレーション SQL を生成
- [ ] 生成された SQL の内容を目視確認（意図しない変更がないか）
- [ ] `npm run db:migrate:local` でローカル D1 に適用
- [ ] アプリケーションコードの型・参照を更新（必要な場合）
- [ ] `npm run test:run` / `npm run lint` / `npm run format:check` が通ることを確認
- [ ] `docs/SPEC.md` にスキーマ変更の影響が反映されているか確認

---

## よくある問題

| 問題 | 解決策 |
|------|--------|
| `db:migrate:local` が失敗する | `.wrangler/state` を削除してリセット後に再実行 |
| 既存の migration との競合 | `frontend/src/db/migrations/` の最新ファイルを確認し、重複した変更を削除 |
| カラム削除が必要 | D1（SQLite）はカラム削除不可。代替テーブル作成 → データ移行 → 旧テーブル削除の手順が必要 |
| `database_id` エラー | `frontend/wrangler.toml` の `database_id` が placeholder のまま。`wrangler d1 create` で取得した実IDを設定する |
