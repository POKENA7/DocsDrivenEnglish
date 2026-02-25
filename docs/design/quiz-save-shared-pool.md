# 設計書: クイズ保存・共有機能（Shared Question Pool）

**作成日**: 2026-02-25  
**ステータス**: Draft  
**Issue**: [#19 クイズ保存機能](https://github.com/POKENA7/DocsDrivenEnglish/issues/19)

---

## 背景・課題

現在の実装では、クイズ（`questions` テーブルの各問題）は特定の `study_sessions` に紐付いており、そのセッションを開始したユーザーのみが解くことができる。

同じトピックで学習したい別のユーザーが問題を解こうとした場合、毎回 OpenAI API でクイズを新規生成する必要があり、以下の問題が生じる。

1. **コストが高い** — 同一トピックの問題が重複して生成され、API コストが増大する
2. **レスポンスが遅い** — LLM による生成は数秒かかり、UX を損なう
3. **品質のばらつき** — 生成のたびに問題の品質が変わる可能性がある

---

## 解決方針

あるユーザーの学習セッション中に AI 生成されたクイズ問題を **公開問題プール（Shared Question Pool）** として保存し、他のユーザーが再利用できる仕組みを実装する。

```
通常フロー（既存）:
  トピック入力 → AI 生成 → 自分だけのセッションで解く

共有フロー（新規）:
  ① 問題生成時: AI 生成した問題 → shared_questions テーブルに保存
  ② 他ユーザーの学習時: shared_questions から取得 → セッションに組み込む → 解く
```

---

## UI 設計

### `/learn` 画面への追加

現在の「学習開始（AI 生成）」ボタンに加え、**「他のユーザーが作成したクイズを解く」** ボタンを追加する。

```
┌──────────────────────────────────────────────┐
│ 学習を開始                                   │
│                                              │
│ 学習したい技術・トピック                     │
│ [React Hooks                              ]  │
│                                              │
│ Mode                                         │
│ (●) word     ( ) reading                     │
│                                              │
│ 出題問題数                                   │
│ [10]                                         │
│                                              │
│ うち復習問題数（上限）                       │
│ [▼ 2問まで]                                 │
│                                              │
│ [学習開始（AI 生成）]                        │  ← 既存ボタン
│                                              │
│ ── または ──────────────────────────────── │
│                                              │
│ [他のユーザーが作成したクイズを解く]         │  ← 新規追加
└──────────────────────────────────────────────┘
```

**「他のユーザーが作成したクイズを解く」ボタンの挙動**

1. トピック・モード・出題問題数の入力値を使用する（復習問題数は使用しない）
2. `shared_questions` テーブルから該当トピック × モードの問題を最大 `questionCount` 件取得
3. 取得件数が `questionCount × 80%` 以上 → そのままセッション開始（AI 生成なし）
4. 取得件数が閾値未満 → 不足分のみ AI 生成し、生成した問題を `shared_questions` に追加してからセッション開始
5. 取得件数が 0 件 → AI 生成して全問を `shared_questions` に保存してからセッション開始

---

## データモデル

### 新規テーブル: `shared_questions`

```sql
CREATE TABLE shared_questions (
  id                TEXT    PRIMARY KEY,       -- crypto.randomUUID()
  topic             TEXT    NOT NULL,          -- 正規化済みトピック文字列（小文字 trim）
  mode              TEXT    NOT NULL,          -- "word" | "reading"
  prompt            TEXT    NOT NULL,          -- 問題文
  choices_json      TEXT    NOT NULL,          -- JSON: string[]（選択肢）
  correct_index     INTEGER NOT NULL,          -- 正解インデックス
  explanation       TEXT    NOT NULL,          -- 解説文
  created_by        TEXT,                      -- 生成元の Clerk userId
  source_session_id TEXT,                      -- 元 study_sessions.session_id（参照のみ）
  play_count        INTEGER NOT NULL DEFAULT 0, -- 何回このセッションに組み込まれたか
  created_at        INTEGER NOT NULL           -- Unix timestamp ms
);

CREATE INDEX idx_shared_questions_topic_mode
  ON shared_questions (topic, mode);
```

**既存テーブルへの変更: なし**

`questions` テーブルは引き続き「特定セッションの問題」として機能する。`shared_questions` は「再利用可能な公開問題プール」として分離管理する。

---

## ロジック設計

### 1. AI 生成時の共有問題プールへの自動保存

既存の `startQuizSession`（`frontend/src/server/quiz/session.ts`）に、AI 生成した問題を `shared_questions` テーブルへ書き込む処理を追加する。

復習問題（`sourceQuestionId` あり）は除外し、新規 AI 生成問題のみを対象とする。

```typescript
// session.ts 内の startQuizSession（末尾付近への追記）

// 新規: shared_questions への保存（復習問題は除外）
const newQuestions = questions.filter((q) => !q.sourceQuestionId);
if (db && newQuestions.length > 0) {
  const normalizedTopic = topic.trim().toLowerCase();
  await db.insert(sharedQuestionsTable).values(
    newQuestions.map((q) => ({
      id: crypto.randomUUID(),
      topic: normalizedTopic,
      mode: input.mode,
      prompt: q.prompt,
      choicesJson: JSON.stringify(q.choices),
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      createdBy: input.userId,
      sourceSessionId: sessionId,
      playCount: 0,
      createdAt: Date.now(),
    })),
  );
}
```

### 2. 共有問題プールからのセッション開始

新規 Server Action `startSharedSessionFormAction` を `actions.ts` に追加する。

```typescript
// frontend/src/app/(features)/learn/_api/actions.ts（追加）

export async function startSharedSessionFormAction(formData: FormData): Promise<void> {
  const topic = String(formData.get("topic") ?? "").trim().slice(0, 200);
  const mode = String(formData.get("mode") ?? "word");
  const questionCountRaw = Number(formData.get("questionCount") ?? 10);
  const questionCount =
    Number.isInteger(questionCountRaw) && questionCountRaw >= 1 && questionCountRaw <= 20
      ? questionCountRaw
      : 10;

  if (!topic) return;
  if (mode !== "word" && mode !== "reading") return;

  const userId = await requireUserId();

  const session = await startSharedQuizSession({
    topic,
    mode: mode as "word" | "reading",
    questionCount,
    userId,
  });

  redirect(`/learn/${session.sessionId}`);
}
```

### 3. `startSharedQuizSession` の処理フロー

```typescript
// frontend/src/server/quiz/shared-session.ts（新規ファイル）

export async function startSharedQuizSession(input: {
  topic: string;
  mode: Mode;
  questionCount: number;
  userId: string;
}): Promise<StartSessionResponse> {
  const normalizedTopic = input.topic.trim().toLowerCase();
  const db = getOptionalDb();
  const sessionId = crypto.randomUUID();

  // 1. shared_questions から取得（play_count 昇順→ランダム、重複防止）
  let sharedRows: SharedQuestionRow[] = [];
  if (db) {
    sharedRows = await db
      .select()
      .from(sharedQuestionsTable)
      .where(
        and(
          eq(sharedQuestionsTable.topic, normalizedTopic),
          eq(sharedQuestionsTable.mode, input.mode),
        ),
      )
      .orderBy(asc(sharedQuestionsTable.playCount), sql`RANDOM()`)
      .limit(input.questionCount);
  }

  // 2. 閾値未満なら不足分を AI 生成（generateQuizItemsFromTopic は (topic, mode, count) を受け取る）
  const REUSE_THRESHOLD = Math.ceil(input.questionCount * 0.8);
  let aiGeneratedQuestions: QuestionRecord[] = [];

  if (sharedRows.length < REUSE_THRESHOLD) {
    const generateCount = input.questionCount - sharedRows.length;
    const generated = await generateQuizItemsFromTopic(input.topic, input.mode, generateCount);

    aiGeneratedQuestions = generated.map((item) => ({
      questionId: crypto.randomUUID(),
      sessionId,
      prompt: item.prompt,
      choices: item.choices as [string, string, string, string],
      correctIndex: item.correctIndex,
      explanation: item.explanation,
    }));

    // AI 生成分を shared_questions に保存
    if (db && aiGeneratedQuestions.length > 0) {
      await db.insert(sharedQuestionsTable).values(
        aiGeneratedQuestions.map((q) => ({
          id: crypto.randomUUID(),
          topic: normalizedTopic,
          mode: input.mode,
          prompt: q.prompt,
          choicesJson: JSON.stringify(q.choices),
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          createdBy: input.userId,
          sourceSessionId: sessionId,
          playCount: 0,
          createdAt: Date.now(),
        })),
      );
    }
  }

  // 3. shared_questions からの問題を QuestionRecord に変換
  const reusedQuestions: QuestionRecord[] = sharedRows.map((row) => ({
    questionId: crypto.randomUUID(),
    sessionId,
    prompt: row.prompt,
    choices: JSON.parse(row.choicesJson) as [string, string, string, string],
    correctIndex: row.correctIndex,
    explanation: row.explanation,
  }));

  // 4. play_count をインクリメント
  if (db && sharedRows.length > 0) {
    await db
      .update(sharedQuestionsTable)
      .set({ playCount: sql`${sharedQuestionsTable.playCount} + 1` })
      .where(inArray(sharedQuestionsTable.id, sharedRows.map((r) => r.id)));
  }

  // 5. セッションを組み立て・保存（persistSession を session.ts からエクスポートして利用）
  const questions: QuestionRecord[] = [...reusedQuestions, ...aiGeneratedQuestions];
  if (questions.length === 0) {
    throw new ApiError("INTERNAL", "問題の生成に失敗しました");
  }

  const session: SessionRecord = {
    sessionId,
    topic: input.topic,
    mode: input.mode,
    plannedCount: questions.length,
    actualCount: questions.length,
    questions,
  };
  await persistSession(db, session);

  return {
    sessionId,
    plannedCount: session.plannedCount,
    actualCount: session.actualCount,
    topic: session.topic,
    questions: questions.map((q) => ({
      questionId: q.questionId,
      prompt: q.prompt,
      choices: q.choices.map((text, index) => ({ index, text })),
    })),
  };
}
```

> **注意**: `persistSession` は現在 `session.ts` 内の private 関数のため、`export` を追加して `shared-session.ts` から利用できるようにする。

---

## DB マイグレーション

```sql
-- frontend/src/db/migrations/0004_add_shared_questions.sql

CREATE TABLE shared_questions (
  id                TEXT    PRIMARY KEY,
  topic             TEXT    NOT NULL,
  mode              TEXT    NOT NULL,
  prompt            TEXT    NOT NULL,
  choices_json      TEXT    NOT NULL,
  correct_index     INTEGER NOT NULL,
  explanation       TEXT    NOT NULL,
  created_by        TEXT,
  source_session_id TEXT,
  play_count        INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL
);

CREATE INDEX idx_shared_questions_topic_mode
  ON shared_questions (topic, mode);
```

---

## Drizzle スキーマ追加

```typescript
// frontend/src/db/schema.ts（追記）

export const sharedQuestions = sqliteTable("shared_questions", {
  id: text("id").primaryKey(),
  topic: text("topic").notNull(),
  mode: text("mode").notNull(),
  prompt: text("prompt").notNull(),
  choicesJson: text("choices_json").notNull(),
  correctIndex: integer("correct_index").notNull(),
  explanation: text("explanation").notNull(),
  createdBy: text("created_by"),
  sourceSessionId: text("source_session_id"),
  playCount: integer("play_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
```

---

## ファイル変更一覧

### 新規作成

| ファイル | 内容 |
|---|---|
| `frontend/src/db/migrations/0004_add_shared_questions.sql` | `shared_questions` テーブル作成マイグレーション |
| `frontend/src/server/quiz/shared-session.ts` | `startSharedQuizSession` 関数 |

### 変更

| ファイル | 変更内容 |
|---|---|
| `frontend/src/db/schema.ts` | `sharedQuestions` テーブル定義を追加 |
| `frontend/src/server/quiz/session.ts` | AI 生成後に `shared_questions` へ自動保存するロジックを追加。`persistSession` を `export` に変更 |
| `frontend/src/app/(features)/learn/_api/actions.ts` | `startSharedSessionFormAction` を追加 |
| `frontend/src/app/(features)/learn/_components/LearnPage.tsx` | 「他のユーザーが作成したクイズを解く」ボタンと form action を追加 |

---

## 考慮事項

### トピック正規化

- 「React Hooks」と「react hooks」を同一トピックとして扱うため、`shared_questions` への保存・検索時に `trim().toLowerCase()` で正規化する
- `study_sessions.topic` は元の入力値を保持するが、`shared_questions.topic` は正規化済み文字列を保持する

### 重複問題の排除（将来検討）

- 同一トピックで同一 `prompt` の問題が複数登録される可能性がある
- 今フェーズでは許容し、問題数が増えた段階で重複排除ロジックを追加する

### play_count の意味

- `play_count` は「その問題が何件のセッションに組み込まれたか」を表す
- `orderBy(asc(playCount), sql\`RANDOM()\`)` により、利用回数の少ない問題を優先的に出題し、問題の均等分散を図る

### セキュリティ

- `shared_questions` は全ユーザーが参照可能な公開データ
- 今フェーズでは Clerk 認証済みユーザーのセッションから生成した問題のみ保存する（`requireUserId()` を使用）

---

## フェーズ分け

### Phase 1（本 Issue のスコープ）

- `shared_questions` テーブルの追加（スキーマ + マイグレーション）
- `startQuizSession` 内での AI 生成問題の自動保存
- `/learn` 画面への「他のユーザーが作成したクイズを解く」ボタン追加
- `startSharedQuizSession` の実装（取得 → 不足時 AI 生成 → セッション開始）

### Phase 2（将来）

- 問題の低評価・非表示機能（品質管理）
- トピック一覧画面（共有問題がある人気トピックの表示）
- 管理者による問題の削除機能
- 類似トピックのマージ機能
