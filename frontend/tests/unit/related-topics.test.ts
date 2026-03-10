import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: { DB: {} } }),
}));

vi.mock("@/db/client", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/openaiClient", () => ({
  createOpenAIParsedText: vi.fn(),
}));

function createSelectBuilder(results: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: () => Promise.resolve(results),
        }),
        limit: () => Promise.resolve(results),
      }),
    }),
  };
}

describe("related-topics", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("fresh cache があればそれを返す", async () => {
    const { getDb } = await import("@/db/client");
    const { createOpenAIParsedText } = await import("@/lib/openaiClient");

    vi.mocked(getDb).mockReturnValue({
      select: () =>
        createSelectBuilder([
          {
            userId: "user-1",
            topics: JSON.stringify([" React ", "TypeScript", "React"]),
            cachedAt: Date.now(),
          },
        ]),
    } as never);

    const { getRelatedTopicSuggestions } = await import("@/server/suggestions/related-topics");
    const topics = await getRelatedTopicSuggestions("user-1");

    expect(topics).toEqual(["React", "TypeScript"]);
    expect(createOpenAIParsedText).not.toHaveBeenCalled();
  });

  it("cache miss 時は OpenAI に個別 maxOutputTokens を渡さず保存する", async () => {
    const selectResults = [[], [{ topic: "React" }, { topic: "TypeScript" }, { topic: "React" }]];
    const onConflictDoUpdate = vi.fn(async () => undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));

    const { getDb } = await import("@/db/client");
    const { createOpenAIParsedText } = await import("@/lib/openaiClient");

    vi.mocked(getDb).mockReturnValue({
      select: () => createSelectBuilder(selectResults.shift() ?? []),
      insert,
    } as never);
    vi.mocked(createOpenAIParsedText).mockResolvedValue({
      topics: ["Next.js", " TypeScript ", "Next.js"],
    });

    const { getRelatedTopicSuggestions } = await import("@/server/suggestions/related-topics");
    const topics = await getRelatedTopicSuggestions("user-1");

    expect(topics).toEqual(["Next.js", "TypeScript"]);
    expect(createOpenAIParsedText).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createOpenAIParsedText).mock.calls[0]).toHaveLength(4);
    expect(vi.mocked(createOpenAIParsedText).mock.calls[0]?.[1]).toBe("gpt-5-mini");
    expect(vi.mocked(createOpenAIParsedText).mock.calls[0]?.[3]).toBe("related_topics_ja");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        topics: JSON.stringify(["Next.js", "TypeScript"]),
      }),
    );
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });
});
