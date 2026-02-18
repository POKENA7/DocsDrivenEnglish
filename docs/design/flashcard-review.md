# 設計書: 単語帳・間違い復習機能

**作成日**: 2026-02-18  
**ステータス**: Draft

---

## 背景・課題

現在の実装では、クイズ回答後に解説を確認したら問題が流れで終わる。間違えた問題や「難しかった」と感じた問題を後から見返す手段がないため、記憶が定着しにくい。

英語学習において「繰り返し」は不可欠であり、スペースド・リペティション（間隔反復）を採用した復習機能が学習効果を大幅に高める。

---

## 解決方針

回答後に問題を「単語帳」へブックマークできるようにし、単語帳に溜まった問題を専用の復習クイズで何度でも解けるようにする。

```
通常学習フロー:  トピック入力 → クイズ → 回答後に「単語帳へ追加」ボタン
復習フロー:     単語帳ページ → 「単語帳から復習」 → 保存問題のみでクイズ
```

---

## UI 設計

### 回答後の解説画面

現行の「次の問題へ」ボタンに加え、「単語帳に追加」ボタンを配置する。

```
┌──────────────────────────────────────────┐
│ ✓ 正解  /  ✗ 不正解                     │
│                                          │
│ 解説テキスト ...                         │
│                                          │
│ [★ 単語帳に追加]   [次の問題へ →]       │
└──────────────────────────────────────────┘
```

- 既に単語帳に追加済みの場合は「★ 追加済み」と表示し、押すと削除
- 未ログインの場合: ローカルストレージに保存し、ログイン促進トーストを表示

### 単語帳ページ（`/flashcards`）

```
┌──────────────────────────────────────────┐
│ 単語帳  (12件)                           │
│                                          │
│ [単語帳から復習する]                     │
│                                          │
│ ┌─ React Hooks ─────────────────────┐   │
│ │ "lifecycle" — 意味を問う問題       │   │
│ │ 追加日: 2026-02-15  正解率: 1/3    │   │
│ │ [削除]                            │   │
│ └────────────────────────────────────┘  │
│                                          │
│ ┌─ Kubernetes ───────────────────────┐  │
│ │ "orchestration" — 意味を問う問題   │   │
│ │ 追加日: 2026-02-16  正解率: 0/2    │   │
│ │ [削除]                            │   │
│ └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

- 単語帳が空の場合は「まだ問題が追加されていません」と案内を表示
- トピック・正解率でソート可能

---

## データモデル

### 新規テーブル: `flashcard_bookmarks`

```sql
CREATE TABLE flashcard_bookmarks (
  id          TEXT PRIMARY KEY,       -- ULID
  user_id     TEXT NOT NULL,          -- Clerk userId（未ログインは NULL）
  question_id TEXT NOT NULL,          -- questions.id への参照
  created_at  INTEGER NOT NULL,       -- Unix timestamp (ms)
  UNIQUE (user_id, question_id)
);
```

### `questions` テーブルへの参照

既存の `questions` テーブルに保存済みの `questionId` を参照するため、スキーマ変更は最小限。  
`question` の `prompt` / `choices` / `answer` / `explanation` はすでに `questions` に保存されているため、復習時もそのまま再利用できる。

### 未ログインユーザーの扱い

- ブラウザの `localStorage` に `questionId` の配列を保存する
- ログイン後に localStorage のデータを DB へマイグレーションする API を呼ぶ

---

## API 設計

### `POST /api/flashcards` — 単語帳に追加

**リクエスト**

```typescript
{ questionId: string }
```

**処理**

- ログイン済み: `flashcard_bookmarks` に INSERT（重複は無視）
- 未ログイン: 401 を返す（クライアントが localStorage に保存）

**レスポンス**

```typescript
{ bookmarkId: string; questionId: string }
```

---

### `DELETE /api/flashcards/:questionId` — 単語帳から削除

**処理**

- `user_id` + `question_id` で DELETE

---

### `GET /api/flashcards` — 単語帳一覧取得

**レスポンス**

```typescript
{
  items: Array<{
    bookmarkId: string;
    questionId: string;
    prompt: string;
    choices: Array<{ index: number; text: string }>;
    answer: number;
    explanation: string;
    topic: string;
    createdAt: number;
    attemptCount: number;   // この問題に回答した回数
    correctCount: number;   // うち正解した回数
  }>;
}
```

---

### `POST /api/quiz/sessions` の変更（復習モード追加）

```typescript
// Before
{ topic: string; mode: "word" | "reading" }

// After
{ topic: string; mode: "word" | "reading" }
| { flashcardReview: true; questionIds: string[] }  // 復習セッション
```

復習セッション時は LLM を呼ばず、`questionIds` で渡された既存の `questions` をそのままクイズとして提供する。

---

## 処理フロー

### 通常学習 → 単語帳追加

```
1. ユーザーが回答後の解説画面で「★ 単語帳に追加」ボタンを押す
2. POST /api/flashcards { questionId }
3. ログイン済み → DB に INSERT
   未ログイン  → 401 → クライアントが localStorage に保存 + トースト表示
```

### 復習セッション開始

```
1. ユーザーが /flashcards で「単語帳から復習する」ボタンを押す
2. GET /api/flashcards で questionIds 一覧を取得
3. POST /api/quiz/sessions { flashcardReview: true, questionIds }
4. サーバーが既存の questions を取得してセッションを生成（LLM 呼び出しなし）
5. 通常のクイズセッションと同じ UI で出題
```

---

## 影響を受けるファイル一覧

| ファイル | 変更種別 | 内容 |
|----------|----------|------|
| `src/db/schema.ts` | 変更 | `flashcard_bookmarks` テーブル追加 |
| `src/db/migrations/` | 追加 | Drizzle migration ファイル生成 |
| `src/app/api/[[...route]]/app.ts` | 変更 | `/api/flashcards` ルート追加 |
| `src/app/api/[[...route]]/flashcards.ts` | 新規 | GET / POST / DELETE ハンドラ |
| `src/app/api/[[...route]]/quiz.ts` | 変更 | 復習セッションモード対応 |
| `src/app/(features)/session/_components/SessionPage.tsx` | 変更 | 「単語帳に追加」ボタン追加 |
| `src/app/(features)/flashcards/page.tsx` | 新規 | 単語帳一覧ページ |
| `src/app/(features)/flashcards/_components/FlashcardsPage.tsx` | 新規 | 単語帳 UI コンポーネント |
| `src/app/(features)/flashcards/_api/query.ts` | 新規 | 単語帳データ取得 |
| `src/app/(features)/flashcards/_hooks/useFlashcards.ts` | 新規 | SWR による単語帳状態管理 |

---

## 非機能要件

| 項目 | 内容 |
|------|------|
| ログイン不要 | 未ログインでも localStorage で単語帳を利用可能 |
| ログイン後移行 | ログイン後に localStorage → DB へ自動マイグレーション |
| LLM コスト | 復習セッションは既存 questions を再利用するため LLM 費用ゼロ |
| パフォーマンス | 単語帳一覧は最大 500 件を想定（ページネーション対応は将来対応） |

---

## 未解決事項（TODO）

- [ ] スペースド・リペティションアルゴリズム（SM-2等）の適用は将来対応とするか検討
- [ ] 単語帳の上限件数を設けるか（例: 未ログインは 50 件まで）
- [ ] 未ログイン localStorage → ログイン後 DB マイグレーションのタイミング設計
