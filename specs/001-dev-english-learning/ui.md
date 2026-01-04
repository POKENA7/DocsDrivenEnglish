# UI: 画面構成と画面遷移（MVP）

**Created**: 2026-01-04  
**Spec**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)  
**Sequence**: [sequence.md](sequence.md)

## 目的

本ドキュメントは、MVPの「各ページで何を表示するか（特に learn ページ）」と「ユーザーがどう遷移するか」を、実装者が迷わない粒度で整理する。

- 画面表示は基本 **日本語**
- 教材（問題文 / 引用）は基本 **英語**
- 未ログインでも学習可能（履歴はセッション内のみ）
- ログイン（Clerk）時は Attempt を永続化し、history で集計表示

## ルーティング一覧（MVP）

- `/`（Marketing）: サービス概要 + 学習開始導線
- `/learn`（Learn）: URL入力 + 検証 + mode 選択（word / reading）+ 学習開始
- `/session/[sessionId]`（Session）: 出題→回答→解説→次へ
- `/session/[sessionId]/complete`（Session Complete）: セッション完了サマリ + 続行導線
- `/history`（History）: 学習履歴（未ログイン時はログイン誘導）

Notes:
- `spec.md` の「トップページ」は、UX上は `/`（Marketing）として扱い、学習の入力は `/learn` に分離する（MVPの最小構成で導線が明確になるため）。

## 画面遷移（全体）

```mermaid
flowchart LR
  A[/(marketing)] -->|学習を始める| B[/learn]
  B -->|URL+modeで開始| D[/session/:sessionId]
  D -->|最後の解説を確認| E[/session/:sessionId/complete]
  E -->|続行| B

  A --> F[/history]
  B --> F
  C --> F
  D --> F
  E --> F

  F -->|ログアウト/未ログイン| G[Clerk Sign in]
  G --> F
```

## 共通レイアウト（全ページ）

### Header

- 左: サービス名（クリックで `/`）
- 右:
  - `History` リンク（`/history`）
  - Clerk の状態表示
    - 未ログイン: `Sign in` ボタン
    - ログイン済み: `UserButton`（Sign out を含む）

### 共通のエラー表示方針（UI）

- 入力ミス（URL不正など）: フォーム直下に短いエラー文（例: 「https:// から始まるURLを入力してください」）
- fetch/抽出失敗: 画面上部（main の先頭）にエラー枠で表示し、再試行導線を必ず出す
- OpenAI生成失敗/timeout: 同上（再試行、またはURL入力へ戻る）

## `/learn`（Learnページ）

### 目的

- 学習対象URLをユーザーから受け取る
- 形式チェックを行い、次のモード選択へ進ませる

### 画面構成

1) **タイトル/説明**
- 見出し: 「ドキュメントURLを入力」
- 補足: 「公開されている公式ドキュメントの1ページのみ対応（crawlしません）」

2) **URL入力フォーム**
- URL入力欄（placeholder例: `https://developer.mozilla.org/...`）
- Primary button: 「開始」
- Secondary: 「例を入力」(任意。MVPでは省略可)

3) **入力チェック結果（フォーム直下）**
- 正常: 何も出さない（もしくは「OK」程度の小表示）
- 不正: FR-002 に従い、理由が分かるエラーを表示
  - 空: 「URLを入力してください」
  - 形式不正: 「http/https のURLを入力してください」

4) **mode選択**

- 2択カード/ボタン:
  - `word`: 「単語モード」
  - `reading`: 「読解モード」
- 各モードに短い説明（例: 単語の意味 / 文の意味理解）
- 未選択時は「開始」ボタンを無効にする（or 押下でエラー表示）

5) **注意書き（小さめ）**
- 「アクセス制限のあるページは取得できない場合があります」
- 「本文が少ないページは問題数が10問未満になることがあります（FR-019）」

### 遷移/動作

- 「開始」押下:
  - URL形式を検証
  - mode を検証
  - OKなら `POST /api/quiz/session { url, mode }`
    - 成功: `/session/[sessionId]` へ遷移
    - 失敗: エラー表示 + 再試行
  - NGなら遷移せずエラー表示

