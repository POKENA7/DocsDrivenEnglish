# 設計書: 出題問題数・復習問題数カスタマイズ機能

**作成日**: 2026-02-19  
**ステータス**: Draft

---

## 背景・課題

現在の実装では出題問題数が `PLANNED_QUESTION_COUNT = 5` で固定されている。  
短時間の隙間学習では 5 問が多すぎる場合があり、逆に集中学習時には 5 問では物足りないこともある。

また、将来実装予定の「間違い自動復習機能」（`flashcard-review.md` 参照）では、通常の新規問題と復習問題が混在するセッションを生成する。復習問題をどれだけ含めるかも、ユーザーが学習スタイルに合わせて調整できると望ましい。

これら 2 つの設定は同じ「学習開始」フォームで扱う関連機能のため、まとめて設計・実装する。

---

## 解決方針

学習開始フォームに以下の 2 つの設定を追加する。

1. **出題問題数**: 1 セッションで出題する問題の合計数
2. **復習問題数**: そのうち復習問題に割り当てる上限数

```
学習開始画面:
  [トピック入力]
  [Mode 選択: word / reading]
  [出題問題数: 3 / 5 / 10]          ← 新規追加
  [復習を含める: 0 / 1 / 2 / ... ]  ← 新規追加（復習機能実装後に表示）
  [学習開始]
```

---

## UI 設計

### 学習開始フォーム（`/learn`）

```
┌──────────────────────────────────────────┐
│ 学習を開始                               │
│                                          │
│ 学習したい技術・トピック                  │
│ [React Hooks                          ]  │
│                                          │
│ Mode                                     │
│ (●) word     ( ) reading                 │
│                                          │
│ 出題問題数                               │
│ ( ) 3問   (●) 5問   ( ) 10問            │
│                                          │
│ 復習を含める ※復習候補がある場合のみ表示  │
│ [▼ 2問まで]                             │   ← select 要素
│                                          │
│ [学習開始]  最大 5 問のクイズが始まります │
└──────────────────────────────────────────┘
```

#### 出題問題数

- ラジオボタンで `3` / `5` / `10` から選択
- デフォルト: `5`

#### 復習問題数

- 復習機能が未実装 / 復習候補が 0 件の場合: セクションごと非表示
- 復習候補がある場合: `0` 〜 `min(期限切れ復習件数, 出題問題数 - 1)` の範囲で select 選択
  - `出題問題数 - 1` を上限とする理由: 少なくとも 1 問は新規問題を含める
- デフォルト: `min(期限切れ復習件数, 2)`（最大 2 問を自動選択）
- 出題問題数を変更したとき: 上限を超えている場合は自動的に上限値へ丸める

---

## データフロー

```
LearnPage (フォーム)
  └── useLearnStart フック
        └── startSessionAction (Server Action)
              └── POST /api/quiz/sessions
                    ├── questionCount: number       ← 新規
                    ├── reviewQuestionIds: string[] ← 新規（復習機能連携時）
                    ├── topic: string
                    └── mode: "word" | "reading"
```

---

## API 設計

### `POST /api/quiz/sessions` の変更

**リクエスト**

```typescript
// Before
{
  topic: string;
  mode: "word" | "reading";
}

// After
{
  topic: string;
  mode: "word" | "reading";
  questionCount?: number;       // 省略時は 5（後方互換）
  reviewQuestionIds?: string[]; // 復習問題の questionId 一覧（復習機能連携時）
}
```

**バリデーション**

```typescript
const bodySchema = z.object({
  topic: z.string().min(1),
  mode: z.enum(["word", "reading"]),
  questionCount: z.number().int().min(1).max(10).optional().default(5),
  reviewQuestionIds: z.array(z.string()).optional().default([]),
});
```

**サーバー側処理**

1. `reviewQuestionIds` の問題を DB から取得（上限: `questionCount - 1`、超過分は無視）
2. 残り枠数 = `questionCount - reviewQuestions.length` 分だけ LLM で新規問題を生成
3. 復習問題を先頭に、新規問題を後に結合してセッションを生成

**レスポンス**（変更なし）

```typescript
{
  sessionId: string;
  plannedCount: number;  // questionCount の値が入る
  actualCount: number;   // 実際に生成できた問題数
  topic: string;
  questions: Array<{ questionId: string; prompt: string; choices: [...] }>;
}
```

---

## 実装変更箇所

| ファイル | 変更種別 | 内容 |
|----------|----------|------|
| `src/app/api/[[...route]]/quiz.ts` | 変更 | `PLANNED_QUESTION_COUNT` 定数を廃止し、リクエストから `questionCount` を受け取る。`reviewQuestionIds` を受け取り先頭に挿入するロジック追加 |
| `src/app/(features)/learn/_api/actions.ts` | 変更 | `startSessionAction` の引数に `questionCount` / `reviewQuestionIds` を追加 |
| `src/app/(features)/learn/_hooks/useLearnStart.ts` | 変更 | フォームから `questionCount` を取得し `startSessionAction` へ渡す |
| `src/app/(features)/learn/_components/LearnPage.tsx` | 変更 | 出題問題数ラジオボタン追加。復習問題数 select 追加（復習候補がある場合のみ表示） |

---

## 実装順序

復習機能（`flashcard-review.md`）は別 PR で実装するため、本機能は以下の順で段階的に実装する。

### Phase 1（本 PR）: 出題問題数のみ

- `questionCount` パラメータを API / Server Action / フォームに追加
- `PLANNED_QUESTION_COUNT` 定数を廃止
- 復習問題数 UI は実装しない

### Phase 2（復習機能 PR と同時）: 復習問題数

- `reviewQuestionIds` パラメータを API / Server Action に追加
- 復習候補件数を `GET /api/review-queue/due` で取得し、フォームに復習問題数 select を表示
- セッション生成時に復習問題を先頭挿入するロジックを追加

---

## 非機能要件

| 項目 | 内容 |
|------|------|
| 後方互換 | `questionCount` 省略時は `5` にフォールバックするため既存クライアントに影響なし |
| LLM コスト | `questionCount` が大きいほど LLM 呼び出しが増加するが、10 問上限で許容範囲内 |
| UX | 復習候補が 0 件の時は復習問題数 UI を非表示にし、フォームをシンプルに保つ |

---

## 未解決事項（TODO）

- [ ] 出題問題数の上限を 10 問にするか、それ以上を許可するか検討
- [ ] `questionCount` の選択肢を固定（3 / 5 / 10）にするか、任意入力にするか検討
