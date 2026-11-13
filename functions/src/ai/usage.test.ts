import { describe, expect, it } from "vitest";
import { costUsd, priceFor, tokensOf, usageMonth } from "./usage";

describe("priceFor", () => {
  it("uses the price in effect on the day of the call", () => {
    expect(priceFor("gemini-3.8-flash", new Date("2026-11-12T12:00:00Z"))).toEqual({ input: 0.75, output: 3.75 });
    expect(priceFor("gemini-3.8-flash", new Date("2027-01-01T12:00:00Z"))).toEqual({ input: 1.5, output: 7.5 });
  });

  it("knows nothing about other models", () => {
    expect(priceFor("gemini-9-ultra", new Date())).toBeNull();
  });
});

describe("costUsd", () => {
  it("bills thinking tokens at the output rate", () => {
    const usage = { promptTokenCount: 400, candidatesTokenCount: 50, thoughtsTokenCount: 950 };
    expect(tokensOf(usage)).toEqual({ input: 400, output: 1000 });
    expect(costUsd(usage, { input: 0.75, output: 3.75 })).toBeCloseTo(0.00405, 8);
  });

  it("is zero without a price", () => {
    expect(costUsd({ promptTokenCount: 1000 }, null)).toBe(0);
  });
});

describe("usageMonth", () => {
  it("rolls over on Arizona time, not UTC", () => {
    expect(usageMonth(new Date("2026-12-01T03:00:00Z"))).toBe("2026-11");
    expect(usageMonth(new Date("2026-12-01T08:00:00Z"))).toBe("2026-12");
  });
});
