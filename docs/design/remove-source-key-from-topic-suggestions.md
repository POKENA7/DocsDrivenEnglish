# Issue #64 簡素化メモ

## 背景

PR #66 により continue learning が削除され、Issue #64 は「次の学習を始める時にどの入力ソースを選べるか」に責務を絞れるようになった。

その前提で `.worktrees/issue64` の差分を確認すると、推薦チップ自体とは独立した永続化が複数追加されている。

- `display_topic`
- `source_key`
- `StartSessionResponse` への追加フィールド
- review session 作成時のコピー処理

これらは、現状の UI / Server Action / query の読み取り箇所に対して過剰である。

## 結論

- **残すべきもの**
  - 推薦チップ UI
  - HN trend キャッシュ
  - related topics キャッシュ
  - `articleKey` の入力バリデーション
  - `source_type` の永続化
- **削るべきもの**
  - `display_topic` の追加
  - `source_key` の永続化
  - `StartSessionResponse.sourceKey`
  - `StartSessionResponse.displayTopic`
  - それらに伴う query / response / review session のコピー処理

## 根拠

### 1. `source_key` は生成前の入力としては必要だが、生成後の保存先がない

`articleKey` の実利用箇所は、HN trend 開始時に記事本文を解決する部分で完結している。

- `startSessionFormAction()` が hidden input の `articleKey` を受け取る
- `startQuizSession()` が生成処理へ渡す
- `generateQuizItemsFromSource()` が記事本文を取得する

一方で、生成後に保存した `source_key` を読むユースケースは存在しない。

### 2. `display_topic` は現状 `topic` と同値であり、追加カラムの意味がない

Issue #64 の現行案では、manual はユーザー入力、hn_trend は記事タイトル、shared は固定文言を `topic` に入れる。  
これは既存の `topic` カラムだけで表現できる。

表示用文字列が将来的に分岐する可能性はあるが、現時点ではその要件は存在しない。

### 3. 推薦ロジックに必要なのは「元が manual かどうか」だけ

関連技術チップで必要なのは、履歴から `shared` と `hn_trend` を除外することだけである。  
そのために必要なのは `source_type` であり、`source_key` や `display_topic` ではない。

## 実装削減ポイント

### DB / migration

- `sessions`: `source_type` のみ追加
- `questions`: `source_type` のみ追加
- `display_topic` / `source_key` 用 migration を削除
- snapshot と journal を `source_type` のみ反映した形に縮小

### server/quiz

- `startQuizSession()` の入力は `topic`, `sourceType`, `articleKey` で十分
- `generateQuizItemsFromSource()` の引数は `topic`, `sourceType`, `articleKey` で十分
- `startSingleReviewSession()` は `questions.sourceType` だけ引き継げばよい
- `query.ts` は既存の `topic` を返すだけでよい
- `StartSessionResponse` は既存の `topic` ベースに留める

### learn UI / action

- LearnPage は hidden input で `articleKey` を持てばよい
- チップ選択時は入力欄に記事タイトルを反映するだけでよい
- SessionPage / SessionCompletePage の表示は既存の `topic` を使えばよい

### テスト

- `source_type` 保存確認は残す
- `source_key` / `display_topic` 保存確認は削除する
- HN trend 生成が `articleKey` 入力だけで成立することを確認する

## この簡素化で減るもの

- DB カラム 4 個追加案が 2 個追加に減る
- query / response 型の変更範囲が縮小する
- review session のコピー責務が減る
- migration と snapshot の差分が小さくなる
- 仕様変更時のレビュー観点が減る
