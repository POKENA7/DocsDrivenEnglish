import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/quiz/errors";
import { startSingleReviewSession } from "@/server/quiz/session";

// DB に永続化されたレコードを保持するフェイクストア
const sessionStore = new Map<string, Record<string, unknown>>();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: { DB: {} } }),
}));

// 固定の質問データ（questions テーブルからの SELECT 結果）
const sampleRow = {
  topic: "Test Topic",
  mode: "word",
};

let selectReturnRows: unknown[] = [sampleRow];

const mockDb = {
  insert: () => ({
    values: (data: unknown) => {
      const rows = Array.isArray(data) ? data : [data];
      for (const row of rows as Record<string, unknown>[]) {
        if (typeof row.sessionId === "string") {
          sessionStore.set(row.sessionId as string, row);
        }
      }
      return Promise.resolve();
    },
  }),
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(selectReturnRows),
      }),
    }),
  }),
};

vi.mock("@/db/client", () => ({
  createDb: () => mockDb,
  getDb: () => mockDb,
}));

describe("startSingleReviewSession", () => {
  beforeEach(() => {
    sessionStore.clear();
    selectReturnRows = [sampleRow];
  });

  it("正常にセッションを作成して sessionId を返す", async () => {
    const result = await startSingleReviewSession({
      questionId: "original-question-id",
      userId: "test-user",
    });

    expect(result.sessionId).toBeTruthy();
    expect(typeof result.sessionId).toBe("string");
  });

  it("sessions テーブルに questionIdsJson が正しく保存される", async () => {
    const originalQuestionId = "original-question-id";

    const result = await startSingleReviewSession({
      questionId: originalQuestionId,
      userId: "test-user",
    });

    // sessionStore に保存されたセッションを確認
    const savedSession = sessionStore.get(result.sessionId);
    const questionIds = JSON.parse(savedSession?.questionIdsJson as string) as string[];
    expect(questionIds).toEqual([originalQuestionId]);
  });

  it("questions テーブルへの INSERT は行われない", async () => {
    await startSingleReviewSession({
      questionId: "original-question-id",
      userId: "test-user",
    });

    // sessions テーブルへの INSERT のみ（1件）
    expect(sessionStore.size).toBe(1);
  });

  it("存在しない questionId を渡すと NOT_FOUND エラーになる", async () => {
    selectReturnRows = [];

    await expect(
      startSingleReviewSession({ questionId: "nonexistent-id", userId: "test-user" }),
    ).rejects.toThrow(ApiError);
  });
});
