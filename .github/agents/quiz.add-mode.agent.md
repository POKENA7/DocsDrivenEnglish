---
description: 新しいクイズモードを追加する。モード定義・プロンプト・UI・テストまで一貫してガイドする。
---

## ユーザー入力

```text
$ARGUMENTS
```

`$ARGUMENTS` が空でない場合は、必ず内容を考慮してから進むこと。

---

## このSkillについて

DocsDrivenEnglish のクイズモードは `frontend/src/app/api/[[...route]]/quiz.ts` で定義されており、
現在は `"word"` と `"reading"` の2種類がある。

このSkillは、新しいモード（例: `"spelling"`, `"grammar"` など）を追加する際の
実装手順を網羅的にガイドする。

---

## 手順

### 1. 追加するモードの確認

ユーザー入力からモード名と概要を把握する。不明な場合は以下を確認する。

- **モード識別子**（例: `"spelling"`）: API や DB に保存される識別文字列
- **モードの説明**（例: 「英単語のスペルを直接入力する記述式モード」）
- **プロンプトの方針**（LLM にどんな問題を生成させるか）
- **UIの変更点**（4択ラジオを維持するか、テキスト入力に変えるかなど）

### 2. 型定義の更新

**ファイル**: `frontend/src/app/api/[[...route]]/quiz.ts`

```typescript
// 変更前
type Mode = "word" | "reading";

// 変更後（例: spelling を追加）
type Mode = "word" | "reading" | "spelling";
```

同ファイル内の `assertMode` 関数も更新する。

```typescript
function assertMode(mode: unknown): Mode {
  if (mode === "word" || mode === "reading" || mode === "spelling") return mode;
  throw new ApiError("BAD_REQUEST", 400, "mode が不正です");
}
```

### 3. LLM プロンプトの追加

`generateQuizItemsFromTopic` 関数内の `modeSpecific` 変数を拡張する。

既存パターン:
```typescript
const modeSpecific =
  mode === "word"
    ? "word モード要件（厳守）:\n..."
    : "reading モード要件（厳守）:\n...";
```

新モード追加後:
```typescript
const modeSpecific =
  mode === "word"
    ? "word モード要件（厳守）:\n..."
    : mode === "reading"
      ? "reading モード要件（厳守）:\n..."
      : "spelling モード要件（厳守）:\n..."; // 新モードのプロンプト
```

プロンプトには以下を含めること:
- モードの目的（何を学ぶか）
- 問題文・選択肢・解説の形式
- 難易度・品質の指針

### 4. フロントエンド UI の更新

**ファイル**: `frontend/src/app/(features)/learn/_components/LearnPage.tsx`

モード選択のラジオボタンセクションに新モードを追加する。

```tsx
<label className="choice">
  <input className="mt-0.5" type="radio" name="mode" value="spelling" />
  <span>
    <span className="block font-medium">spelling</span>
    <span className="mt-1 block text-xs text-muted-foreground">
      スペルの記憶を優先  {/* モードに合わせた説明 */}
    </span>
  </span>
</label>
```

### 5. クライアント型定義の更新

**ファイル**: `frontend/src/lib/honoRpcClient.ts`

```typescript
// 変更前
$post: (args: { json: { topic: string; mode: "word" | "reading" } }) => Promise<Response>;

// 変更後
$post: (args: { json: { topic: string; mode: "word" | "reading" | "spelling" } }) => Promise<Response>;
```

また、以下のファイルでも `mode` 型を使っている箇所を確認・更新する:
- `frontend/src/app/(features)/learn/_api/query.ts` (`StartSessionInput`)
- `frontend/src/app/(features)/session/_api/query.ts` (`ContinueSessionInput`)
- `frontend/src/app/(features)/session/_hooks/useQuizSession.ts` (`SessionSnapshot`)
- `frontend/src/app/(features)/session/_components/SessionCompletePage.tsx`

### 6. テストの追加・更新

**ファイル**: `frontend/tests/integration/quiz-session.test.ts`（既存）

新モードで `/api/quiz/session` が 200 を返すことを確認するテストを追加する。

```typescript
it("returns 200 for new mode", async () => {
  const res = await apiApp.request("http://localhost/api/quiz/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ topic: "React Hooks", mode: "spelling" }),
  });
  expect(res.status).toBe(200);
});
```

`frontend/tests/integration/quiz-session-errors.test.ts` の不正モードテストも確認し、
新モードが誤って rejected されないことを確認する。

### 7. 検証

以下のコマンドで動作確認する。

```bash
cd frontend
npm run test:run
npm run lint
npm run format:check
```

---

## チェックリスト

- [ ] `quiz.ts` の `Mode` 型に新モードを追加
- [ ] `quiz.ts` の `assertMode` 関数を更新
- [ ] `quiz.ts` の `generateQuizItemsFromTopic` にモード別プロンプトを追加
- [ ] `LearnPage.tsx` にモード選択 UI を追加
- [ ] `honoRpcClient.ts` の `mode` 型を更新
- [ ] `query.ts` 等、`mode` 型参照箇所をすべて更新
- [ ] 統合テストを追加・更新
- [ ] `npm run test:run` / `npm run lint` / `npm run format:check` が通ることを確認
- [ ] `docs/SPEC.md` の「学習モード」セクションを更新
