# 設計書: クイズ保存・共有機能（他のユーザーが作成したクイズを解く）

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

新しいテーブルを追加せず、既存の `questions` テーブルを活用する。他のユーザーが AI 生成したクイズ問題を、別のユーザーがそのまま再利用できる仕組みを実装する。

```
通常フロー（既存）:
  トピック入力 → AI 生成 → 自分だけのセッションで解く

共有フロー（新規）:
  他のユーザーが過去に生成した questions テーブルの問題 → 新しいセッションに組み込む → 解く
```

**ポイント**:
- トピックによるフィルタは行わない。他のユーザーが作成した問題をランダムに出題する
- `shared_questions` のような新テーブルは不要。既存の `questions` テーブルを参照する

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
│ 出題問題数                                   │
│ [10]                                         │
│                                              │
│ [他のユーザーが作成したクイズを解く]         │  ← 新規追加
└──────────────────────────────────────────────┘
```

**「他のユーザーが作成したクイズを解く」ボタンの挙動**

1. 出題問題数の入力値を使用する（トピック・モード・復習問題数は使用しない）
2. `questions` テーブルから **他のユーザーが作成した** セッションの問題をランダムに最大 `questionCount` 件取得
3. 取得件数が 0 件 → エラーを表示（「まだ他のユーザーが作成したクイズがありません」）

---

## データモデル

### 新規テーブル: なし

既存の `questions` テーブルと `study_sessions` テーブルをそのまま利用する。

`study_sessions.user_id` を参照して、リクエストユーザー以外のセッションに属する `questions` をランダムに取得する。

---

## ロジック設計

### 1. `session.ts` への変更

既存の `startQuizSession` に変更はない。`shared_questions` への保存処理は不要。
`persistSession` は `shared-session.ts` からも利用するため `export` を付与する（既に付与済み）。

### 2. 共有クイズセッション開始の Server Action

新規 Server Action `startSharedSessionFormAction` を `actions.ts` に追加する。

```typescript
// frontend/src/app/(features)/learn/_api/actions.ts（追加）

export async function startSharedSessionFormAction(formData: FormData): Promise<void> {
  const questionCountRaw = Number(formData.get("sharedQuestionCount") ?? 10);
  const questionCount =
    Number.isInteger(questionCountRaw) && questionCountRaw >= 1 && questionCountRaw <= 20
      ? questionCountRaw
      : 10;

  const userId = await requireUserId();

  const session = await startSharedQuizSession({
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
  questionCount: number;
  userId: string;
}): Promise<StartSessionResponse> {
  const db = getOptionalDb();
  if (!db) {
    throw new ApiError("INTERNAL", "DB接続に失敗しました");
  }
  const sessionId = crypto.randomUUID();

  // 1. questions テーブルから他ユーザーのセッションに属する問題をランダムに取得
  //    - study_sessions.user_id が自分以外のセッションの問題
  //    - source_question_id が null のもの（復習コピーは除外）
  const rows = await db
    .select({
      prompt: questionsTable.prompt,
      choicesJson: questionsTable.choicesJson,
      correctIndex: questionsTable.correctIndex,
      explanation: questionsTable.explanation,
      topic: studySessions.topic,
      mode: studySessions.mode,
    })
    .from(questionsTable)
    .innerJoin(studySessions, eq(questionsTable.sessionId, studySessions.sessionId))
    .where(
      and(
        ne(studySessions.userId, input.userId),
        isNull(questionsTable.sourceQuestionId),
      ),
    )
    .orderBy(sql`RANDOM()`)
    .limit(input.questionCount);

  if (rows.length === 0) {
    throw new ApiError("NOT_FOUND", "まだ他のユーザーが作成したクイズがありません");
  }

  // 2. QuestionRecord に変換
  const questions: QuestionRecord[] = rows.map((row) => ({
    questionId: crypto.randomUUID(),
    sessionId,
    prompt: row.prompt,
    choices: JSON.parse(row.choicesJson) as [string, string, string, string],
    correctIndex: row.correctIndex,
    explanation: row.explanation,
  }));

  // 3. セッションを組み立て・保存
  const topic = "他のユーザーが作成したクイズ";
  const session: SessionRecord = {
    sessionId,
    topic,
    mode: "word",
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

---

## データモデル変更

新規テーブル・マイグレーションは不要。

既存の `study_sessions.user_id` カラムを使って「自分以外のユーザーが作成した問題」を抽出する。

---

## ファイル変更一覧

### 新規作成

| ファイル | 内容 |
|---|---|
| `frontend/src/server/quiz/shared-session.ts` | `startSharedQuizSession` 関数 |

### 変更

| ファイル | 変更内容 |
|---|---|
| `frontend/src/app/(features)/learn/_api/actions.ts` | `startSharedSessionFormAction` を追加 |
| `frontend/src/app/(features)/learn/_components/LearnPage.tsx` | 「他のユーザーが作成したクイズを解く」ボタンと出題数設定を追加 |

---

## 考慮事項

### トピック

- 共有クイズではトピックによるフィルタは行わない
- セッションの `topic` には固定値「他のユーザーが作成したクイズ」を設定する

### 復習問題の除外

- `questions.source_question_id` が NULL のもののみ取得（復習コピーは除外）

### セキュリティ

- `questions` テーブルの問題は全ユーザーが参照可能な公開データとして扱う
- Clerk 認証済みユーザーのみがセッションを開始できる（`requireUserId()` を使用）

---

## フェーズ分け

### Phase 1（本 Issue のスコープ）

- `/learn` 画面への「他のユーザーが作成したクイズを解く」ボタン追加
- `startSharedQuizSession` の実装（`questions` テーブルから他ユーザーの問題を取得 → セッション開始）

### Phase 2（将来）

- 問題の低評価・非表示機能（品質管理）
- トピック一覧画面（共有問題がある人気トピックの表示）
- 管理者による問題の削除機能
