---
description: Hono API エンドポイントをプロジェクト規約に従って追加する。ルート定義・型エクスポート・RPC クライアント更新・テストまでガイドする。
---

## ユーザー入力

```text
$ARGUMENTS
```

`$ARGUMENTS` が空でない場合は、必ず内容を考慮してから進むこと。

---

## このSkillについて

DocsDrivenEnglish の API は Next.js の `route.ts` 上で Hono を使って実装されている。

- **エントリポイント**: `frontend/src/app/api/[[...route]]/route.ts`
- **アプリ定義**: `frontend/src/app/api/[[...route]]/app.ts`
- **既存ルート**: `quiz.ts`（`/api/quiz/*`）、`history.ts`（`/api/history/*`）
- **RPC クライアント**: `frontend/src/lib/honoRpcClient.ts`

このSkillは、新しい API エンドポイントを追加する際の実装手順をガイドする。

---

## 手順

### 1. エンドポイント設計の確認

ユーザー入力から以下を把握する。

- **パス**（例: `/api/bookmarks/*`）
- **メソッド**（GET / POST / PUT / DELETE）
- **リクエスト/レスポンスの型**
- **認証の要否**（Clerk の `requireUserId` を使うか）
- **DB アクセスの要否**

### 2. 新しいルートファイルを作成

**ファイル**: `frontend/src/app/api/[[...route]]/<name>.ts`

既存の `history.ts` を参考に作成する。

```typescript
import "server-only";

import { Hono } from "hono";

// 認証が必要な場合
import { requireUserId } from "@/lib/auth";

// DB が必要な場合
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db/client";

// エラーハンドリング
import { ApiError } from "./errors";

// レスポンス型のエクスポート（RPC クライアントの型推論に使用）
export type MyEndpointResponse = {
  // ...
};

const app = new Hono()
  .get("/example", async (c) => {
    // 認証チェック（必要な場合）
    const userId = await requireUserId();

    // DB アクセス（必要な場合）
    // const { env } = getCloudflareContext();
    // const db = createDb((env as Record<string, unknown>).DB as ...);

    return c.json({ message: "ok" } satisfies MyEndpointResponse);
  })
  .post("/example", async (c) => {
    const body = await c.req.json().catch((): unknown => null);
    if (!body || typeof body !== "object") {
      throw new ApiError("BAD_REQUEST", 400, "リクエストが不正です");
    }

    // 処理...

    return c.json({ result: "success" });
  });

export default app;
```

**重要なパターン**:
- DB アクセスには `getOptionalDb` パターンを使う（`quiz.ts` を参照）
  - `getCloudflareContext()` が失敗する場合は null を返してグレースフルに処理する
- バリデーションは `ApiError` で統一する
- `"server-only"` インポートを先頭に追加する

### 3. app.ts にルートを登録

**ファイル**: `frontend/src/app/api/[[...route]]/app.ts`

```typescript
import myApp from "./my-feature"; // 新しいファイルをインポート

export const apiApp = new Hono()
  .basePath("/api")
  .route("/quiz", quizApp)
  .route("/history", historyApp)
  .route("/my-feature", myApp) // 追加
  .onError((err, c) => toErrorResponse(c, err));
```

### 4. RPC クライアントを更新

**ファイル**: `frontend/src/lib/honoRpcClient.ts`

```typescript
export type HonoRpcClient = {
  quiz: { ... };
  history: { ... };
  // 新しいエンドポイントを追加
  "my-feature": {
    example: {
      $get: () => Promise<Response>;
      $post: (args: { json: { /* リクエスト型 */ } }) => Promise<Response>;
    };
  };
};
```

### 5. feature 側の query / action を作成

**ファイル**: `frontend/src/app/(features)/<feature>/_api/query.ts`

```typescript
import { honoRpcClient } from "@/lib/honoRpcClient";
import { rpcJson } from "@/lib/swr";
import type { MyEndpointResponse } from "@/app/api/[[...route]]/my-feature";

export async function myQuery(): Promise<MyEndpointResponse> {
  return rpcJson<MyEndpointResponse>(honoRpcClient["my-feature"].example.$get());
}
```

**ファイル**: `frontend/src/app/(features)/<feature>/_api/actions.ts`（mutation の場合）

```typescript
import type { MyEndpointResponse } from "@/app/api/[[...route]]/my-feature";
import { myQuery } from "./query";

export async function myAction(): Promise<MyEndpointResponse> {
  return myQuery();
}
```

### 6. テストを追加

**ファイル**: `frontend/tests/integration/<feature>.test.ts`

既存の `quiz-session.test.ts` や `history-summary.test.ts` を参考に作成する。

```typescript
import { describe, expect, it, vi } from "vitest";
import { apiApp } from "@/app/api/[[...route]]/app";

// 必要に応じてモックを設定
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: {} }),
}));

describe("GET /api/my-feature/example", () => {
  it("returns 200", async () => {
    const res = await apiApp.request("http://localhost/api/my-feature/example", {
      method: "GET",
    });
    expect(res.status).toBe(200);
  });
});
```

### 7. 検証

```bash
cd frontend
npm run test:run
npm run lint
npm run format:check
```

---

## チェックリスト

- [ ] `frontend/src/app/api/[[...route]]/<name>.ts` を作成
  - [ ] `"server-only"` インポートを先頭に追加
  - [ ] レスポンス型を `export type` で定義
  - [ ] エラーは `ApiError` で統一
- [ ] `frontend/src/app/api/[[...route]]/app.ts` にルートを登録
- [ ] `frontend/src/lib/honoRpcClient.ts` の `HonoRpcClient` 型を更新
- [ ] `frontend/src/app/(features)/<feature>/_api/query.ts` を作成/更新
- [ ] `frontend/src/app/(features)/<feature>/_api/actions.ts` を作成/更新（mutation の場合）
- [ ] `frontend/tests/integration/<feature>.test.ts` を作成
- [ ] `npm run test:run` / `npm run lint` / `npm run format:check` が通ることを確認
