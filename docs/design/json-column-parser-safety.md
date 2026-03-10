# JSON文字列カラムのパース処理を型安全に統一する設計書

## 背景

`frontend/src/server` では、DB に保存した JSON 文字列カラムを読み出すたびに `JSON.parse(... ) as ...` を直接書いている。

この書き方だと、次の問題がある。

- `string[]` などの要素型保証がキャスト任せになっている
- JSON 構造が壊れていても呼び出し元ごとに失敗の見え方が揃わない
- `questionIdsJson` / `choicesJson` / `topics` / `articles` ごとに同じ変換責務が散在している

issue #82 では、JSON 文字列カラムの復元処理をサーバー層で共通化し、型安全性と保守性を上げる。

---

## 対象範囲

### 対象に含める箇所

- `frontend/src/server/quiz/answer.ts`
- `frontend/src/server/quiz/query.ts`
- `frontend/src/server/suggestions/related-topics.ts`
- `frontend/src/server/suggestions/hn-trends.ts`

上記で扱う、以下の DB JSON 文字列カラムを対象にする。

- `sessions.questionIdsJson`
- `questions.choicesJson`
- `topicSuggestionsCache.topics`
- `hnTrendCache.articles`

### 対象に含めない箇所

- `frontend/src/lib/openaiClient.ts` の fallback `JSON.parse`

これは DB カラムの復元ではなく、OpenAI SDK 応答の復旧処理であり、今回の issue が求める「JSON文字列カラム向け共通パーサー」と責務が異なるため。

---

## 設計方針

### 1. `frontend/src/server` 配下に共通ヘルパーを置く

配置候補:

- `frontend/src/server/json.ts`

`quiz` と `suggestions` の両方から利用し、かつ失敗時に `ApiError` を投げるため `server` 配下に置くのが自然。

### 2. Zod を受け取る汎用パーサーを提供する

想定 API:

```ts
import { z } from "zod";

export function parseJsonColumn<TSchema extends z.ZodTypeAny>(input: {
  columnName: string;
  raw: string;
  schema: TSchema;
}): z.infer<TSchema>
```

処理内容:

1. `JSON.parse(input.raw)` で `unknown` に復元する
2. `input.schema.safeParse(...)` で Zod 検証する
3. 成功時のみ型付きで返す
4. JSON 構文不正または schema 不一致なら `ApiError("INTERNAL", "...")` を投げる

### 3. カラムごとの schema は呼び出し側近くで定義する

共通化するのは「JSON 文字列を unknown に戻して Zod で検証する流れ」であり、各カラムの意味まではヘルパー側に寄せすぎない。

具体例:

- `questionIdsJson` → `z.array(z.string())`
- `choicesJson` → `z.array(z.string())`
- `topics` → `z.array(z.string())`
- `articles` → 既存の `trendArticlesSchema`

`trendArticlesSchema` はすでに `hn-trends.ts` に存在するため再利用する。

### 4. パース失敗時の挙動を `INTERNAL` に統一する

JSON 文字列カラムの不正はユーザー入力不正ではなく、保存済みデータの破損または実装不整合である。

そのため、以下のどちらも同じ分類にする。

- `JSON.parse` が失敗した
- JSON としては読めたが、期待 schema と一致しなかった

返すエラーは `ApiError("INTERNAL", "...")` に統一する。

メッセージはカラム単位で切り分け可能なものにする。

例:

- `question_ids_json の保存形式が不正です`
- `choices_json の保存形式が不正です`
- `topics の保存形式が不正です`
- `articles の保存形式が不正です`

---

## 変更イメージ

### 変更前

```ts
const questionIds = JSON.parse(session.questionIdsJson) as string[];
const choices = JSON.parse(row.choicesJson) as string[];
const topics = JSON.parse(row.topics) as string[];
const articles = trendArticlesSchema.parse(JSON.parse(row.articles) as unknown);
```

### 変更後

```ts
const questionIds = parseJsonColumn({
  columnName: "question_ids_json",
  raw: session.questionIdsJson,
  schema: z.array(z.string()),
});
```

```ts
const articles = parseJsonColumn({
  columnName: "articles",
  raw: row.articles,
  schema: trendArticlesSchema,
});
```

---

## 変更対象ファイル

| ファイル | 変更内容 |
| --- | --- |
| `frontend/src/server/json.ts` | JSON 文字列カラム向け共通パーサーを追加 |
| `frontend/src/server/quiz/query.ts` | `questionIdsJson` / `choicesJson` の直接パースを置換 |
| `frontend/src/server/quiz/answer.ts` | `questionIdsJson` の直接パースを置換 |
| `frontend/src/server/suggestions/related-topics.ts` | `topics` の直接パースを置換 |
| `frontend/src/server/suggestions/hn-trends.ts` | `articles` の直接パースを置換 |
| `frontend/tests/**` | 新ヘルパーと既存呼び出し箇所のテストを追加・更新 |

---

## テスト方針

### 追加するテスト

- `frontend/tests/unit` に新ヘルパーの単体テストを追加する

確認観点:

- 正常な JSON + schema 一致で型付きの値を返す
- JSON 構文が壊れている場合に `ApiError("INTERNAL", ...)` を投げる
- JSON は読めるが要素型が不一致な場合に `ApiError("INTERNAL", ...)` を投げる

### 既存テストで担保する内容

- `get-session-result.test.ts` で `questionIdsJson` / `choicesJson` を読み出す系の回帰確認
- `related-topics.test.ts` で `topics` キャッシュ読み出しの回帰確認
- `hn-trends.test.ts` で `articles` キャッシュ読み出しの回帰確認
- 必要に応じて `quiz-answer.test.ts` でセッション内 questionId 判定の回帰確認

---

## レビュー観点

- `JSON.parse(... ) as ...` の直接記述が対象箇所から消えているか
- schema が `string[]` / `HnTrendArticle[]` など実データ構造に対して十分か
- パース失敗時のエラーコードが `INTERNAL` に統一されているか
- helper の責務が「JSON カラム復元」に閉じており、不要な抽象化になっていないか
