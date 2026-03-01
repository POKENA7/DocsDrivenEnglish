import { describe, expect, it, vi } from "vitest";

import { fetchMoreExplanationAction } from "@/app/(features)/learn/_api/actions";

vi.mock("@/server/quiz/moreExplanation", () => ({
  fetchMoreExplanation: vi.fn(async () => ({ moreExplanation: "追加解説テキスト" })),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

const { auth } = await import("@clerk/nextjs/server");
const { fetchMoreExplanation } = await import("@/server/quiz/moreExplanation");

const input = { prompt: "test prompt", explanation: "test explanation" };

describe("fetchMoreExplanationAction", () => {
  it("未認証時はエラーをスローする", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);

    await expect(fetchMoreExplanationAction(input)).rejects.toThrow("ログインが必要です");
    expect(fetchMoreExplanation).not.toHaveBeenCalled();
  });

  it("認証済みの場合は fetchMoreExplanation を呼び出す", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_123" } as never);

    const result = await fetchMoreExplanationAction(input);

    expect(fetchMoreExplanation).toHaveBeenCalledWith(input);
    expect(result).toEqual({ moreExplanation: "追加解説テキスト" });
  });
});
