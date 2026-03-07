# 設計書: トピック推薦チップ機能の追加

**作成日**: 2026-03-07  
**更新日**: 2026-03-08  
**ステータス**: 設計中  
**Issue**: #64

---

## 背景

`/learn` の AI 生成タブは自由入力だけで学習を始めるため、何を入力すればよいか迷いやすい。  
一方で PR #66 により continue learning 導線は削除され、セッション完了後は毎回 `/learn` に戻って次の学習条件を選び直すフローへ統一された。

この変更により、Issue #64 の役割は **学習開始時に選べる入力ソースを増やすこと** に限定できる。  
継続学習のために生成元を永続化して引き回す設計は、現時点では不要である。

---

## 変更方針

- `/learn` の AI 生成タブに、入力欄の下で推薦チップを表示する
- 推薦チップは「関連技術」と「トレンド」の 2 グループに分ける
- 学習開始時は `topic` に加えて、推薦元の種別を表す `sourceType` を扱う
- HN trend 記事の識別子 `articleKey` は、学習開始時の入力値としてのみ扱う
- `sourceType = manual` の履歴だけを、今後の関連技術チップ生成元として使う
- セッション完了後は PR #66 の方針どおり `/learn` に戻るだけとし、継続学習導線は追加しない

---

## 重要な設計方針

### 1. 追加する永続化情報は `sourceType` のみに絞る

今回の要件で永続的に必要なのは、「そのセッションや問題が manual / hn_trend / shared のどれから始まったか」という区別だけである。

- `topic`: 既存どおり保存する
- `sourceType`: 推薦元の絞り込みのために保存する
- `articleKey`: 学習開始時にだけ使い、DB には保存しない
- `displayTopic`: 現状は `topic` と同じ値になるため、新カラムは追加しない

将来的に「表示文字列と生成入力文字列が本当に分岐する要件」が出た時点で、初めて `displayTopic` や別管理カラムを検討する。

### 2. 継続学習の要件は持ち込まない

PR #66 により、セッション完了画面から同じソースで続ける導線は削除済みである。  
そのため Issue #64 では、セッション完了後に同じ `articleKey` や生成元を再利用する設計は持ち込まない。

`sourceType` を保存する目的は以下に限定する。

- `manual` 起点の履歴だけを関連技術チップの生成元に使う
- `shared` や `hn_trend` 起点の履歴を推薦元から除外する
- 復習セッション作成時も、元問題の推薦元種別を維持する

### 3. 推薦チップ取得でフォーム全体を待たせない

`/learn` の入力フォーム自体は先に表示し、推薦チップ部分だけを `Suspense` 配下で遅延描画する。  
OpenAI API や Hacker News API、D1 キャッシュの取得待ちでフォーム全体をブロックしない。

### 4. `articleKey` はサーバー管理値だけを扱う

トレンドチップからの開始では hidden input に URL を入れず、サーバーが発行・保持する `articleKey` のみを送る。  
Server Action 側で `articleKey` の形式を厳密に検証し、実際に参照する URL は D1 のキャッシュレコードから解決する。

本文取得や記事解決に失敗した場合は、その開始リクエストを失敗として扱い、topic ベース生成へフォールバックしない。

---

## チップ仕様

### 関連技術チップ

- 対象ユーザー: `sourceType = manual` の履歴があるユーザー
- 取得元: 直近の manual セッションの `topic`
- 生成方法: OpenAI API に最近の学習トピックを渡して関連技術 3 件を生成
- キャッシュ: `topic_suggestions_cache` にユーザー単位で 1 日キャッシュ
- クリック時: トピック入力欄に反映し、通常の manual 開始として既存フォーム送信を使う
- 初回ユーザー: このセクションは非表示

### トレンドチップ

- 対象ユーザー: 全ユーザー
- 取得元: Hacker News API の上位記事
- 表示内容: 少なくとも `articleKey`, `title`, `url` を持つ 3 件
- キャッシュ: `hn_trend_cache` にグローバルで 1 日キャッシュ
- クリック時: 入力欄に記事タイトルを反映し、hidden input に `articleKey` を設定する
- 学習開始時: `articleKey` から記事 URL と本文を解決し、その内容を素材にクイズ生成する

### 入力欄を手動編集した場合

- ユーザーが入力欄を編集した時点で、選択済みの `articleKey` はクリアする
- その後の送信は `sourceType = manual` として扱う

---

## 学習開始フロー

### manual

1. ユーザーがトピックを入力する、または関連技術チップを選択する
2. `topic` をそのまま学習テーマとして使う
3. `sourceType = manual` でセッションを開始する
4. AI はトピック文字列をもとに問題を生成する

### hn_trend

1. ユーザーがトレンドチップを選択する
2. UI は入力欄に記事タイトルを表示しつつ、hidden input に `articleKey` をセットする
3. Server Action は `articleKey` を検証し、D1 キャッシュから記事 URL を取得する
4. 記事本文を抽出して AI へ渡し、記事コンテンツを素材に問題を生成する
5. DB には `topic = 記事タイトル`, `sourceType = hn_trend` を保存し、`articleKey` 自体は保存しない

### shared

