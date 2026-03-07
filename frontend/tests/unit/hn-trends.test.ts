import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: { DB: {} } }),
}));

vi.mock("@/db/client", () => ({
  getDb: vi.fn(),
}));

describe("hn-trends", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fresh cache があればそれを返す", async () => {
    const { getDb } = await import("@/db/client");
    vi.mocked(getDb).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: 1,
                  articles: JSON.stringify([
                    {
                      articleKey: "hn-1234567890000-0",
                      title: "React 20",
                      url: "https://example.com/react-20",
                    },
                  ]),
                  cachedAt: Date.now(),
                },
              ]),
          }),
        }),
      }),
    } as never);

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { getHnTrendArticles } = await import("@/server/suggestions/hn-trends");
    const articles = await getHnTrendArticles();

    expect(articles).toEqual([
      {
        articleKey: "hn-1234567890000-0",
        title: "React 20",
        url: "https://example.com/react-20",
      },
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("cached article から本文を抽出できる", async () => {
    const { getDb } = await import("@/db/client");
    vi.mocked(getDb).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: 1,
                  articles: JSON.stringify([
                    {
                      articleKey: "hn-1234567890000-0",
                      title: "React 20",
                      url: "https://example.com/react-20",
                    },
                  ]),
                  cachedAt: 1234567890000,
                },
              ]),
          }),
        }),
      }),
    } as never);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () =>
        "<html><body><article><h1>React 20</h1><p>React 20 introduces compiler improvements.</p></article></body></html>",
    } as Response);

    const { fetchHnTrendArticleContent } = await import("@/server/suggestions/hn-trends");
    const article = await fetchHnTrendArticleContent("hn-1234567890000-0");

    expect(article.title).toBe("React 20");
    expect(article.articleKey).toBe("hn-1234567890000-0");
    expect(article.content).toContain("React 20 introduces compiler improvements.");
  });
});
