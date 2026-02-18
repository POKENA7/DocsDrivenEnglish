# 設計書: 出題問題数・復習問題数カスタマイズ機能

**作成日**: 2026-02-19  
**ステータス**: Draft

---

## 背景・課題

現在の実装では出題問題数が `PLANNED_QUESTION_COUNT = 5` で固定されており、LLM プロンプトにも「必ず5問作ること」とハードコードされている。  
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
  [出題問題数: 10 (任意入力)]  ← 新規追加
  [復習問題数上限: 2 (select)] ← 新規追加（Phase 2 で表示）
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
│ [▼ 10問]                                │  ← number input または select
│                                          │
│ うち復習問題数（上限）                   │
│ [▼ 2問まで]                             │  ← select 要素
│                                          │
│ [学習開始]  10 問のクイズが始まります    │
└──────────────────────────────────────────┘
```

#### 出題問題数

- 数値入力（`<input type="number">`）で任意の値を入力可能
- 範囲: 1〜20
- デフォルト: `10`

#### 復習問題数（上限）

- select で `0` 〜 `出題問題数 - 1` の範囲から選択
  - `出題問題数 - 1` を上限とする理由: 少なくとも 1 問は新規 AI 生成問題を含める
- デフォルト: `2`
- 復習候補の有無にかかわらず常に表示する（候補が少ない場合のサーバー側処理は後述）
- 出題問題数を変更したとき: 上限を超えている場合は自動的に上限値へ丸める

---

## データフロー

現在の実装では `startSessionFormAction`（`<form action={...}>` での native submit）と `startSessionAction`（`useLearnStart` フック経由）の 2 経路がある。

```
LearnPage (フォーム)
  ├── startSessionFormAction (Server Action / native form submit)
  │     └── startSessionQuery → POST /api/quiz/sessions
  │           ├── topic: string
  │           ├── mode: "word" | "reading"
  │           ├── questionCount: number       ← 新規
  │           └── reviewQuestionCount: number ← 新規（復習機能連携時）
  └── useLearnStart フック（useSWRMutation）
        └── startSessionAction → startSessionQuery → POST /api/quiz/sessions
              └── 同上
```

`StartSessionInput`（`src/app/(features)/learn/_api/query.ts`）に `questionCount` / `reviewQuestionCount` を追加することで両経路に自動的に反映される。

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
  questionCount?: number;      // 省略時は 10（後方互換）
  reviewQuestionCount?: number; // 復習問題上限数（省略時は 0）
}
```

**バリデーション**

```typescript
const bodySchema = z.object({
  topic: z.string().min(1),
  mode: z.enum(["word", "reading"]),
  questionCount: z.number().int().min(1).max(20).optional().default(10),
  reviewQuestionCount: z.number().int().min(0).optional().default(0),
});
```

**サーバー側処理**（Phase 1 では復習部分はスキップ）

1. `reviewQuestionCount` 件の期限切れ復習問題を DB から取得
   - 実際の候補数が `reviewQuestionCount` より少ない場合は候補数を使用
   - DB に候補がなければ 0 件として扱う
2. 新規 AI 生成問題数 = `questionCount - 実際の復習問題数`
3. LLM を **1回** 呼び出し、新規問題を一括生成（`generateQuizItemsFromTopic` に生成数を渡す）
4. 復習問題を先頭に、AI 生成問題を後ろに結合してセッションを生成

**LLM 呼び出し回数について**

`generateQuizItemsFromTopic` は問題数にかかわらず LLM を 1 回だけ呼ぶ。プロンプトの「必ず5問作ること」を `questionCount - 実際の復習問題数` 問に置き換えるだけで対応できる。

**レスポンス**（変更なし）

```typescript
{
  sessionId: string;
  plannedCount: number;  // questionCount の値が入る
  actualCount: number;   // 実際に生成できた問題数（復習 + AI 生成の合計）
  topic: string;
  questions: Array<{ questionId: string; prompt: string; choices: [...] }>;
}
```

---

## 実装変更箇所

| ファイル | 変更種別 | 内容 |
|----------|----------|------|
| `src/app/api/[[...route]]/quiz.ts` | 変更 | `PLANNED_QUESTION_COUNT` 定数を廃止。`startQuizSession` / `generateQuizItemsFromTopic` に `questionCount` を引数追加。LLM プロンプトの問題数をダイナミックに差し替え |
| `src/app/(features)/learn/_api/query.ts` | 変更 | `StartSessionInput` に `questionCount` / `reviewQuestionCount` を追加 |
| `src/app/(features)/learn/_api/actions.ts` | 変更 | `startSessionFormAction` で `formData` から `questionCount` / `reviewQuestionCount` を取得して渡す |
| `src/app/(features)/learn/_hooks/useLearnStart.ts` | 変更 | フォームから `questionCount` / `reviewQuestionCount` を取得して `startSessionAction` へ渡す |
| `src/app/(features)/learn/_components/LearnPage.tsx` | 変更 | 出題問題数 number input 追加。復習問題数 select 追加（常に表示）。フッターのヒントテキストを動的に変更 |

---

## 実装順序

復習機能（`flashcard-review.md`）は別 PR で実装するため、本機能は以下の順で段階的に実装する。

### Phase 1（本 PR）: 出題問題数のカスタマイズ

- `questionCount` パラメータを API / `StartSessionInput` / Server Action / フックに追加
- `PLANNED_QUESTION_COUNT` 定数を廃止し、プロンプトの問題数もダイナミックに生成
- `LearnPage` に出題問題数 number input を追加
- `reviewQuestionCount` は API / `StartSessionInput` に型だけ追加しておく（フォームには未表示）

### Phase 2（復習機能 PR と同時）: 復習問題数の組み込み

- `reviewQuestionCount` に基づき期限切れ復習問題を DB から取得するロジックを `quiz.ts` に追加
- `LearnPage` に復習問題数 select を追加
- セッション生成時に復習問題を先頭挿入するロジックを追加

---

## 非機能要件

| 項目 | 内容 |
|------|------|
| 後方互換 | `questionCount` 省略時は `10` にフォールバックするため既存クライアントに影響なし |
| LLM コスト | 問題数が増えても LLM 呼び出しは 1 回のまま。出力トークン数が増加するためコストは線形に増えるが、呼び出し回数は変わらない |
| 復習候補不足時の挙動 | ユーザーが「復習 3 問」を選択しても候補が 1 件しかない場合、サーバー側で自動的に 1 件を復習・残りを AI 生成に切り替える。クライアントへの特別な通知は不要 |

---

## 未解決事項（TODO）

- [ ] 出題問題数の上限（現在 20）は適切か検討
- [ ] 復習問題数 select のデフォルト値（現在 2）は適切か検討