### 主な状態

- Idle: URL入力可能
- Invalid: フォームエラー表示
- Starting: ローディング（「教材を抽出して問題を作っています…」）

Notes:
- mode 選択まで含めることで、ユーザーは1画面で学習開始できる。
- 本ページで本文抽出や問題生成を開始するため、エラー表示（取得失敗/timeout）の再試行導線を必ず用意する。

## `/mode`（Modeページ）

MVPでは `/mode` は **作らない**（`/learn` に統合）。

## `/session/[sessionId]`（Sessionページ）

### 目的

- 出題（4択）→ 回答確定 → 正誤/解説/出典表示 → 次へ、を最大10問繰り返す（FR-007〜FR-011, FR-018, FR-019）

### 画面構成

1) **セッション情報（上部）**
- 進捗: `問題 3 / 10`（実際は `actualCount` に合わせる）
- セッション内集計（未ログインでも表示）:
  - 「回答数」
  - 「正答率」

2) **問題カード**
- 問題文（英語）
- 選択肢（常に4つ）
  - 未選択時は「回答を確定」無効
- Primary: 「回答を確定」

3) **結果/解説（回答確定後に表示）**
- 正誤（例: 正解 / 不正解）
- 解説（日本語）
  - 英語としての意味
  - 技術的な背景/注意点
  - 使用シーン
- 出典（引用テキスト + 元URL）
  - 引用テキスト（英語、長い場合は一部表示+展開はMVPでは省略可）
  - 元URLリンク

4) **次へ導線**
- Primary: 「次の問題へ」
- 最終問題の場合:
  - Primary: 「完了へ」→ `/session/[sessionId]/complete`

### 遷移/動作

- 回答確定: `POST /api/quiz/answer { sessionId, questionId, selectedIndex }`
  - 成功: 結果/解説/出典を表示
  - 失敗: エラー表示 + 再試行（同じ回答送信）

## `/session/[sessionId]/complete`（Session Completeページ）

### 目的

- セッション完了（10問 or 全X問）を明確にし、続行導線を出す（FR-018/FR-019）

### 画面構成

- 見出し: 「セッション完了」
- サマリ:
  - 「全X問」
  - 「正答率」
- CTA:
  - Primary: 「続行して次の10問」→ `/learn?url=<sameUrl>&mode=<sameMode>`（同じ内容で再開）
  - Secondary: 「別のURLで学習」→ `/learn`
  - Link: 「履歴を見る」→ `/history`

Notes:
- 続行は `sequence.md` の通り、次の `POST /api/quiz/session` で新しい `sessionId` を発行する想定。

## `/history`（Historyページ）

### 目的

- 学習履歴の集計を表示する（FR-015/FR-016）

### 画面構成（未ログイン）

- 見出し: 「学習履歴」
- メッセージ: 「ログインすると履歴を保存できます」
- CTA: 「Sign in」
- セッション内の簡易表示（任意）:
  - 直近のセッション結果をローカル保持している場合のみ表示（MVPでは省略可）

### 画面構成（ログイン済み）

- 見出し: 「学習履歴」
- サマリカード:
  - 学習した問題数（attemptCount）
  - 正答率（correctRate）
  - 継続学習日数（studyDays）

### 遷移/動作

- ログイン済み表示の取得: `GET /api/history/summary`（Clerk JWT）

## `/`（Marketingページ）

### 目的

- サービス説明と、学習開始の導線を提供する

### 画面構成

- ヒーロー:
  - タイトル（例: 「技術ドキュメントで英語を学ぶ」）
  - サブコピー（短く）
  - CTA: 「学習を始める」→ `/learn`
- 使い方（3ステップ程度）:
  - URL入力 → モード選択 → 10問クイズ

---

## 実装のための最小データ受け渡し（UI観点）

- `/learn` → `/session/[sessionId]`: APIレスポンスの `sessionId`
- `/session` → `/complete`: `sessionId`（path param）

Notes:
- query string に `url` を載せる必要はなくなるが、再読込時の復元など実装都合で使ってもよい（UXは同一に保つ）。
