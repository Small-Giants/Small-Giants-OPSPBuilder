import { describe, expect, it } from "vitest";
import type { ClickUpComment } from "./client";
import {
  DEFAULT_RECAP_MARKERS,
  applyRecapToQuarters,
  findLatestRecap,
  findRecaps,
  isApprovalReply,
  parseAmount,
  parseDueDate,
  parseRecap,
  parseRockLine,
  parseStatus,
  type RecapConfig,
} from "./recap";
import type { GoalQuarter } from "../types";

const config: RecapConfig = { recapMarkers: DEFAULT_RECAP_MARKERS };
const STAMP = "2026-11-01T00:00:00.000Z";

const FULL_RECAP = `**OPSP Monthly Recap**

Over October the team shipped the new pricing page and closed four deals.

**OPSP DATA**
- **Period:** October 2026
- **Status:** At Risk
- **Summary:** Pricing page shipped, pipeline is behind plan.
- **Completed quarters:** Q1, Q2, Q3
- **Q4 actual:** $1,250,000
**END OPSP DATA**`;

function comment(overrides: Partial<ClickUpComment> = {}): ClickUpComment {
  return {
    id: "c1",
    comment_text: FULL_RECAP,
    user: { username: "Goal Recap Agent" },
    date: "1761955200000",
    ...overrides,
  };
}

describe("findLatestRecap", () => {
  it("picks the newest comment that opens with the marker", () => {
    const found = findLatestRecap(
      [
        comment({ id: "old", date: "1000" }),
        comment({ id: "chat", comment_text: "Looks good, thanks!", date: "3000" }),
        comment({ id: "new", date: "2000" }),
      ],
      config
    );
    expect(found?.id).toBe("new");
  });

  it("ignores a person quoting the marker mid-comment", () => {
    const quoted = comment({
      comment_text: "Re the OPSP Monthly Recap above: the deal count is wrong.",
    });
    expect(findLatestRecap([quoted], config)).toBeNull();
  });

  it("filters by author name when one is configured", () => {
    const fromPerson = comment({ id: "p", user: { id: 7, username: "Patrick" } });
    const fromAgent = comment({ id: "a", date: "1" });
    const found = findLatestRecap([fromPerson, fromAgent], {
      ...config,
      recapAuthor: "recap agent",
    });
    expect(found?.id).toBe("a");
  });

  it("copes with agent comments that have no user id or no user at all", () => {
    expect(findLatestRecap([comment({ user: null })], config)?.id).toBe("c1");
  });

  it("reads the rich-text parts when comment_text is missing", () => {
    const parts = comment({
      comment_text: undefined,
      comment: [{ text: "OPSP Monthly Recap\n" }, { text: "Body" }],
    });
    expect(findLatestRecap([parts], config)?.id).toBe("c1");
  });
});

describe("parseRecap", () => {
  it("reads every field out of a markdown-formatted data block", () => {
    const parsed = parseRecap(FULL_RECAP);
    expect(parsed).toMatchObject({
      period: "October 2026",
      status: "at_risk",
      summary: "Pricing page shipped, pipeline is behind plan.",
      completedQuarters: ["Q1", "Q2", "Q3"],
      actuals: { Q4: 1_250_000 },
      warnings: [],
    });
  });

  it("keeps the full text so the app can show the narrative", () => {
    expect(parseRecap(FULL_RECAP).text).toContain("closed four deals");
  });

  it("saves the text but changes nothing when both blocks are missing", () => {
    const parsed = parseRecap("OPSP Monthly Recap\nJust prose this month.");
    expect(parsed.status).toBeNull();
    expect(parsed.completedQuarters).toBeNull();
    expect(parsed.warnings).toHaveLength(1);
  });

  it("reads a rock plan with no data block without complaint", () => {
    const parsed = parseRecap(
      [
        "**OPSP Rock Plan**",
        "Here are the rocks for the year.",
        "**OPSP ROCKS**",
        "- Q1 | Launch pricing page | Assignees: Patrick Kuhl, Thomas Rider | Due: 2026-03-31",
        "- Q2 | Hire a designer | Assignee: Emma Roth | Due: June 30, 2026 | Status: Not started",
        "- nonsense line",
        "**END OPSP ROCKS**",
      ].join("\n")
    );
    expect(parsed.rocks.map((r) => r.title)).toEqual(["Launch pricing page", "Hire a designer"]);
    expect(parsed.rocks[1]).toMatchObject({
      quarter: "Q2",
      assignees: ["Emma Roth"],
      dueDate: "2026-06-30",
      status: "not_started",
    });
    expect(parsed.warnings).toEqual(['Could not read the rock line "nonsense line".']);
  });

  it("treats 'None' as no quarters complete rather than unknown", () => {
    const parsed = parseRecap("OPSP DATA\nCompleted quarters: None\nEND OPSP DATA");
    expect(parsed.completedQuarters).toEqual([]);
  });

  it("warns on a status it does not recognise", () => {
    const parsed = parseRecap("OPSP DATA\nStatus: Vibes\nEND OPSP DATA");
    expect(parsed.status).toBeNull();
    expect(parsed.warnings[0]).toContain("Vibes");
  });

  it("only reads lines inside the block", () => {
    const parsed = parseRecap(
      "Status: Complete\nOPSP DATA\nStatus: On Track\nEND OPSP DATA\nStatus: At Risk"
    );
    expect(parsed.status).toBe("in_progress");
  });
});

