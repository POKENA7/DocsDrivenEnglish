# 設計書: 間違い自動復習機能（スペースド・リペティション）

**作成日**: 2026-02-18  
**更新日**: 2026-02-23  
**ステータス**: 実装済み

---

## 背景・課題

現在の実装では、クイズ回答後に解説を確認したら問題が流れて終わる。間違えた問題を後から見返す手段がないため、記憶が定着しにくい。

英語学習において「繰り返し」は不可欠であり、間違えた問題を自動的に復習スケジュールへ登録する仕組みが学習効果を大幅に高める。

---

## 解決方針

ユーザーが間違えた問題を**自動的に**復習候補へ登録し、翌日以降の学習セッション時に自動出題する。手動ブックマークは不要。

復習の出題頻度は間違えた回数に基づくシンプルなスペースド・リペティションで制御する。

```
通常学習フロー:  トピック入力 → クイズ → 不正解 → 自動で復習スケジュール登録
復習フロー:     翌日以降に学習開始 → 期限切れ復習問題を自動的に先頭に挿入
```

### 復習スケジュールルール

| イベント | 次回出題まで |
|----------|-------------|
| 間違えた（初回 / 再挑戦どちらも）| 翌日（24時間後） |
| 復習問題に正解した | 30日後 |

- 翌日に復習問題で再び間違えた場合 → さらに翌日に再登録（リセット）
- 30日後の復習問題で正解した場合 → 再度 30日後（継続してスケジュール維持）
- 30日後の復習問題でまた間違えた場合 → 翌日に戻る

---

## UI 設計

### 学習開始画面（`/learn`）

期限切れの復習問題がある場合、バナーで通知する。

```
┌──────────────────────────────────────────┐
│ 📚 復習問題が 3 件あります               │
│ 今日の学習に自動で含まれます             │
└──────────────────────────────────────────┘

[トピックを入力して新しい学習を始める]
[出題問題数: 10]
[うち復習問題数（上限）: 2問まで ▾]
```

- 復習問題数の上限はユーザーが `select` UI で設定可能（0〜questionCount-1 の範囲）
- 設定した件数内でサーバーが期限切れ問題を自動選択する（クライアントは特定 ID を指定しない）

### 回答後の解説画面

手動ブックマークボタンは不要。不正解時に自動登録される旨を自然に伝える。

```
┌──────────────────────────────────────────┐
│ ✗ 不正解                                 │
│                                          │
│ 解説テキスト ...                         │
│                                          │
│ 📌 この問題は明日の復習に追加されました  │
│                                          │
│ [次の問題へ →]                           │
└──────────────────────────────────────────┘
```

正解時（復習問題の場合）：

```
┌──────────────────────────────────────────┐
│ ✓ 正解                                   │
│                                          │
│ 解説テキスト ...                         │
│                                          │
│ 🎉 復習クリア！次回は 30 日後に出題します │
│                                          │
│ [次の問題へ →]                           │
└──────────────────────────────────────────┘
```

### 復習一覧ページ（`/review-queue`）

