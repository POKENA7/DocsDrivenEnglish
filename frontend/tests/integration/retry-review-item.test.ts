import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/quiz/errors";
import { startSingleReviewSession } from "@/server/quiz/session";

// DB に永続化されたレコードを保持するフェイクストア
const sessionStore = new Map<string, Record<string, unknown>>();
const questionStore = new Map<string, Record<string, unknown>>();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: { DB: {} } }),
}));

// 固定の質問データ（innerJoin 結果のシミュレーション）
const sampleRow = {
  prompt: "次の英文の意味として最も適切なものを選んでください。\n英文: Test content.",
  choicesJson: JSON.stringify(["選択肢A", "選択肢B", "選択肢C", "選択肢D"]),
  correctIndex: 1,
  explanation: "テスト解説",
  topic: "Test Topic",
  mode: "word",
};

let selectReturnRows: unknown[] = [sampleRow];

const mockDb = {
  insert: () => ({
    values: (data: unknown) => {
      const rows = Array.isArray(data) ? data : [data];
      for (const row of rows as Record<string, unknown>[]) {
        if (typeof row.questionId === "string") {
          questionStore.set(row.questionId as string, row);
        }
        if (typeof row.sessionId === "string" && !row.questionId) {
          sessionStore.set(row.sessionId as string, row);
        }
      }
      return Promise.resolve();
    },
  }),
  select: () => ({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          limit: () => Promise.resolve(selectReturnRows),
        }),
      }),
    }),
  }),
};

vi.mock("@/db/client", () => ({
  createDb: () => mockDb,
  getOptionalDb: () => mockDb,
}));

describe("startSingleReviewSession", () => {
  beforeEach(() => {
    sessionStore.clear();
    questionStore.clear();
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

  it("sourceQuestionId が元の questionId にセットされる", async () => {
    const originalQuestionId = "original-question-id";

    await startSingleReviewSession({
      questionId: originalQuestionId,
      userId: "test-user",
    });

    // questionStore に保存された問題を確認
    const savedQuestion = [...questionStore.values()][0];
    expect(savedQuestion?.sourceQuestionId).toBe(originalQuestionId);
  });

  it("1問だけのセッションが作成される", async () => {
    await startSingleReviewSession({
      questionId: "original-question-id",
      userId: "test-user",
    });

    expect(questionStore.size).toBe(1);
  });

  it("存在しない questionId を渡すと NOT_FOUND エラーになる", async () => {
    selectReturnRows = [];

    await expect(
      startSingleReviewSession({ questionId: "nonexistent-id", userId: "test-user" }),
    ).rejects.toThrow(ApiError);
  });
});
