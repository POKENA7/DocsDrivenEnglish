import { describe, expect, it, vi } from "vitest";

import { getSessionResult } from "@/server/quiz/query";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: { DB: {} } }),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

vi.mock("@/db/client", () => ({
  getDb: vi.fn(),
}));

const SESSION_ID = "sess-1";
const QUESTION_IDS = ["q-1", "q-2", "q-3"];

const mockSession = {
  sessionId: SESSION_ID,
  topic: "React Hooks",
  mode: "word",
  questionIdsJson: JSON.stringify(QUESTION_IDS),
};

const mockQuestions = [
  {
    questionId: "q-1",
    prompt: "What is useState?",
    choicesJson: '["A","B","C","D"]',
    correctIndex: 0,
  },
  {
    questionId: "q-2",
    prompt: "What is useEffect?",
    choicesJson: '["A","B","C","D"]',
    correctIndex: 1,
  },
  {
    questionId: "q-3",
    prompt: "What is useRef?",
    choicesJson: '["A","B","C","D"]',
    correctIndex: 2,
  },
];

/**
 * getSessionResult は 3 回 db.select() を呼ぶ:
 *   1回目: sessions（.limit(1) あり）→ mockSession
 *   2回目: questions（Promise.all[0], .limit() なし）→ mockQuestions
 *   3回目: attempts（Promise.all[1], .limit() なし）→ mockAttempts
 */
function mockDbWith(sessionRows: unknown[], questionRows: unknown[], attemptRows: unknown[]) {
  const responses = [sessionRows, questionRows, attemptRows];
  let callIndex = 0;

  return {
    select: () => {
      const currentIndex = callIndex++;
      const rows = responses[currentIndex] ?? [];
      // limit() あり・なし両方に対応した thenable
      const result = Promise.resolve(rows);
      return {
        from: () => ({
          where: () =>
            Object.assign(result, {
              limit: () => result,
            }),
        }),
      };
    },
  } as unknown as ReturnType<typeof import("@/db/client").getDb>;
}

describe("getSessionResult", () => {
  it("セッションが存在しない場合は notFound を呼ぶ", async () => {
    const { getDb } = await import("@/db/client");
    vi.mocked(getDb).mockReturnValue(mockDbWith([], [], []));

    await expect(getSessionResult("nonexistent")).rejects.toThrow("NOT_FOUND");
  });

  it("attempts と questions を結合して正しい SessionResult を返す", async () => {
    const { getDb } = await import("@/db/client");
    const mockAttempts = [
      { questionId: "q-1", isCorrect: true },
      { questionId: "q-2", isCorrect: false },
      // q-3 は未回答
    ];
    vi.mocked(getDb).mockReturnValue(mockDbWith([mockSession], mockQuestions, mockAttempts));

    const result = await getSessionResult(SESSION_ID);

    expect(result.topic).toBe("React Hooks");
    expect(result.mode).toBe("word");
    expect(result.totalCount).toBe(3);
    expect(result.correctCount).toBe(1);

    expect(result.items[0]).toMatchObject({ questionId: "q-1", isCorrect: true });
    expect(result.items[1]).toMatchObject({
      questionId: "q-2",
      isCorrect: false,
      choices: ["A", "B", "C", "D"],
      correctIndex: 1,
    });
    // 未回答は isCorrect: false
    expect(result.items[2]).toMatchObject({ questionId: "q-3", isCorrect: false });
  });

  it("全問正解の場合、correctCount と totalCount が一致する", async () => {
    const { getDb } = await import("@/db/client");
    const allCorrectAttempts = QUESTION_IDS.map((id) => ({ questionId: id, isCorrect: true }));
    vi.mocked(getDb).mockReturnValue(mockDbWith([mockSession], mockQuestions, allCorrectAttempts));

    const result = await getSessionResult(SESSION_ID);
    expect(result.correctCount).toBe(result.totalCount);
  });

  it("questionIdsJson の順序を保持する", async () => {
    const { getDb } = await import("@/db/client");
    // DB から逆順で返ってきても questionIdsJson の順序で並ぶはず
    const reversedQuestions = [...mockQuestions].reverse();
    vi.mocked(getDb).mockReturnValue(mockDbWith([mockSession], reversedQuestions, []));

    const result = await getSessionResult(SESSION_ID);
    expect(result.items.map((i) => i.questionId)).toEqual(QUESTION_IDS);
  });
});
