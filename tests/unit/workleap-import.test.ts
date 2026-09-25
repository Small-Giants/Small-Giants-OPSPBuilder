import { describe, expect, it } from "vitest";
import {
  mapHeaders,
  normalizeStatus,
  parseCsv,
  parseDate,
  parseNumber,
  planWorkleapImport,
  quarterFromDate,
  resolveParents,
  summarizeImport,
  type ImportContext,
  type ImportedGoal,
} from "@/lib/workleap-import";

function context(overrides: Partial<ImportContext> = {}): ImportContext {
  return {
    planYear: 2026,
    usersByEmail: new Map([
      ["alice@smallgiantsonline.com", { id: "u-alice", name: "Alice", departmentId: "d-sales" }],
      ["bob@smallgiantsonline.com", { id: "u-bob", name: "Bob", departmentId: null }],
    ]),
    departmentsByName: new Map([
      ["sales", "d-sales"],
      ["marketing", "d-marketing"],
    ]),
    ...overrides,
  };
}

describe("parseCsv", () => {
  it("splits plain rows", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps commas inside quoted fields", () => {
    expect(parseCsv('a,b\n"one, two",3')).toEqual([
      ["a", "b"],
      ["one, two", "3"],
    ]);
  });

  it("unescapes doubled quotes", () => {
    expect(parseCsv('a\n"He said ""hi"""')).toEqual([["a"], ['He said "hi"']]);
  });

  it("handles newlines inside quoted fields", () => {
    expect(parseCsv('a,b\n"line one\nline two",x')).toEqual([
      ["a", "b"],
      ["line one\nline two", "x"],
    ]);
  });

  it("strips a UTF-8 BOM and blank rows", () => {
    expect(parseCsv("\uFEFFa,b\n\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("mapHeaders", () => {
  it("matches known aliases regardless of case and spacing", () => {
    const mapped = mapHeaders([" Objective ", "Owner Email", "Due Date"]);
    expect(mapped).toEqual({ title: 0, ownerEmail: 1, dueDate: 2 });
  });

  it("keeps the first match when a header appears twice", () => {
    expect(mapHeaders(["Goal", "Title"]).title).toBe(0);
  });
});

describe("normalizeStatus", () => {
  it("maps Workleap wording onto the OPSP statuses", () => {
    expect(normalizeStatus("Achieved")).toBe("complete");
    expect(normalizeStatus("Off track")).toBe("at_risk");
    expect(normalizeStatus("Draft")).toBe("not_started");
  });

  it("defaults unknown values to in progress rather than dropping the row", () => {
    expect(normalizeStatus("who knows")).toBe("in_progress");
    expect(normalizeStatus(undefined)).toBe("in_progress");
  });
});

describe("parseNumber", () => {
  it("strips currency and percent formatting", () => {
    expect(parseNumber("$1,250,000")).toBe(1250000);
    expect(parseNumber("85%")).toBe(85);
  });

  it("returns null for blanks and junk", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("n/a")).toBeNull();
  });
});

describe("parseDate", () => {
  it("passes ISO dates through", () => {
    expect(parseDate("2026-03-31T00:00:00Z")).toBe("2026-03-31");
  });

  it("converts US-style dates", () => {
    expect(parseDate("3/9/26")).toBe("2026-03-09");
    expect(parseDate("12/31/2026")).toBe("2026-12-31");
  });

  it("returns undefined rather than an invalid date", () => {
    expect(parseDate("not a date")).toBeUndefined();
    expect(parseDate("")).toBeUndefined();
  });
});

describe("quarterFromDate", () => {
  it("maps a month onto its quarter", () => {
    expect(quarterFromDate("2026-01-15")).toBe("Q1");
    expect(quarterFromDate("2026-12-31")).toBe("Q4");
  });
});

describe("planWorkleapImport", () => {
  const csv = [
    "Objective,Description,Owner Email,Team,Parent Goal,Status,Due Date,Target,Current,Unit",
    'Grow revenue,"Sell more, faster",alice@smallgiantsonline.com,Sales,,In progress,2026-12-31,10000000,4000000,$',
    "Close 20 deals,,alice@smallgiantsonline.com,Sales,Grow revenue,Achieved,2026-03-31,20,20,deals",
  ].join("\n");

  it("maps rows onto goals", () => {
    const plan = planWorkleapImport(csv, context());
    expect(plan.goals).toHaveLength(2);
    expect(plan.missingColumns).toEqual([]);
  });

  it("treats a goal with no parent as a department goal", () => {
    const plan = planWorkleapImport(csv, context());
    expect(plan.goals[0].level).toBe("department");
    expect(plan.goals[1].level).toBe("individual");
  });

  it("resolves the owner and department", () => {
    const [goal] = planWorkleapImport(csv, context()).goals;
    expect(goal.ownerId).toBe("u-alice");
    expect(goal.departmentId).toBe("d-sales");
  });

  it("puts the value in the quarter the goal is due", () => {
    const [revenue] = planWorkleapImport(csv, context()).goals;
    const q4 = revenue.quarters.find((q) => q.quarter === "Q4");
    expect(q4).toMatchObject({ target: 10000000, actual: 4000000 });
    expect(revenue.quarters.find((q) => q.quarter === "Q1")?.target).toBeNull();
  });

  it("marks a completed goal's quarter complete", () => {
    const [, deals] = planWorkleapImport(csv, context()).goals;
    expect(deals.quarters.find((q) => q.quarter === "Q1")?.complete).toBe(true);
  });

  it("uses a simple measurement when there is no target", () => {
    const plan = planWorkleapImport(
      "Goal,Owner Email\nImprove onboarding,bob@smallgiantsonline.com",
      context()
    );
    expect(plan.goals[0].measurement.type).toBe("simple");
  });

  it("warns instead of failing when the owner has no OPSP account", () => {
    const plan = planWorkleapImport(
      "Goal,Owner Email\nSomething,ghost@smallgiantsonline.com",
      context()
    );
    expect(plan.goals[0].ownerId).toBe("");
    expect(plan.warnings[0]).toContain("ghost@smallgiantsonline.com");
  });

  it("falls back to the owner's department when the team is unknown", () => {
    const plan = planWorkleapImport(
      "Goal,Owner Email,Team\nSomething,alice@smallgiantsonline.com,Operations",
      context()
    );
    expect(plan.goals[0].departmentId).toBe("d-sales");
    expect(plan.warnings.join(" ")).toContain("Operations");
  });

  it("skips rows with no goal name and says which row", () => {
    const plan = planWorkleapImport("Goal,Owner Email\n,alice@smallgiantsonline.com", context());
    expect(plan.goals).toHaveLength(0);
    expect(plan.skipped).toEqual([{ row: 2, reason: "No goal name." }]);
  });

  it("refuses to guess when the goal name column is missing", () => {
    const plan = planWorkleapImport("Owner Email,Status\na@b.com,Done", context());
    expect(plan.missingColumns).toEqual(["title"]);
    expect(plan.goals).toEqual([]);
  });

  it("reports columns it did not understand", () => {
    const plan = planWorkleapImport("Goal,Sentiment\nA,happy", context());
    expect(plan.warnings.join(" ")).toContain("Sentiment");
  });

  it("stamps every goal with its source row for traceability", () => {
    const plan = planWorkleapImport(csv, context());
    expect(plan.goals[0].migratedFrom).toMatchObject({
      collection: "workleap",
      id: "row-2",
    });
  });
});

describe("resolveParents", () => {
  function imported(title: string, parentTitle?: string): ImportedGoal & { id: string } {
    return {
      id: `id-${title}`,
      title,
      parentTitle,
      level: parentTitle ? "individual" : "department",
      parentGoalId: null,
      planYear: 2026,
      measurement: { type: "simple", accumulation: "cumulative" },
      quarters: [],
    } as ImportedGoal & { id: string };
  }

  it("links children to parents by title", () => {
    const goals = [imported("Grow revenue"), imported("Close 20 deals", "Grow revenue")];
    const result = resolveParents(goals);
    expect(result.resolved).toBe(1);
    expect(goals[1].parentGoalId).toBe("id-Grow revenue");
  });

  it("matches titles case-insensitively", () => {
    const goals = [imported("Grow Revenue"), imported("Child", "grow revenue")];
    expect(resolveParents(goals).resolved).toBe(1);
  });

  it("reports children whose parent is not in the export", () => {
    const goals = [imported("Child", "Missing parent")];
    expect(resolveParents(goals).orphaned).toEqual(["Child"]);
  });

  it("refuses to make a goal its own parent", () => {
    const goals = [imported("Loop", "Loop")];
    expect(resolveParents(goals).orphaned).toEqual(["Loop"]);
    expect(goals[0].parentGoalId).toBeNull();
  });
});

describe("summarizeImport", () => {
  it("counts goals by level", () => {
    const plan = planWorkleapImport(
      [
        "Goal,Parent Goal",
        "Parent,",
        "Child,Parent",
      ].join("\n"),
      context()
    );
    const summary = summarizeImport(plan);
    expect(summary).toContain("2 goal(s)");
    expect(summary).toContain("department: 1");
    expect(summary).toContain("individual: 1");
  });
});
