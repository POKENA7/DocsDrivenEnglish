import { beforeEach, describe, expect, it, vi } from "vitest";

import { startSessionFormAction } from "@/app/(features)/learn/_api/actions";

const { redirectMock, requireUserIdMock, startQuizSessionMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  requireUserIdMock: vi.fn(async () => "user_123"),
  startQuizSessionMock: vi.fn(async () => ({ sessionId: "session-123" })),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth", () => ({
  requireUserId: requireUserIdMock,
}));

vi.mock("@/server/quiz/session", () => ({
  startQuizSession: startQuizSessionMock,
}));

vi.mock("@/server/quiz/shared-session", () => ({
  startSharedQuizSession: vi.fn(),
}));

vi.mock("@/server/quiz/answer", () => ({
  submitQuizAnswer: vi.fn(),
}));

vi.mock("@/server/quiz/moreExplanation", () => ({
  fetchMoreExplanation: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

describe("startSessionFormAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("articleKey がある場合は hn_trend として開始する", async () => {
    const formData = new FormData();
    formData.set("topic", "Latest React Compiler");
    formData.set("articleKey", "hn-1234567890000-1");
    formData.set("mode", "reading");
    formData.set("questionCount", "5");
    formData.set("reviewQuestionCount", "2");

    await expect(startSessionFormAction({ error: null }, formData)).rejects.toThrow(
      "REDIRECT:/learn/session-123",
    );

    expect(startQuizSessionMock).toHaveBeenCalledWith({
      topic: "Latest React Compiler",
      sourceType: "hn_trend",
      articleKey: "hn-1234567890000-1",
      mode: "reading",
      questionCount: 5,
      reviewQuestionCount: 2,
      userId: "user_123",
    });
  });

  it("articleKey が空なら manual として開始する", async () => {
    const formData = new FormData();
    formData.set("topic", "React Hooks");
    formData.set("articleKey", "");
    formData.set("mode", "word");
    formData.set("questionCount", "4");
    formData.set("reviewQuestionCount", "9");

    await expect(startSessionFormAction({ error: null }, formData)).rejects.toThrow(
      "REDIRECT:/learn/session-123",
    );

    expect(startQuizSessionMock).toHaveBeenCalledWith({
      topic: "React Hooks",
      sourceType: "manual",
      articleKey: null,
      mode: "word",
      questionCount: 4,
      reviewQuestionCount: 3,
      userId: "user_123",
    });
  });

  it("articleKey の形式が不正な場合はエラーを返す", async () => {
    const formData = new FormData();
    formData.set("topic", "React Hooks");
    formData.set("articleKey", "https://example.com");
    formData.set("mode", "word");

    const result = await startSessionFormAction({ error: null }, formData);

    expect(result).toEqual({ error: "入力値が不正です。" });
    expect(startQuizSessionMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
