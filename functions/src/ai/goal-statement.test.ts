import { describe, expect, it } from "vitest";
import { buildStatementPrompt, cleanStatement } from "./goal-statement";

describe("buildStatementPrompt", () => {
  it("includes the title and only the answered fields, labelled", () => {
    const prompt = buildStatementPrompt("Web Goal 3", {
      specific: "Relaunch the website",
      measurable: "  ",
      timeBound: "By June 30, 2026",
    });
    expect(prompt).toContain("Goal name: Web Goal 3");
    expect(prompt).toContain("Specific: Relaunch the website");
    expect(prompt).toContain("Time-bound: By June 30, 2026");
    expect(prompt).not.toContain("Measurable:");
  });
});

describe("cleanStatement", () => {
  it.each([
    ['"Launch the new site by June 30, 2026."', "Launch the new site by June 30, 2026."],
    ["**Goal statement:** Launch the new site by June 30", "Launch the new site by June 30."],
    ["  Increase NPS\n to 60 by Q4!  ", "Increase NPS to 60 by Q4!"],
  ])("cleans %s", (raw, expected) => {
    expect(cleanStatement(raw)).toBe(expected);
  });
});
