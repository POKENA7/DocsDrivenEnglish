# server 層の抽出によるフォルダ構成最適化

## 背景・課題

現在の `app/(features)/` 配下は package by feature で構成されているが、以下の問題がある。

### 1. feature 間の直接依存

- `learn/_api/mutations.ts` が `history/_api/mutations` の `recordAttempt` を直接 import
- `learn/_api/mutations.ts` が `review_queue` テーブルを直接操作（review-queue feature のドメイン）
- `learn/page.tsx` が `review-queue/_api/query` の `getDueReviewCount` を import

### 2. 肥大化リスク

- `learn/_api/mutations.ts` が 329 行あり、クイズ生成・セッション管理・回答処理・復習キュー更新が混在
- レベル機能・ストリーク・弱点分析など新機能を追加すると、`learn/` に横断ロジックが増え続ける

### 3. テストの import パスが UI 層に依存

- `tests/integration/quiz-session.test.ts` が `@/app/(features)/learn/_api/mutations` を import
- `tests/unit/history-aggregate.test.ts` が `@/app/(features)/history/_api/query` を import
- ドメインロジックのテストなのに UI 層のパスに結合している

## 設計方針

**UI 層（`app/`）とドメインロジック層（`server/`）を分離する。**

- `app/(features)/` には page.tsx・\_components・\_hooks・Server Actions（薄い委譲層）のみ残す
- feature を横断するドメインロジックは `src/server/` に移動する
- 依存方向は **上（UI）→ 下（server → db/lib）** の一方通行に統一する

## 変更後のフォルダ構成

```
src/
├── app/
│   └── (features)/
│       ├── learn/
│       │   ├── page.tsx
│       │   ├── _components/
│       │   │   ├── LearnPage.tsx
│       │   │   ├── SessionPage.tsx
│       │   │   ├── SessionCompletePage.tsx
│       │   │   ├── SessionProgress.tsx
│       │   │   ├── SubmitButton.tsx
│       │   ├── _hooks/
│       │   │   ├── useQuizSession.ts
│       │   │   └── useQuizAnswer.ts
│       │   ├── _api/
│       │   │   └── actions.ts          ← Server Actions（server/ を呼ぶだけ）
│       │   └── [sessionId]/
│       │       ├── page.tsx
│       │       └── complete/
│       │           └── page.tsx
│       ├── history/
│       │   ├── page.tsx
│       │   └── _components/
│       │       └── HistoryPage.tsx
│       └── review-queue/
│           └── page.tsx
│
├── server/                             ← NEW: feature 横断のドメインロジック
│   ├── quiz/
│   │   ├── types.ts                    ← Mode, QuestionRecord, SessionRecord
│   │   ├── generate.ts                 ← OpenAI API でクイズ生成
│   │   ├── session.ts                  ← startQuizSession, persistSession
│   │   ├── answer.ts                   ← submitQuizAnswer
│   │   ├── query.ts                    ← getQuestion, getSessionSnapshot
│   │   └── errors.ts                   ← ApiError
│   ├── review/
│   │   ├── query.ts                    ← getDueReviewCount, getReviewQueue
│   │   └── command.ts                  ← registerWrongAnswer, rescheduleOnCorrectAnswer
│   └── history/
│       ├── record.ts                   ← recordAttempt
│       └── query.ts                    ← calculateHistorySummary, getHistorySummaryQuery
│
├── db/
│   ├── client.ts
│   ├── schema.ts
│   └── migrations/
├── lib/
│   ├── auth.ts
│   └── openaiClient.ts
├── components/
│   └── ui/
└── middleware.ts
```

## 各層の役割

| 層 | 役割 | 依存先 |
|---|---|---|
| `app/(features)/*/page.tsx` | ルーティング・データフェッチ呼び出し | `server/*` |
| `app/(features)/*/_components/` | UI コンポーネント | props 経由のみ |
| `app/(features)/*/_api/actions.ts` | Server Actions（入力バリデーション + 委譲） | `server/*` |
| `server/quiz/` | クイズ生成・セッション管理・回答処理 | `db/`, `lib/`, `server/history/`, `server/review/` |
| `server/review/` | 復習キュー読み書き（`query.ts` / `command.ts`） | `db/` |
| `server/history/` | 回答記録・履歴集計 | `db/` |
| `app/(features)/*/_api/actions.ts` / `page.tsx` | `requireUserId()` で userId を確定し server 層へ渡す | `lib/auth`, `server/*` |

## ファイルの移動マッピング

| 移動元 | 移動先 |
|---|---|
| `learn/_types/index.ts` | `server/quiz/types.ts` |
| `learn/_api/mutations.ts` の `ApiError` | `server/quiz/errors.ts` |
| `learn/_api/mutations.ts` の `generateQuizItemsFromTopic` | `server/quiz/generate.ts` |
| `learn/_api/mutations.ts` の `startQuizSession`, `persistSession` | `server/quiz/session.ts` |
| `learn/_api/mutations.ts` の `submitQuizAnswer` | `server/quiz/answer.ts` |
| `learn/_api/mutations.ts` の型(`StartSessionResponse` 等) | `server/quiz/types.ts` |
| `learn/_api/query.ts` | `server/quiz/query.ts` |
| `review-queue/_api/query.ts` | `server/review/query.ts` |
| `learn/_api/mutations.ts` の review_queue 書き込みロジック | `server/review/command.ts`（`registerWrongAnswer`, `rescheduleOnCorrectAnswer`） |
| `history/_api/mutations.ts` | `server/history/record.ts` |
| `history/_api/query.ts` | `server/history/query.ts` |