describe("findRecaps", () => {
  it("returns rock plans and monthly recaps oldest first, once each", () => {
    const plan = comment({ id: "plan", comment_text: "OPSP Rock Plan\n...", date: "1000" });
    const monthly = comment({ id: "oct", date: "2000" });
    const found = findRecaps([monthly, plan, monthly], config);
    expect(found.map((c) => c.id)).toEqual(["plan", "oct"]);
  });
});

describe("isApprovalReply", () => {
  it.each([
    ["Approved", true],
    ["**approved** - numbers look right", true],
    ["Approve", true],
    ["Not approved, Q3 is wrong", false],
    ["Looks good", false],
  ])("treats %s as approval: %s", (text, expected) => {
    expect(isApprovalReply(comment({ comment_text: text }))).toBe(expected);
  });
});

describe("parseRockLine", () => {
  it("reads a linked ClickUp task and splits assignees on commas and 'and'", () => {
    const rock = parseRockLine(
      "Q3 | Rock: Ship v2 | Owners: Sue Zbick and Jason Oxios | Status: Complete | Task: https://app.clickup.com/t/14150185/868h790bp"
    );
    expect(rock).toMatchObject({
      quarter: "Q3",
      title: "Ship v2",
      assignees: ["Sue Zbick", "Jason Oxios"],
      status: "complete",
      taskId: "868h790bp",
    });
  });

  it("ignores 'None' as an assignee", () => {
    expect(parseRockLine("Q1 | Something | Assignees: None")?.assignees).toEqual([]);
  });

  it("needs a quarter and a title", () => {
    expect(parseRockLine("Launch pricing page")).toBeNull();
    expect(parseRockLine("Q1 |")).toBeNull();
  });
});

describe("parseDueDate", () => {
  it.each([
    ["2026-03-31", "2026-03-31"],
    ["2026-3-5", "2026-03-05"],
    ["March 31, 2026", "2026-03-31"],
    ["3/31/2026", "2026-03-31"],
  ])("parses %s", (raw, expected) => {
    expect(parseDueDate(raw)).toBe(expected);
  });

  it("returns null for text", () => {
    expect(parseDueDate("end of quarter")).toBeNull();
  });
});

describe("parseStatus", () => {
  it.each([
    ["On Track", "in_progress"],
    ["off track", "at_risk"],
    ["At risk - pipeline thin", "at_risk"],
    ["Completed", "complete"],
    ["Not started", "not_started"],
  ])("maps %s", (raw, expected) => {
    expect(parseStatus(raw)).toBe(expected);
  });
});

describe("parseAmount", () => {
  it.each([
    ["$1,250,000", 1_250_000],
    ["1.25m", 1_250_000],
    ["40%", 40],
    ["12 hires", 12],
  ])("parses %s", (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it("rejects text", () => {
    expect(parseAmount("about a million")).toBeNull();
  });
});

describe("applyRecapToQuarters", () => {
  const existing: GoalQuarter[] = [
    { quarter: "Q1", target: 100, actual: 90, complete: true },
    { quarter: "Q2", target: 100, actual: null, complete: false },
    { quarter: "Q3", target: 100, actual: null, complete: false },
    { quarter: "Q4", target: 100, actual: null, complete: false },
  ];

  it("sets completion exactly as the recap reports it", () => {
    const { quarters, changed } = applyRecapToQuarters(
      existing,
      { completedQuarters: ["Q2"], actuals: {} },
      { quantitative: false, syncedAt: STAMP }
    );
    expect(changed).toBe(true);
    expect(quarters.map((q) => q.complete)).toEqual([false, true, false, false]);
  });

  it("never touches targets", () => {
    const { quarters } = applyRecapToQuarters(
      existing,
      { completedQuarters: ["Q1", "Q2", "Q3", "Q4"], actuals: { Q2: 5 } },
      { quantitative: true, syncedAt: STAMP }
    );
    expect(quarters.map((q) => q.target)).toEqual([100, 100, 100, 100]);
  });

  it("leaves completion alone when the recap does not mention quarters", () => {
    const { quarters, changed } = applyRecapToQuarters(
      existing,
      { completedQuarters: null, actuals: {} },
      { quantitative: false, syncedAt: STAMP }
    );
    expect(changed).toBe(false);
    expect(quarters[0].complete).toBe(true);
  });

  it("ignores actuals on simple goals", () => {
    const { quarters } = applyRecapToQuarters(
      existing,
      { completedQuarters: null, actuals: { Q2: 50 } },
      { quantitative: false, syncedAt: STAMP }
    );
    expect(quarters[1].actual).toBeNull();
  });

  it("writes actuals on quantitative goals and stamps clickup as the author", () => {
    const { quarters } = applyRecapToQuarters(
      existing,
      { completedQuarters: null, actuals: { Q2: 50 } },
      { quantitative: true, syncedAt: STAMP }
    );
    expect(quarters[1]).toMatchObject({ actual: 50, updatedBy: "clickup", updatedAt: STAMP });
    expect(quarters[0].actual).toBe(90);
  });

  it("fills in all four quarters on a goal that has none", () => {
    const { quarters } = applyRecapToQuarters(
      [],
      { completedQuarters: ["Q1"], actuals: {} },
      { quantitative: false, syncedAt: STAMP }
    );
    expect(quarters.map((q) => q.quarter)).toEqual(["Q1", "Q2", "Q3", "Q4"]);
  });
});