- 現行どおり shared pool から問題を取得してセッションを開始する
- `topic = "他のユーザーが作成したクイズ"`, `sourceType = shared` を保存する
- shared 起点のセッションは関連技術チップの推薦元に含めない

---

## DB スキーマ変更

### `sessions`

| カラム | 内容 |
|---|---|
| `topic` | 既存どおり使用する。manual の入力値、hn_trend の場合は記事タイトルを入れる |
| `source_type` | `manual` / `hn_trend` / `shared` |

### `questions`

| カラム | 内容 |
|---|---|
| `topic` | 既存どおり使用する |
| `source_type` | 問題生成の元になったソース種別 |

### `topic_suggestions_cache`

| カラム | 内容 |
|---|---|
| `user_id` | Clerk user id。PK |
| `topics` | 推薦トピック配列を JSON 文字列で保存 |
| `cached_at` | キャッシュ生成時刻 |

### `hn_trend_cache`

| カラム | 内容 |
|---|---|
| `id` | 常に 1 を使う単一レコード |
| `articles` | `{ articleKey, title, url }[]` を JSON 文字列で保存 |
| `cached_at` | キャッシュ生成時刻 |

---

## 実装対象

| ファイル | 変更内容 |
|---|---|
| `frontend/src/db/schema.ts` | `sessions` / `questions` に `source_type` を追加し、キャッシュテーブルを追加 |
| `frontend/src/db/migrations/*` | 上記変更に対応する D1 / Drizzle マイグレーションを追加 |
| `frontend/src/server/quiz/session.ts` | `startQuizSession` が `sourceType` と一時入力の `articleKey` を受け取れるように変更 |
| `frontend/src/server/quiz/generate.ts` | topic ベース生成と記事コンテンツベース生成を分岐できるように変更 |
| `frontend/src/server/quiz/query.ts` | 既存の `topic` をそのまま返す |
| `frontend/src/server/quiz/shared-session.ts` | shared セッションに `sourceType = shared` を保存 |
| `frontend/src/server/suggestions/related-topics.ts` | manual 履歴から関連技術チップを取得・キャッシュする新規ロジック |
| `frontend/src/server/suggestions/hn-trends.ts` | HN トレンド取得・キャッシュ・articleKey 解決の新規ロジック |
| `frontend/src/app/(features)/learn/page.tsx` | `Suspense` を使ってフォームと推薦チップを段階描画 |
| `frontend/src/app/(features)/learn/_api/actions.ts` | `articleKey` を受け取り、バリデーションしてセッション開始へ渡す |
| `frontend/src/app/(features)/learn/_components/LearnPage.tsx` | hidden input とチップ選択状態を持てるように変更 |
| `frontend/src/app/(features)/learn/_components/TopicSuggestions.tsx` | 推薦チップ UI の新規追加 |
| `frontend/src/app/(features)/learn/_components/SessionCompletePage.tsx` | 完了後は `/learn` に戻る導線のみ維持 |
| `docs/SPEC.md` | 推薦チップ・トレンド記事ベース出題・継続学習廃止後の学習開始フローを反映 |

---

## 今回あえて追加しないもの

- `display_topic` カラム
- `source_key` カラム
- `StartSessionResponse` への `sourceKey` / `displayTopic` 返却追加
- セッション完了後に同じ HN 記事や同じ推薦元で続ける導線

これらは現時点の Issue #64 では読み取り先がなく、PR #66 後の要件に対して過剰であるため追加しない。

---

## テスト方針

- `startSessionFormAction` に `manual` / `hn_trend` の入力分岐テストを追加する
- `articleKey` の形式バリデーションと、manual 入力時の `articleKey` クリア挙動をテストする
- `server/suggestions/*` にキャッシュ命中・期限切れ・初回ユーザー時の分岐テストを追加する
- `startQuizSession` / `startSharedQuizSession` が `sourceType` を保存することをテストする
- 記事本文の取得失敗時はフォールバックせずエラーになることをテストする
- 既存の shared / review / session 完了フローが壊れていないことを既存テストで確認する

---

## 受け入れ条件

- [ ] 初回ユーザーには「トレンド」チップのみ表示される
- [ ] manual 履歴があるユーザーには「関連技術」「トレンド」の両方が表示される
- [ ] 関連技術チップの推薦元は `sourceType = manual` の履歴のみである
- [ ] 推薦チップ取得中でも `/learn` の入力フォームは先に表示される
- [ ] トレンドチップ選択時、クライアントから送る hidden input は URL ではなく `articleKey` のみである
- [ ] 入力欄を手動で編集した場合、選択済み `articleKey` はクリアされる
- [ ] `articleKey` 付きのセッションは記事コンテンツを素材に問題を生成する
- [ ] 記事コンテンツ取得に失敗した場合、topic ベース生成へフォールバックせずエラーになる
- [ ] shared セッションは `sourceType = shared` として保存され、関連技術チップの推薦元に含まれない
- [ ] セッション完了画面には継続学習導線を追加せず、`/learn` に戻る導線のみが維持される
- [ ] `pnpm run lint`
- [ ] `pnpm run test:run`
- [ ] `pnpm run format:check`
- [ ] `pnpm run build`