## 認証責務の境界

server 層の関数は内部で `requireUserId()` を呼ばず、呼び出し元（Server Actions / page）から `userId` を受け取る設計とする。
これにより server 層は純粋な TS 関数として扱え、隠れた副作用がなくなる。

```typescript
// server/history/record.ts
export async function recordAttempt(input: { userId: string; /* ... */ }) { ... }

// server/history/query.ts
export async function getHistorySummaryQuery(userId: string) { ... }

// app/(features)/history/page.tsx
const { userId } = await requireUserId(); // ← auth はここで完結
const summary = await getHistorySummaryQuery(userId);
```

## 型配置方針

server 層の型と UI 層の型を分離する。

| 種別 | 配置先 | 説明 |
|---|---|---|
| server 内部型 | `server/quiz/types.ts` | DB 行型・ドメインモデルなど |
| UI 表示用 DTO | `app/(features)/learn/_types/index.ts` | Client Component が必要とする表示向け型 |

client component が使う型まで `server/quiz/types.ts` に寄せると、`"use server"` / `"server-only"` の制約に抵触する可能性があるため注意する。

## UI 層の変更

移動後、UI 層の import パスを更新する。

```typescript
// BEFORE: learn/_api/actions.ts
import { startQuizSession, submitQuizAnswer } from "./mutations";

// AFTER: learn/_api/actions.ts
import { startQuizSession } from "@/server/quiz/session";
import { submitQuizAnswer } from "@/server/quiz/answer";
```

```typescript
// BEFORE: learn/page.tsx
import { getDueReviewCount } from "@/app/(features)/review-queue/_api/query";

// AFTER: learn/page.tsx
import { getDueReviewCount } from "@/server/review/query";
```

```typescript
// BEFORE: history/_components/HistoryPage.tsx
import { getHistorySummaryQuery } from "../_api/query";

// AFTER: history/_components/HistoryPage.tsx
import { getHistorySummaryQuery } from "@/server/history/query";
```

## 依存ルールの強制

設計の依存方向を機械的に保つため、以下の仕組みを導入する。

### ESLint `no-restricted-imports`

```js
// eslint.config.mjs に追加
{
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        // feature 横断の直接 import を禁止
        {
          group: ["@/app/(features)/history/**", "@/app/(features)/review-queue/**"],
          importNames: [],
          message: "feature 間の直接 import は禁止。@/server/* を使うこと。"
        }
      ]
    }]
  }
}
```

### `server-only` の必須化

`src/server/**` の各ファイル先頭に以下を追加し、client bundle への混入を防ぐ。

```typescript
import "server-only";
```

## テストの変更

テストの import パスも `@/server/` に統一する。

```typescript
// BEFORE
import { ApiError, startQuizSession } from "@/app/(features)/learn/_api/mutations";
import { calculateHistorySummary } from "@/app/(features)/history/_api/query";

// AFTER
import { ApiError } from "@/server/quiz/errors";
import { startQuizSession } from "@/server/quiz/session";
import { calculateHistorySummary } from "@/server/history/query";
```

## 段階移行手順

Big Bang で一気に切り替えるのではなく、以下の 5 ステップで段階的に移行する。各ステップを別 PR に分けるとレビュー負荷が下がる。

1. **`src/server/*` 新設** — 既存処理をコピー、呼び出し元はまだ変えない
2. **`learn/_api/actions.ts` を移行** — `server/*` を参照するよう import を更新
3. **`page.tsx` / `HistoryPage.tsx` の query import を移行** — `@/server/history/query` 等に変更
4. **テストの import を移行** — `@/server/*` に統一
5. **旧ファイルを削除** — `app/(features)/*/_api/{mutations,query}.ts` を削除

## 完了条件

以下をすべて満たした時点で本タスク完了とする。

- `pnpm run lint` が成功すること
- `pnpm run test:run` が成功すること
- `pnpm run format:check` が成功すること
- `app/(features)/**/_api/` に business logic が残っておらず、`server/*` への委譲のみであること
- `src/server/**` の各ファイルに `import "server-only"` が追加されていること

## 解決される問題

1. **feature 間の直接依存の排除** — `learn` が `history` や `review-queue` を直接 import しなくなる
2. **learn の肥大化防止** — 329 行の mutations.ts を責務ごとに分割、UI 層は薄い委譲のみ
3. **新機能追加の容易性** — `server/progress/` を追加するだけでどの feature からも参照可能
4. **テスト容易性** — `server/` 以下は Next.js 非依存の純粋な TS 関数としてテスト可能

## 将来の拡張

```
server/
├── quiz/          # 既存
├── review/        # 既存
├── history/       # 既存
└── progress/      # 将来追加
    ├── level.ts   #   学習数によるレベル計算
    └── streak.ts  #   連続学習日数のストリーク管理
```
