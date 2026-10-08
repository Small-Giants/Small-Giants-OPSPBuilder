import { describe, expect, it } from "vitest";
import {
  planMigration,
  quartersFromRocks,
  summarizePlan,
  type LegacyPriority,
  type LegacyRock,
} from "@/lib/goal-migration";

const BASE = {
  companyId: "default-company",
  planYears: [2026],
  legacyPlanYear: 2025,
};

function run(
  priorities: LegacyPriority[],
  rocks: LegacyRock[],
  extra: Partial<Parameters<typeof planMigration>[0]> = {}
) {
  return planMigration({ ...BASE, priorities, rocks, ...extra });
}

describe("quartersFromRocks", () => {
  it("marks a quarter complete only when every rock in it is complete", () => {
    const result = quartersFromRocks([
      { id: "r1", quarter: "Q1", status: "complete" },
      { id: "r2", quarter: "Q1", status: "in_progress" },
      { id: "r3", quarter: "Q2", status: "complete" },
    ]);

    expect(result.find((q) => q.quarter === "Q1")?.complete).toBe(false);
    expect(result.find((q) => q.quarter === "Q2")?.complete).toBe(true);
    expect(result.find((q) => q.quarter === "Q3")?.complete).toBe(false);
  });

  it("treats the legacy backlog status as not complete", () => {
    const result = quartersFromRocks([
      { id: "r1", quarter: "Q1", status: "backlog" },
    ]);
    expect(result.find((q) => q.quarter === "Q1")?.complete).toBe(false);
  });

  it("returns four empty quarters when there are no rocks", () => {
    const result = quartersFromRocks([]);
    expect(result).toHaveLength(4);
    expect(result.every((q) => !q.complete)).toBe(true);
  });
});

