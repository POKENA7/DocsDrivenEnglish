# Zod スキーマ重複排除リファクタリング設計書（第2弾）

## 背景・問題

`modeSchema` の統一（第1弾）と同様の問題が、他に2箇所存在することを確認した。

---

## 問題 1: `MoreExplanationResponse` と `MoreExplanationSchema` の重複

### 現状

```typescript
// frontend/src/server/quiz/types.ts
export type MoreExplanationResponse = {
  moreExplanation: string;
};

// frontend/src/server/quiz/moreExplanation.ts
const MoreExplanationSchema = z.object({
  moreExplanation: z.string(),
});
```

`MoreExplanationResponse` の型定義と `MoreExplanationSchema` の形状が完全に一致しているが、
別ファイルに分散して二重管理されている。

### 解決方針

`modeSchema` と同様に、Zod スキーマを single source of truth にし、
`MoreExplanationResponse` 型を `z.infer` で導出する。

スキーマは `types.ts` に移動し、`moreExplanation.ts` からインポートして利用する。
これにより `moreExplanation.ts` → `types.ts` の依存方向が維持され、循環依存は発生しない。

### 変更内容

#### `frontend/src/server/quiz/types.ts`

```diff
+ export const moreExplanationResponseSchema = z.object({
+   moreExplanation: z.string(),
+ });
- export type MoreExplanationResponse = {
-   moreExplanation: string;
- };
+ export type MoreExplanationResponse = z.infer<typeof moreExplanationResponseSchema>;
```

#### `frontend/src/server/quiz/moreExplanation.ts`

```diff
+ import { moreExplanationResponseSchema } from "./types";
  import type { MoreExplanationInput, MoreExplanationResponse } from "./types";

- const MoreExplanationSchema = z.object({
-   moreExplanation: z.string(),
- });

  // 関数内の createOpenAIParsedText の引数を更新
- const parsed = await createOpenAIParsedText(prompt, MODEL, MoreExplanationSchema, ...);
+ const parsed = await createOpenAIParsedText(prompt, MODEL, moreExplanationResponseSchema, ...);
```

### 影響範囲

- `MoreExplanationResponse` を利用している既存ファイルへの影響なし（型インターフェースは変わらない）
- `moreExplanation.ts` のバリデーション動作は変わらない
- `MoreExplanationInput` は Zod スキーマ化の恩恵が薄いため対象外（`types.ts` のまま型定義として残す）

---

## 問題 2: `GeneratedQuizItem` と Zod アイテムスキーマの重複

### 現状

```typescript
// frontend/src/server/quiz/generate.ts
type GeneratedQuizItem = {
  prompt: string;
  choices: string[];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
};

// 同ファイル内（関数内部）
const QuizItemsSchema = z.object({
  items: z
    .array(
      z.object({
        prompt: z.string(),
        // NOTE: OpenAI Structured Outputs は JSON Schema の tuple 表現（items が配列）を受け付けないため、
        // 「配列 + min/max=4」で表現する。
        choices: z.array(z.string()).min(4).max(4),
        correctIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
        explanation: z.string(),
      }),
    )
    .min(1)
    .max(questionCount),  // ← questionCount が動的なため関数内で定義する必要がある
});
```

`GeneratedQuizItem` 型と Zod の内部アイテムスキーマが同一形状を手動で重複定義している。
特に `correctIndex: 0 | 1 | 2 | 3` のような制約が2箇所に分散しており、変更漏れのリスクがある。

### 解決方針

アイテム1件分のスキーマ（`quizItemSchema`）をファイルトップレベルの定数として抽出し、
`GeneratedQuizItem` 型を `z.infer` で導出する。

`QuizItemsSchema` 全体は `.max(questionCount)` が動的なため引き続き関数内で構築するが、
アイテム部分のスキーマは `quizItemSchema` を参照することで形状を一元管理できる。

### 変更内容

#### `frontend/src/server/quiz/generate.ts`

```diff
+ const quizItemSchema = z.object({
+   prompt: z.string(),
+   // NOTE: OpenAI Structured Outputs は JSON Schema の tuple 表現（items が配列）を受け付けないため、
+   // 「配列 + min/max=4」で表現する。
+   choices: z.array(z.string()).min(4).max(4),
+   correctIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
+   explanation: z.string(),
+ });

- type GeneratedQuizItem = {
-   prompt: string;
-   choices: string[];
-   correctIndex: 0 | 1 | 2 | 3;
-   explanation: string;
- };
+ type GeneratedQuizItem = z.infer<typeof quizItemSchema>;

  // 関数内の QuizItemsSchema を quizItemSchema を参照する形に変更
  const QuizItemsSchema = z.object({
-   items: z
-     .array(
-       z.object({
-         prompt: z.string(),
-         choices: z.array(z.string()).min(4).max(4),
-         correctIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
-         explanation: z.string(),
-       }),
-     )
-     .min(1)
-     .max(questionCount),
+   items: z.array(quizItemSchema).min(1).max(questionCount),
  });
```

### 影響範囲

- `GeneratedQuizItem` は `generate.ts` 内でのみ使用されており、外部への影響なし
- `generateQuizItemsFromTopic` の返り値・挙動は変わらない
- OpenAI Structured Outputs に渡すスキーマ形状は変わらない

---

## 優先度

| 問題 | 重複の場所 | 影響リスク | 優先度 |
|------|-----------|-----------|--------|
| 問題 1: `MoreExplanationResponse` | クロスファイル | 中（型不一致リスク） | 高 |
| 問題 2: `GeneratedQuizItem` | 同一ファイル内 | 低（同ファイルゆえ変更漏れのリスクは小さい） | 中 |

## 対象外

- `MoreExplanationInput`：Zod スキーマが存在せず、バリデーション用途でも使われていない
- `QuestionRecord` / `SessionRecord` など：Zod スキーマ化の恩恵が薄く、DB から組み立てるデータ構造のため型として残す
- `questionCountSchema` / `reviewQuestionCountSchema`：バリデーション固有ロジック（`min`/`max`/`catch`）を含み、型ファイルに置く意義が薄い（第1弾設計書と同様の理由）
