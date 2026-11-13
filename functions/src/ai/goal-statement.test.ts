import { describe, expect, it } from "vitest";
import { buildStatementPrompt, cleanStatement } from "./goal-statement";
import { DEFAULT_STATEMENT_INSTRUCTIONS } from "./statement-instructions";

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

  it("uses the edited prompt when there is one, and the built-in one when it is blank", () => {
    const edited = buildStatementPrompt("Hiring", { specific: "Hire two developers" }, "Write it like a pirate.");
    expect(edited.startsWith("Write it like a pirate.\n")).toBe(true);
    expect(edited).toContain("Specific: Hire two developers");
    expect(buildStatementPrompt("Hiring", {}, "   ")).toContain(DEFAULT_STATEMENT_INSTRUCTIONS);
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
