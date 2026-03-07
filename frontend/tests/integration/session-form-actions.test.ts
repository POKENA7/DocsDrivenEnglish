import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/quiz/errors";

const redirectError = new Error("REDIRECT");

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw redirectError;
  }),
}));

vi.mock("next/dist/client/components/redirect-error", () => ({
  isRedirectError: vi.fn((error: unknown) => error === redirectError),
}));

vi.mock("@/lib/auth", () => ({
  requireUserId: vi.fn(),
}));

vi.mock("@/server/quiz/session", () => ({
  startQuizSession: vi.fn(),
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

const { redirect } = await import("next/navigation");
const { requireUserId } = await import("@/lib/auth");
const { startQuizSession } = await import("@/server/quiz/session");
const { startSharedQuizSession } = await import("@/server/quiz/shared-session");
const { startSessionFormAction, startSharedSessionFormAction } =
  await import("@/app/(features)/learn/_api/actions");

function createFormData(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("session form actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUserId).mockResolvedValue("user-123" as never);
    vi.mocked(startQuizSession).mockResolvedValue({ sessionId: "session-1" } as never);
    vi.mocked(startSharedQuizSession).mockResolvedValue({ sessionId: "shared-1" } as never);
  });

  it("questionCount が上限超過時にフォールバックし reviewQuestionCount も調整する", async () => {
    const formData = createFormData({
      topic: "  React Hooks  ",
      mode: "word",
      questionCount: "999",
      reviewQuestionCount: "999",
    });

    await expect(startSessionFormAction({ error: null }, formData)).rejects.toBe(redirectError);

    expect(startQuizSession).toHaveBeenCalledWith({
      topic: "React Hooks",
      mode: "word",
      questionCount: 10,
      reviewQuestionCount: 9,
      userId: "user-123",
    });
    expect(redirect).toHaveBeenCalledWith("/learn/session-1");
  });

  it("questionCount が 1 のとき reviewQuestionCount は 0 に丸める", async () => {
    const formData = createFormData({
      topic: "React Hooks",
      mode: "word",
      questionCount: "1",
      reviewQuestionCount: "5",
    });

    await expect(startSessionFormAction({ error: null }, formData)).rejects.toBe(redirectError);

    expect(startQuizSession).toHaveBeenCalledWith({
      topic: "React Hooks",
      mode: "word",
      questionCount: 1,
      reviewQuestionCount: 0,
      userId: "user-123",
    });
  });

  it("topic が空白のみなら入力エラーを返して開始処理を呼ばない", async () => {
    const result = await startSessionFormAction(
      { error: null },
      createFormData({
        topic: "   ",
        mode: "word",
        questionCount: "10",
        reviewQuestionCount: "0",
      }),
    );

    expect(result).toEqual({ error: "入力値が不正です。" });
    expect(startQuizSession).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("共有セッションで NOT_FOUND が返ったときはエラーメッセージをそのまま返す", async () => {
    vi.mocked(startSharedQuizSession).mockRejectedValue(
      new ApiError("NOT_FOUND", "まだ他のユーザーが作成したクイズがありません") as never,
    );

    const result = await startSharedSessionFormAction(
      { error: null },
      createFormData({
        mode: "reading",
        questionCount: "0",
        reviewQuestionCount: "99",
      }),
    );

    expect(startSharedQuizSession).toHaveBeenCalledWith({
      mode: "reading",
      questionCount: 10,
      reviewQuestionCount: 9,
      userId: "user-123",
    });
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toEqual({ error: "まだ他のユーザーが作成したクイズがありません" });
  });
});