```
┌──────────────────────────────────────────┐
│ 復習キュー  (5件)                        │
│                                          │
│ ─── 今日出題予定 ──────────────────────  │
│ ┌────────────────────────────────────┐   │
│ │ "lifecycle" — React Hooks          │   │
│ │ 不正解回数: 2  次回: 今日          │   │
│ └────────────────────────────────────┘   │
│                                          │
│ ─── 今後の予定 ─────────────────────── │
│ ┌────────────────────────────────────┐   │
│ │ "orchestration" — Kubernetes       │   │
│ │ 不正解回数: 1  次回: 2026-03-20    │   │
│ └────────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

- 「今日出題予定」と「今後の予定」でグループ分け
- 削除ボタンは設けない（自動管理のみ）
- 一覧はログイン必須（未ログイン時はログイン促進メッセージを表示）

---

## データモデル

### 新規テーブル: `review_queue`

```sql
CREATE TABLE review_queue (
  id              TEXT PRIMARY KEY,   -- crypto.randomUUID()
  user_id         TEXT NOT NULL,      -- Clerk userId
  question_id     TEXT NOT NULL,      -- questions.question_id への参照
  next_review_at  INTEGER NOT NULL,   -- Unix timestamp (ms) - 次回出題日時
  wrong_count     INTEGER NOT NULL DEFAULT 1, -- 累計不正解回数（初回登録時は 1）
  UNIQUE (user_id, question_id)
);
```

- `next_review_at <= now()` の行が「今日以降に出題すべき問題」
- 同じ問題を再び間違えた場合は `wrong_count` をインクリメントし `next_review_at` を翌日に更新（UPSERT）
- 復習問題に正解した場合は `next_review_at` を 30 日後に更新

### `questions` テーブルへの変更

復習問題をセッションに埋め込む際、元の question をそのまま参照せず**新規レコードとして複製**する方式を採用。  
これにより session/question の所有関係がシンプルになる。

```sql
-- 既存テーブルに追加したカラム
source_question_id  TEXT,  -- 復習問題として複製された場合の複製元 question_id（通常問題は NULL）
```

- 回答処理時、`source_question_id` が存在する場合はそちらの `question_id` を使って `review_queue` を更新する
- これにより「どの元問題に対する復習か」を正確に追跡できる

---

## API 設計

> **注**: Hono API は廃止済みのため、すべての処理は Next.js Server Actions として実装している。  
> 外部 API エンドポイント（`/api/review-queue/*`）は存在しない。

### `startQuizSession` — セッション開始（復習問題埋め込み対応）

`src/app/(features)/learn/_api/mutations.ts` に実装。

**入力**

```typescript
{
  topic: string;
  mode: "word" | "reading";
  questionCount?: number;      // デフォルト 10
  reviewQuestionCount?: number; // 復習問題の上限数（デフォルト 0）
  userId: string;
}
```

> 設計当初は `reviewQuestionIds?: string[]`（特定 ID 指定）を想定していたが、  
> サーバー側で due 問題を自動選択する方式（件数上限だけ渡す）に変更した。

**処理内容**

1. `review_queue` から `next_review_at <= now()` の行を `reviewQuestionCount` 件まで取得
2. 取得した元 question を**新規 `question_id` / `session_id` で複製**し、`source_question_id` に元 ID を記録
3. 残りの枠数 (`questionCount - reviewQuestions.length`) 分だけ LLM で新規問題を生成
4. 復習問題を先頭・AI 生成問題を後ろに結合してセッションを保存

---

### `submitQuizAnswer` — 回答処理（review_queue 更新込み）

`src/app/(features)/learn/_api/mutations.ts` に実装。

**処理内容**

```typescript
// review_queue を更新する対象 ID（複製問題なら sourceQuestionId を使う）
const reviewKeyId = q.sourceQuestionId ?? q.questionId;

if (!isCorrect) {
  // 不正解: UPSERT（翌日に nextReviewAt をセット、wrongCount をインクリメント）
  await db.insert(reviewQueue).values({ ... nextReviewAt: now + 24h ... })
    .onConflictDoUpdate({ set: { nextReviewAt, wrongCount: wrongCount + 1 } });
  out.isReviewRegistered = true;
} else {
  // 正解: review_queue に存在する場合のみ 30 日後に更新
  const updated = await db.update(reviewQueue).set({ nextReviewAt: now + 30d })
    .where(userId === ... && questionId === reviewKeyId).returning();
  if (updated.length > 0) out.reviewNextAt = nextReviewAt;
}
```

**レスポンス**

```typescript
{
  isCorrect: boolean;
  explanation: string;
  isReviewRegistered?: boolean; // 不正解時のみ true
  reviewNextAt?: number;        // 復習問題に正解した場合のみ（ms）
}
```

---

### `getDueReviewCount` — 期限切れ復習問題件数

`src/app/(features)/review-queue/_api/query.ts` に実装。React `cache()` でリクエスト内重複排除。  
`LearnPage` のバナー表示数取得に使用。

---

### `getReviewQueue` — 復習キュー全件一覧

`src/app/(features)/review-queue/_api/query.ts` に実装。React `cache()` でリクエスト内重複排除。

```typescript
{
  dueItems: ReviewQueueDisplayItem[];      // next_review_at <= 現在時刻
  upcomingItems: ReviewQueueDisplayItem[]; // next_review_at > 現在時刻
}
```

---

## 処理フロー

### 不正解 → 自動スケジュール登録

```
1. ユーザーがクイズに回答（不正解）
2. submitQuizAnswerAction（Server Action）が呼ばれる
3. サーバーが不正解を検知 → review_queue に UPSERT（翌日を next_review_at に設定）
   ※複製問題の場合は source_question_id の question_id をキーに使う
4. レスポンスに isReviewRegistered: true を含める
5. クライアントが「明日の復習に追加されました」通知を表示
```

### 翌日以降の学習セッション開始（復習問題込み）

```
1. ユーザーが /learn でトピック・出題数・復習問題数上限を入力
2. startSessionFormAction（Server Action）が呼ばれる
3. サーバーが review_queue から期限切れ問題を reviewQuestionCount 件取得
4. 取得した元問題を新規 questionId / sessionId で複製（sourceQuestionId に元 ID を記録）
5. 残り枠数分だけ LLM で新規問題を生成
6. 復習問題が先頭になるよう結合して DB に保存
7. 通常のクイズセッションと同じ UI で出題
```

### 復習問題に正解

```
1. ユーザーが復習問題に回答（正解）
2. submitQuizAnswerAction（Server Action）が呼ばれる
3. サーバーが source_question_id を使って review_queue の next_review_at を 30 日後に更新
4. レスポンスに reviewNextAt フィールドを含める
5. クライアントが「30 日後に再出題します」メッセージを表示
```

---

## 影響を受けるファイル一覧

| ファイル | 変更種別 | 内容 |
|----------|----------|------|
| `src/db/schema.ts` | 変更 | `review_queue` テーブル追加、`questions` に `source_question_id` カラム追加 |
| `src/db/migrations/` | 追加 | Drizzle migration ファイル生成済み |
| `src/app/(features)/learn/_api/mutations.ts` | 変更 | `startQuizSession` に復習問題埋め込み対応追加、`submitQuizAnswer` に review_queue 更新ロジック追加 |
| `src/app/(features)/learn/_api/actions.ts` | 変更 | `startSessionFormAction` に `questionCount` / `reviewQuestionCount` パラメータ追加 |
| `src/app/(features)/learn/_components/LearnPage.tsx` | 変更 | 期限切れ復習問題バナー表示、`reviewQuestionCount` UI 追加 |
| `src/app/(features)/learn/_components/SessionPage.tsx` | 変更 | 不正解時「復習に追加」通知、復習正解時「30日後」通知表示 |
| `src/app/(features)/learn/page.tsx` | 変更 | `getDueReviewCount` 呼び出し追加 |
| `src/app/(features)/review-queue/page.tsx` | 新規 | 復習キュー一覧ページ |
| `src/app/(features)/review-queue/_api/query.ts` | 新規 | `getDueReviewCount` / `getReviewQueue` 実装 |

---

## 非機能要件

| 項目 | 内容 |
|------|------|
| ログイン必須 | 復習スケジュールは DB 管理のため、ログイン必須。未ログイン時は復習機能を非表示にする |
| LLM コスト | 復習問題は既存 `questions` を再利用するため追加の LLM 費用ゼロ |
| パフォーマンス | 1ユーザーあたり最大 1000 件を想定（ページネーション対応は将来対応） |
| 自動管理 | ユーザーが意識せずとも間違えた問題が自動登録・自動出題される |

---

## 未解決事項（TODO）

- [x] 1セッションに含める復習問題の上限数（例: 最大 2 問まで）— UIから設定可能にして実装済み
- [ ] SM-2 等のより精密なアルゴリズムへの移行は将来対応とするか検討→将来的には対応するが、今回は実装しない
- [ ] 復習キュー一覧から個別削除を許可するか検討→削除は許可しない
