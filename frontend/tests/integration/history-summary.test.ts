import { describe, expect, it, vi } from "vitest";

import { apiApp } from "@/app/api/[[...route]]/app";
import { ApiError } from "@/app/api/[[...route]]/errors";

declare global {
  var __TEST_USER_ID__: string | null | undefined;
}

vi.mock("@/lib/auth", () => {
  function getTestUserId(): string | null {
    const value = globalThis.__TEST_USER_ID__;
    return typeof value === "string" && value ? value : null;
  }

  return {
    getOptionalUserId: () => getTestUserId(),
    requireUserId: () => {
      const userId = getTestUserId();
      if (!userId) {
        throw new ApiError("UNAUTHORIZED", 401, "Unauthorized");
      }
      return userId;
    },
  };
});

describe("GET /api/history/summary", () => {
  it("returns 401 when not authenticated", async () => {
    globalThis.__TEST_USER_ID__ = null;

    const res = await apiApp.request("http://localhost/api/history/summary", {
      method: "GET",
    });

    expect(res.status).toBe(401);
  });

  it("returns 200 when authenticated", async () => {
    globalThis.__TEST_USER_ID__ = "user_test_1";

    const res = await apiApp.request("http://localhost/api/history/summary", {
      method: "GET",
    });

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual({ attemptCount: 0, correctRate: 0, studyDays: 0 });
  });
});
