# 設計書: トピック推薦チップ機能の追加

**作成日**: 2026-03-07  
**ステータス**: 設計中  
**Issue**: #64

---

## 背景

`/learn` の AI 生成タブは完全な自由入力だけで学習を始めるため、何を入力すればよいか迷いやすい。  
一方で Issue #65 により、セッション完了後は毎回 `/learn` に戻って次の学習条件を選び直すフローへ単純化された。

この前提では、Issue #64 の役割は「継続学習のために生成ソースを引き回すこと」ではなく、**学習開始時に選べる入力ソースを増やし、適切な生成ソース情報をそのセッション内へ保存すること**に整理し直す必要がある。

---

## 変更方針

- `/learn` の AI 生成タブに、入力欄の下で推薦チップを表示する
- 推薦チップは「関連技術」と「トレンド」の 2 グループに分ける
- 学習開始時は `topic` 文字列とは別に、実際の生成ソースを表す `sourceType` / `sourceKey` を扱う
- `sourceType = manual` のセッションだけを、今後の関連技術チップ生成元として使う
- セッション完了後は Issue #65 の方針どおり `/learn` に戻るだけとし、継続学習導線は追加しない

---

## 重要な設計方針

### 1. displayTopic と生成ソースを分離する

セッション・問題には、少なくとも以下の情報を持たせる。

- `displayTopic`: UI 表示用の文字列
- `sourceType`: `manual` / `hn_trend` / `shared`
- `sourceKey`: 生成元を識別するキー

使い分けは以下のとおり。

| sourceType | displayTopic | sourceKey |
|---|---|---|
| `manual` | ユーザーが入力したトピック | `null` |
| `hn_trend` | 記事タイトル | `articleKey` |
| `shared` | 共有クイズ用の固定表示文字列 | `null` |

これにより、表示用テキストと実際の生成ソースがずれることを防ぎつつ、履歴ベース推薦で `manual` 以外を除外できる。

### 2. 継続学習の要件は持ち込まない

Issue #65 により、セッション完了画面から同じトピックで続ける導線は削除済みである。  
そのため Issue #64 では、継続時の `sourceType` / `sourceKey` 引き継ぎは考慮しない。

`sourceType` / `sourceKey` を保存する目的は以下に限定する。

- セッション内でどの素材から問題を生成したかを保持する
- `manual` 起点の履歴だけを関連技術チップの生成元に使う
- HN 記事ベース出題時に、サーバー管理の `articleKey` から安全に素材を解決する

### 3. 推薦チップ取得でフォーム全体を待たせない

`/learn` の入力フォーム自体は先に表示し、推薦チップ部分だけを `Suspense` 配下で遅延描画する。  
OpenAI API や Hacker News API、D1 キャッシュの取得待ちでフォーム全体をブロックしない。

### 4. articleKey はサーバー管理値だけを扱う

トレンドチップからの開始では hidden input に URL を入れず、サーバーが発行・保持する `articleKey` のみを送る。  
Server Action 側で `articleKey` の形式を厳密に検証し、実際に参照する URL は D1 のキャッシュレコードから解決する。

---

## チップ仕様

### 関連技術チップ

- 対象ユーザー: `sourceType = manual` の履歴があるユーザー
- 取得元: 直近の manual セッションの `displayTopic`
- 生成方法: OpenAI API に最近の学習トピックを渡して関連技術 3 件を生成
- キャッシュ: `topic_suggestions_cache` にユーザー単位で 1 日キャッシュ
- クリック時: トピック入力欄に反映し、`sourceType = manual` で既存フォーム送信を使う
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
2. `topic` をそのまま `displayTopic` として使う
3. `sourceType = manual`, `sourceKey = null` でセッションを開始する
4. AI はトピック文字列をもとに問題を生成する

### hn_trend

1. ユーザーがトレンドチップを選択する
2. UI は入力欄に記事タイトルを表示しつつ、hidden input に `articleKey` をセットする
3. Server Action は `articleKey` を検証し、D1 キャッシュから記事 URL を取得する
4. 記事本文を抽出して AI へ渡し、記事コンテンツを素材に問題を生成する
5. 本文抽出や記事取得に失敗した場合は失敗として扱い、topic ベース生成へフォールバックしない

### shared

- 現行どおり shared pool から問題を取得してセッションを開始する
- `sourceType = shared`, `displayTopic = "他のユーザーが作成したクイズ"` を保存する
- shared 起点のセッションは関連技術チップの推薦元に含めない

---

## DB スキーマ変更

### `sessions`

| カラム | 内容 |
|---|---|
| `topic` | 互換性維持のため当面残す。manual の入力値、hn_trend の場合は記事タイトルを入れる |
| `display_topic` | UI 表示用の文字列 |
| `source_type` | `manual` / `hn_trend` / `shared` |
| `source_key` | `articleKey` などの生成元識別子。manual/shared は `null` 可 |

### `questions`

| カラム | 内容 |
|---|---|
| `topic` | 互換性維持のため当面残す |
| `display_topic` | UI 表示用の文字列 |
| `source_type` | 問題生成の元になったソース種別 |
| `source_key` | 問題生成の元になったソース識別子 |

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
| `frontend/src/db/schema.ts` | `sessions` / `questions` に `display_topic`・`source_type`・`source_key` を追加し、キャッシュテーブルを追加 |
| `frontend/src/db/migrations/*` | 上記変更に対応する D1 / Drizzle マイグレーションを追加 |
| `frontend/src/server/quiz/session.ts` | `startQuizSession` が `displayTopic` / `sourceType` / `sourceKey` を受け取れるように変更 |
| `frontend/src/server/quiz/generate.ts` | topic ベース生成と記事コンテンツベース生成を分岐できるように変更 |
| `frontend/src/server/quiz/query.ts` | セッション結果・画面表示で `displayTopic` を返す |
| `frontend/src/server/quiz/shared-session.ts` | shared セッションに `sourceType = shared` を保存 |
| `frontend/src/server/suggestions/related-topics.ts` | manual 履歴から関連技術チップを取得・キャッシュする新規ロジック |
| `frontend/src/server/suggestions/hn-trends.ts` | HN トレンド取得・キャッシュ・articleKey 解決の新規ロジック |
| `frontend/src/app/(features)/learn/page.tsx` | `Suspense` を使ってフォームと推薦チップを段階描画 |
| `frontend/src/app/(features)/learn/_api/actions.ts` | `articleKey` を受け取り、バリデーションしてセッション開始へ渡す |
| `frontend/src/app/(features)/learn/_components/LearnPage.tsx` | hidden input とチップ選択状態を持てるように変更 |
| `frontend/src/app/(features)/learn/_components/TopicSuggestions.tsx` | 推薦チップ UI の新規追加 |
| `frontend/src/app/(features)/learn/_components/SessionCompletePage.tsx` | `displayTopic` を表示しつつ、完了後は `/learn` に戻る導線のみ維持 |
| `docs/SPEC.md` | 推薦チップ・トレンド記事ベース出題・継続学習廃止後の学習開始フローを反映 |

---

## テスト方針

- `startSessionFormAction` に `manual` / `hn_trend` の入力分岐テストを追加する
- `articleKey` の形式バリデーションと、manual 入力時の `articleKey` クリア挙動をテストする
- `server/suggestions/*` にキャッシュ命中・期限切れ・初回ユーザー時の分岐テストを追加する
- `startQuizSession` / `startSharedQuizSession` が `displayTopic` / `sourceType` / `sourceKey` を保存することをテストする
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

