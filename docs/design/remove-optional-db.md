# getOptionalDb 廃止・getDb への統一設計書

## 背景・問題

`getOptionalDb()` は DB が利用できない場合（ローカル開発で `wrangler dev` を使わない場合など）に `null` を返す設計になっている。

これにより、呼び出し側全て（7ファイル）で個別のnullハンドリングが必要になっており、以下の問題が生じている。

### 具体的な問題箇所

| ファイル | nullハンドリング | 振る舞い |
|---|---|---|
| `server/review/query.ts` | `if (!db) return 0;` / `if (!db) return { dueItems: [], upcomingItems: [] };` | 空データを返す |
| `server/review/delete.ts` | `if (!db) return;` | 削除を無視 |
| `server/history/query.ts` | `if (!db) return calculateHistorySummary([]);` | 空データを返す |
| `server/history/record.ts` | `if (!db) return;` | 記録を無視 |
| `server/quiz/query.ts` | 関数引数が `db \| null` になっており `if (!db) return null` | 呼び出し元も汚染 |
| `server/quiz/answer.ts` | `db \| null` を下位関数へ伝搬 | 型が汚染 |
| `server/quiz/session.ts` | `persistSession(db \| null, ...)` の中で `if (!db) return;` | 保存を無視 |
| `server/quiz/shared-session.ts` | `if (!db) throw new ApiError(...)` | 唯一throw |

### 問題の本質

- **振る舞いが不一致**: あるファイルは無視し、あるファイルはthrowする
- **型の汚染**: `db | null` が関数引数として伝搬（`query.ts` → `answer.ts` → `session.ts`）
- **DBなしで「正常動作」に見える**: recordAttempt が無音で何もしないため、バグの発見が遅れる
- **本来不要な考慮**: 本番は Cloudflare Workers 上で動くため、DBが取れない状況は異常系

## 設計方針

`getOptionalDb()` を廃止し、DBが取得できない場合は即座に例外をスローする `getDb()` に統一する。

ローカル開発は `wrangler dev`（D1ローカルエミュレーション付き）を前提とし、DBなし動作はサポートしない。

## 変更内容

### 1. `db/client.ts`

`getOptionalDb()` を削除し、`getDb()` を追加する。

```typescript
// Before
export function getOptionalDb() {
  try {
    const { env } = getCloudflareContext();
    const db = (env as Record<string, unknown>).DB;
    if (!db) return null;
    return createDb(db as D1Database);
  } catch {
    return null;
  }
}

// After
export function getDb() {
  const { env } = getCloudflareContext();
  const db = (env as Record<string, unknown>).DB;
  if (!db) throw new Error("D1 database binding (DB) is not available");
  return createDb(db as D1Database);
}
```

### 2. `server/review/query.ts`

nullフォールバックを削除し、`getDb()` を使用する。

```typescript
// Before
export const getDueReviewCount = cache(async (userId: string): Promise<number> => {
  const db = getOptionalDb();
  if (!db) return 0;
  // ...
});

// After
export const getDueReviewCount = cache(async (userId: string): Promise<number> => {
  const db = getDb();
  // ...
});
```

`getReviewQueue` も同様。

### 3. `server/review/delete.ts`

```typescript
// Before
const db = getOptionalDb();
if (!db) return;

// After
const db = getDb();
```

### 4. `server/history/query.ts`

```typescript
// Before
const db = getOptionalDb();
if (!db) return calculateHistorySummary([]);

// After
const db = getDb();
```

### 5. `server/history/record.ts`

```typescript
// Before
const db = getOptionalDb();
if (!db) return;

// After
const db = getDb();
```

### 6. `server/quiz/query.ts`

`getQuestion()` の引数から `db | null` を除去し、内部で `getDb()` を呼ぶ。

```typescript
// Before
export async function getQuestion(
  db: ReturnType<typeof createDb> | null,
  questionId: string,
): Promise<QuestionRecord | null> {
  if (!db) return null;
  // ...
}

// After
export async function getQuestion(questionId: string): Promise<QuestionRecord | null> {
  const db = getDb();
  // ...
}
```

`getSessionSnapshot` も同様。

### 7. `server/quiz/answer.ts`

`getQuestion(db, ...)` → `getQuestion(...)` に変更し、dbの伝搬を廃止。

```typescript
// Before
const db = getOptionalDb();
const q = await getQuestion(db, input.questionId);
// ...
if (db && input.userId) { ... }

// After
const q = await getQuestion(input.questionId);
// ...
const db = getDb();
if (input.userId) { ... }
```

### 8. `server/quiz/session.ts`

`persistSession` の引数から `db | null` を除去する。

```typescript
// Before
export async function persistSession(
  db: ReturnType<typeof createDb> | null,
  session: SessionRecord,
): Promise<void> {
  if (!db) return;
  // ...
}

// After
export async function persistSession(
  db: ReturnType<typeof createDb>,
  session: SessionRecord,
): Promise<void> {
  // ...
}
```

呼び出し元（セッション生成系）では `getDb()` を呼んでから `persistSession` に渡す。

### 9. `server/quiz/shared-session.ts`

```typescript
// Before
const db = getOptionalDb();
if (!db) {
  throw new ApiError("INTERNAL", "DB接続に失敗しました");
}

// After
const db = getDb();
```

## 影響範囲

- テストコードが `getOptionalDb` をモックしている場合は `getDb` のモックに変更する
- `jest.mock` / `vi.mock` の対象関数名を更新する

## 期待される効果

- nullハンドリングが全呼び出し元から消え、コードが簡潔になる
- 型 `db | null` の伝搬がなくなり、型安全性が向上する
- DBが取れない場合は即座にエラーとなり、問題の発見が早くなる
- DBなしで「正常そうに見える」サイレント障害がなくなる
