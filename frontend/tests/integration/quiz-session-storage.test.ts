import { beforeEach, describe, expect, it, vi } from "vitest";

import { startQuizSession } from "@/server/quiz/session";

const insertedRows: Array<Array<Record<string, unknown>>> = [];
let dueReviewRows: Array<{
  questionId: string;
  prompt: string;
  choicesJson: string;
  correctIndex: number;
  explanation: string;
}> = [];

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: { DB: {} } }),
}));

const mockDb = {
  insert: () => ({
    values: (data: unknown) => {
      const rows = (Array.isArray(data) ? data : [data]) as Array<Record<string, unknown>>;
      insertedRows.push(rows);
      return Promise.resolve();
    },
  }),
  select: () => ({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          limit: () => Promise.resolve(dueReviewRows),
        }),
      }),
    }),
  }),
};

vi.mock("@/db/client", () => ({
  createDb: () => mockDb,
  getDb: () => mockDb,
}));

vi.mock("@/lib/openaiClient", () => ({
  OPENAI_MAX_OUTPUT_TOKENS: 10,
  OPENAI_TIMEOUT_MS: 1000,
  createOpenAIParsedText: vi.fn(),
}));

const { createOpenAIParsedText } = await import("@/lib/openaiClient");

describe("startQuizSession storage", () => {
  beforeEach(() => {
    insertedRows.length = 0;
    dueReviewRows = [];
    vi.clearAllMocks();
  });

  it("review 問題を先頭にしつつ sessions と questions を期待通り保存する", async () => {
    dueReviewRows = [
      {
        questionId: "due-question-id",
        prompt: "復習問題",
        choicesJson: JSON.stringify(["A", "B", "C", "D"]),
        correctIndex: 2,
        explanation: "復習解説",
      },
    ];
    vi.mocked(createOpenAIParsedText).mockResolvedValue({
      items: [
        {
          prompt: "新規問題",
          choices: ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
          correctIndex: 1,
          explanation: "新規解説",
        },
      ],
    } as never);

    const result = await startQuizSession({
      topic: "  React Hooks  ",
      mode: "word",
      questionCount: 2,
      reviewQuestionCount: 1,
      userId: "user-1",
    });

    expect(insertedRows).toHaveLength(2);

    const sessionRow = insertedRows[0]?.[0];
    const questionRows = insertedRows[1];
    const savedQuestionIds = JSON.parse(sessionRow?.questionIdsJson as string) as string[];

    expect(savedQuestionIds[0]).toBe("due-question-id");
    expect(questionRows).toHaveLength(1);
    expect(savedQuestionIds[1]).toBe(questionRows?.[0]?.questionId);
    expect(questionRows?.[0]).toMatchObject({
      userId: "user-1",
      mode: "word",
      topic: "React Hooks",
      prompt: "新規問題",
      choicesJson: JSON.stringify(["選択肢1", "選択肢2", "選択肢3", "選択肢4"]),
      correctIndex: 1,
      explanation: "新規解説",
    });
    expect(result.questions.map((question) => question.questionId)).toEqual(savedQuestionIds);
  });

  it("復習問題だけで必要数を満たす場合は新規生成も questions insert もしない", async () => {
    dueReviewRows = [
      {
        questionId: "due-1",
        prompt: "復習1",
        choicesJson: JSON.stringify(["A", "B", "C", "D"]),
        correctIndex: 0,
        explanation: "解説1",
      },
      {
        questionId: "due-2",
        prompt: "復習2",
        choicesJson: JSON.stringify(["A", "B", "C", "D"]),
        correctIndex: 1,
        explanation: "解説2",
      },
    ];

    const result = await startQuizSession({
      topic: "React Hooks",
      mode: "word",
      questionCount: 2,
      reviewQuestionCount: 2,
      userId: "user-1",
    });

    expect(createOpenAIParsedText).not.toHaveBeenCalled();
    expect(insertedRows).toHaveLength(1);
    expect(JSON.parse(insertedRows[0]?.[0]?.questionIdsJson as string)).toEqual(["due-1", "due-2"]);
    expect(result.questions.map((question) => question.questionId)).toEqual(["due-1", "due-2"]);
  });
});
