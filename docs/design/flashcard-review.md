# 設計書: 間違い自動復習機能（スペースド・リペティション）

**作成日**: 2026-02-18  
**更新日**: 2026-02-19  
**ステータス**: Draft

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
```

復習問題は新規生成問題と混在した形でセッションに含まれる（先頭に挿入）。

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
  id              TEXT PRIMARY KEY,   -- ULID
  user_id         TEXT NOT NULL,      -- Clerk userId
  question_id     TEXT NOT NULL,      -- questions.id への参照
  next_review_at  INTEGER NOT NULL,   -- Unix timestamp (ms) - 次回出題日時
  wrong_count     INTEGER NOT NULL DEFAULT 1, -- 累計不正解回数（初回登録時は 1）
  UNIQUE (user_id, question_id)
);
```

- `next_review_at <= now()` の行が「今日以降に出題すべき問題」
- 同じ問題を再び間違えた場合は `wrong_count` をインクリメントし `next_review_at` を翌日に更新（UPSERT）
- 復習問題に正解した場合は `next_review_at` を 30 日後に更新

### `questions` テーブルへの参照

既存の `questions` テーブルに保存済みの `questionId` を参照するため、スキーマ変更は最小限。  
`prompt` / `choices` / `answer` / `explanation` はすでに保存されているため、復習時もそのまま再利用できる。

---

## API 設計

### `POST /api/review-queue/wrong` — 不正解を復習キューへ登録（UPSERT）

回答処理（`POST /api/quiz/sessions/:sessionId/answers`）のサーバー側処理に統合し、クライアントから明示的に呼ぶ必要はない。不正解時にサーバーが自動で呼び出す内部処理として実装する。

**内部処理**

```typescript
// 不正解時
await db.insert(reviewQueue)
  .values({
    id: ulid(),
    userId,
    questionId,
    nextReviewAt: Date.now() + 24 * 60 * 60 * 1000, // 翌日
    wrongCount: 1,
  })
  .onConflictDoUpdate({
    target: [reviewQueue.userId, reviewQueue.questionId],
    set: {
      nextReviewAt: Date.now() + 24 * 60 * 60 * 1000,
      wrongCount: sql`${reviewQueue.wrongCount} + 1`,
    },
  });
```

---

### `POST /api/review-queue/correct` — 復習問題の正解を記録

復習セッション中に正解した場合、次回出題日を 30 日後へ延ばす。  
通常問題（`review_queue` に登録されていない問題）の正解時は何もしない。

**内部処理**

```typescript
// 復習問題に正解時
await db.update(reviewQueue)
  .set({ nextReviewAt: Date.now() + 30 * 24 * 60 * 60 * 1000 }) // 30 日後
  .where(
    and(
      eq(reviewQueue.userId, userId),
      eq(reviewQueue.questionId, questionId),
    )
  );
```

---

### `GET /api/review-queue/due` — 期限切れ復習問題一覧取得

**レスポンス**

```typescript
{
  items: Array<{
    questionId: string;
    prompt: string;
    choices: Array<{ index: number; text: string }>;
    answer: number;
    explanation: string;
    topic: string;
    nextReviewAt: number;
    wrongCount: number;
  }>;
}
```

`next_review_at <= nowMs` の行を返す。セッション開始時にクライアントが呼び出し、復習問題を新規問題に先行して出題する。

---

### `GET /api/review-queue` — 復習キュー全件一覧（UI 用）

```typescript
{
  dueItems: Array<{ ... }>;      // next_review_at <= today
  upcomingItems: Array<{ ... }>; // next_review_at > today
}
```

---

### `POST /api/quiz/sessions` の変更（復習問題埋め込み対応）

```typescript
// Before
{ topic: string; mode: "word" | "reading" }

// After
{ topic: string; mode: "word" | "reading"; reviewQuestionIds?: string[] }
```

- `reviewQuestionIds` が渡された場合、その問題を先頭に挿入し、残りは LLM で生成した問題で補完する
- 合計問題数は引き続き最大 5 問

---

## 処理フロー

### 不正解 → 自動スケジュール登録

```
1. ユーザーがクイズに回答（不正解）
2. POST /api/quiz/sessions/:sessionId/answers（既存）
3. サーバーが不正解を検知 → review_queue に UPSERT（翌日を next_review_at に設定）
4. レスポンスに isReviewRegistered: true を含める
5. クライアントが「明日の復習に追加されました」通知を表示
```

### 翌日以降の学習セッション開始（復習問題込み）

```
1. ユーザーが /learn でトピックを入力
2. クライアントが GET /api/review-queue/due で期限切れ復習問題を取得
3. POST /api/quiz/sessions { topic, mode, reviewQuestionIds: dueIds }
4. サーバーが reviewQuestionIds の問題を取得（LLM 不要）
5. 残りの枠数分だけ LLM で新規問題を生成して結合
6. 通常のクイズセッションと同じ UI で出題
```

### 復習問題に正解

```
1. ユーザーが復習問題に回答（正解）
2. POST /api/quiz/sessions/:sessionId/answers（既存）
3. サーバーが当該 question_id の review_queue レコードを 30 日後に更新
4. レスポンスに reviewNextAt フィールドを含める
5. クライアントが「30 日後に再出題します」メッセージを表示
```

---

## 影響を受けるファイル一覧

| ファイル | 変更種別 | 内容 |
|----------|----------|------|
| `src/db/schema.ts` | 変更 | `review_queue` テーブル追加 |
| `src/db/migrations/` | 追加 | Drizzle migration ファイル生成 |
| `src/app/api/[[...route]]/app.ts` | 変更 | `/api/review-queue` ルート追加 |
| `src/app/api/[[...route]]/review-queue.ts` | 新規 | GET /due, GET / ハンドラ |
| `src/app/api/[[...route]]/quiz.ts` | 変更 | 回答処理に自動キュー登録ロジック追加、復習問題埋め込み対応 |
| `src/app/(features)/learn/_components/LearnPage.tsx` | 変更 | 期限切れ復習問題バナー表示、セッション開始時に reviewQuestionIds を渡す |
| `src/app/(features)/session/_components/SessionPage.tsx` | 変更 | 不正解時「復習に追加」通知、復習正解時「30日後」通知 |
| `src/app/(features)/review-queue/page.tsx` | 新規 | 復習キュー一覧ページ |
| `src/app/(features)/review-queue/_components/ReviewQueuePage.tsx` | 新規 | 復習キュー UI コンポーネント |
| `src/app/(features)/review-queue/_api/query.ts` | 新規 | 復習キューデータ取得 |

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

- [ ] 1セッションに含める復習問題の上限数（例: 最大 2 問まで）を設けるか検討
- [ ] SM-2 等のより精密なアルゴリズムへの移行は将来対応とするか検討
- [ ] 復習キュー一覧から個別削除を許可するか検討