describe("planMigration", () => {
  it("converts an annual priority into a layer 1 goal", () => {
    const plan = run(
      [{ id: "p1", title: "Grow revenue", type: "priority", planYear: 2026 }],
      []
    );

    expect(plan.goals).toHaveLength(1);
    expect(plan.goals[0].draft.level).toBe("annual");
    expect(plan.goals[0].draft.title).toBe("Grow revenue");
    expect(plan.goals[0].draft.planYear).toBe(2026);
    expect(plan.goals[0].draft.migratedFrom?.id).toBe("p1");
  });

  it("leaves capabilities in place rather than converting them", () => {
    const plan = run(
      [{ id: "c1", title: "Build a CRM", type: "capability", planYear: 2026 }],
      []
    );

    expect(plan.goals).toHaveLength(0);
    expect(plan.skipped[0].reason).toContain("Capability");
  });

  it("treats legacy records with no plan year as belonging to 2025", () => {
    const plan = run(
      [{ id: "p1", title: "Legacy priority", type: "priority" }],
      [],
      { planYears: [2025] }
    );
    expect(plan.goals).toHaveLength(1);
  });

  it("converts both plan years in a single run", () => {
    const plan = run(
      [
        { id: "p1", title: "This year", type: "priority", planYear: 2025 },
        { id: "p2", title: "Next year", type: "priority", planYear: 2026 },
      ],
      [],
      { planYears: [2025, 2026] }
    );

    expect(plan.goals.map((g) => g.draft.planYear).sort()).toEqual([2025, 2026]);
  });

  it("skips records from a different plan year", () => {
    const plan = run(
      [{ id: "p1", title: "Old priority", type: "priority", planYear: 2024 }],
      []
    );
    expect(plan.goals).toHaveLength(0);
    expect(plan.skipped[0].reason).toContain("2024");
  });

  it("repoints a rock onto the goal its priority became, without making it a goal", () => {
    const plan = run(
      [{ id: "p1", title: "Grow revenue", type: "priority", planYear: 2026 }],
      [
        {
          id: "r1",
          text: "Land three enterprise deals",
          quarter: "Q2",
          year: 2026,
          priorityId: "p1",
          status: "in_progress",
        },
      ]
    );

    expect(plan.goals).toHaveLength(1);
    expect(plan.goals[0].draft.level).toBe("annual");
    expect(plan.rockUpdates).toEqual([
      {
        rockId: "r1",
        goalKey: "priority:p1",
        ownerId: "",
        ownerName: "",
        contributorIds: [],
      },
    ]);
  });

  it("makes the old single assignee both accountable and responsible", () => {
    const plan = run(
      [{ id: "p1", title: "Grow revenue", type: "priority", planYear: 2026 }],
      [
        {
          id: "r1",
          text: "Ship onboarding",
          quarter: "Q1",
          year: 2026,
          priorityId: "p1",
          assigneeId: "uid-alice",
          assigneeName: "Alice",
        },
      ]
    );

    expect(plan.rockUpdates[0]).toMatchObject({
      ownerId: "uid-alice",
      ownerName: "Alice",
      contributorIds: ["uid-alice"],
    });
  });

  it("leaves a capability's rocks alone", () => {
    const plan = run(
      [{ id: "c1", title: "Build a CRM", type: "capability", planYear: 2026 }],
      [{ id: "r1", text: "Pick a vendor", quarter: "Q1", year: 2026, priorityId: "c1" }]
    );

    expect(plan.rockUpdates).toHaveLength(0);
    expect(
      plan.skipped.some(
        (s) => s.collection === "rocks" && s.reason.includes("capability")
      )
    ).toBe(true);
  });

  it("leaves a rock with no priority link as a standalone rock", () => {
    const plan = run(
      [],
      [{ id: "r1", text: "Ship it", quarter: "Q1", year: 2026 }]
    );

    expect(plan.rockUpdates).toHaveLength(0);
    expect(plan.skipped[0].reason).toContain("standalone");
  });

  it("resolves a free-text priority owner to a user id when one matches", () => {
    const plan = run(
      [{ id: "p1", title: "Grow", type: "priority", planYear: 2026, owner: "Alice" }],
      [],
      { userIdByName: { Alice: "uid-alice" } }
    );

    expect(plan.goals[0].draft.ownerId).toBe("uid-alice");
    expect(plan.goals[0].draft.ownerName).toBe("Alice");
  });

  it("warns instead of guessing when an owner name matches no account", () => {
    const plan = run(
      [{ id: "p1", title: "Grow", type: "priority", planYear: 2026, owner: "Ghost" }],
      []
    );

    expect(plan.goals[0].draft.ownerId).toBe("");
    expect(plan.warnings.some((w) => w.includes("Ghost"))).toBe(true);
  });

  it("warns when a rock points at a priority that was not migrated", () => {
    const plan = run(
      [],
      [
        {
          id: "r1",
          text: "Orphaned rock",
          quarter: "Q1",
          year: 2026,
          priorityId: "missing",
        },
      ]
    );

    expect(plan.rockUpdates).toHaveLength(0);
    expect(plan.warnings.some((w) => w.includes("missing"))).toBe(true);
  });

  it("always warns that the department layer has to be built by hand", () => {
    const plan = run(
      [{ id: "p1", title: "Grow", type: "priority", planYear: 2026 }],
      []
    );
    expect(plan.warnings.some((w) => w.includes("department"))).toBe(true);
  });

  it("derives annual quarter completion from the priority's rocks", () => {
    const plan = run(
      [{ id: "p1", title: "Grow", type: "priority", planYear: 2026 }],
      [
        { id: "r1", text: "A", quarter: "Q1", year: 2026, priorityId: "p1", status: "complete" },
        { id: "r2", text: "B", quarter: "Q2", year: 2026, priorityId: "p1", status: "ready" },
      ]
    );

    const annual = plan.goals.find((g) => g.draft.level === "annual");
    expect(annual?.draft.quarters.find((q) => q.quarter === "Q1")?.complete).toBe(true);
    expect(annual?.draft.quarters.find((q) => q.quarter === "Q2")?.complete).toBe(false);
  });

  it("produces a summary that matches the plan contents", () => {
    const plan = run(
      [
        { id: "p1", title: "Grow", type: "priority", planYear: 2026 },
        { id: "p2", title: "Cap", type: "capability", planYear: 2026 },
      ],
      [{ id: "r1", text: "Do a thing", quarter: "Q1", year: 2026, priorityId: "p1" }]
    );

    const summary = summarizePlan(plan);
    expect(summary.annual).toBe(1);
    expect(summary.individual).toBe(0);
    expect(summary.total).toBe(1);
    expect(summary.rocksRepointed).toBe(1);
    expect(summary.skipped).toBe(1);
  });

  it("records provenance on every migrated goal so a rollback can find them", () => {
    const plan = run(
      [{ id: "p1", title: "Grow", type: "priority", planYear: 2026 }],
      [{ id: "r1", text: "Do a thing", quarter: "Q1", year: 2026, priorityId: "p1" }]
    );

    expect(
      plan.goals.every((g) => Boolean(g.draft.migratedFrom?.id))
    ).toBe(true);
  });
});
