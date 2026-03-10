# 設計書: 関連トピック生成の incomplete 応答修正

**作成日**: 2026-03-10  
**ステータス**: 設計中  
**対象**: Issue #64 の関連トピック推薦

---

## 背景

`/learn` の関連トピック推薦では OpenAI Responses API の `responses.parse` を使っているが、以下のログで `status = incomplete` となり推薦取得に失敗することがある。

```text
[openai] responses.parse incomplete {
  schemaName: 'related_topics_ja',
  model: 'gpt-5-mini-2025-08-07',
  status: 'incomplete',
  incompleteDetails: { reason: 'max_output_tokens' },
  maxOutputTokens: 300
}
```

関連トピック推薦は `topics: string[]` を最大 3 件返すだけの小さいレスポンスだが、現状は `related-topics.ts` で `maxOutputTokens: 300` を個別指定している。
一方で共通の OpenAI ヘルパーのデフォルトは `2048` であり、他の生成処理よりも極端に小さい上限になっている。

---

## 原因

- `frontend/src/server/suggestions/related-topics.ts` が `createOpenAIParsedText(..., { maxOutputTokens: 300 })` を指定している
- `responses.parse` は Structured Outputs 用の内部制約や JSON 形式の都合で、見た目の出力量より多くのトークンを消費しうる
- そのため 3 件の短い topic 返却でも `300` では不足し、`incomplete` になりうる

---

## 変更方針

### 1. 関連トピック生成の `maxOutputTokens` を引き上げる

- 個別指定の `300` はやめる
- 共通デフォルト `2048` を使うか、少なくとも余裕のある値に引き上げる
- 今回は実装を最小に保つため、**個別指定を削除して共通デフォルトに寄せる** 方針を採る

この方針なら、関連トピックだけ特別な低上限を維持する理由がなくなり、今後モデル差し替え時にも同系統の不具合を起こしにくい。

### 2. プロンプトは簡潔さを維持する

- 返却件数は 3 件のまま
- topic 名は短く自然な技術名に限定する現行制約を維持する
- 過度なフォールバック処理は追加しない

不具合の本質はトークン上限不足であり、ここで複雑な再試行や別経路の生成を足す必要はない。

### 3. テストで OpenAI 呼び出しオプションを固定化する

- 関連トピック生成テストを追加または更新し、`createOpenAIParsedText` に不必要な `300` が渡らないことを確認する
- 既存のキャッシュ分岐はそのまま維持する

---

## 実装対象

| ファイル | 変更内容 |
|---|---|
| `frontend/src/server/suggestions/related-topics.ts` | `maxOutputTokens: 300` の個別指定を削除 |
| `frontend/tests/**` | 関連トピック生成の OpenAI 呼び出し条件を検証するテストを追加または更新 |

---

## 受け入れ条件

- [ ] 関連トピック取得で `max_output_tokens = 300` が使われない
- [ ] `responses.parse` の `incomplete` がトークン不足で発生しにくい設定になっている
- [ ] 推薦トピックの件数上限と既存キャッシュ仕様は変わらない
- [ ] `pnpm run lint`
- [ ] `pnpm run test:run`
- [ ] `pnpm run format:check`
