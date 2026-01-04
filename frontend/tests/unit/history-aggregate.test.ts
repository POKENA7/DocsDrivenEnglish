import { describe, expect, it } from "vitest";

import { calculateHistorySummary } from "@/app/api/[[...route]]/history";

describe("calculateHistorySummary", () => {
  it("counts distinct study days", () => {
    const attempts = [
      { answeredAt: new Date("2026-01-01T01:00:00.000Z"), isCorrect: true },
      { answeredAt: new Date("2026-01-01T23:59:59.000Z"), isCorrect: false },
      { answeredAt: new Date("2026-01-02T00:00:00.000Z"), isCorrect: true },
    ];

    const summary = calculateHistorySummary(attempts);

    expect(summary.attemptCount).toBe(3);
    expect(summary.correctRate).toBeCloseTo(2 / 3);
    expect(summary.studyDays).toBe(2);
  });
});
