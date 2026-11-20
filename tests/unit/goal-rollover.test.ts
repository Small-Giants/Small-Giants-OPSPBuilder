import { describe, expect, it } from "vitest";
import { planGoalRollover } from "@/lib/goal-rollover";
import { defaultMeasurement, emptyQuarters, type Goal } from "@/types";

function goal(overrides: Partial<Goal> & Pick<Goal, "id" | "level">): Goal {
  return {
    title: overrides.id,
    planYear: 2026,
    measurement: defaultMeasurement(),
    quarters: emptyQuarters().map((q) => ({ ...q, complete: true })),
    status: "in_progress",
    ownerId: "owner",
    contributorIds: [],
    ...overrides,
  };
}

const goals: Goal[] = [
  goal({ id: "ind-open", level: "individual", parentGoalId: "team-open", teamId: "ops" }),
  goal({ id: "team-done", level: "team", parentGoalId: "init", status: "complete" }),
  goal({
    id: "team-open",
    level: "team",
    parentGoalId: "init",
    teamId: "ops",
    clickup: {
      taskId: "abc",
      url: "https://app.clickup.com/t/abc",
      listId: "l1",
      appliedRecapIds: ["c1"],
      recap: null,
    },
  }),
  goal({ id: "ind-orphan", level: "individual", parentGoalId: "team-done" }),
  goal({ id: "init", level: "initiative", statement: "Grow" }),
];

describe("planGoalRollover", () => {
  it("orders parents first and carries only unfinished team and individual goals", () => {
    const plan = planGoalRollover(goals, 2027, "co", { initiatives: true, unfinishedGoals: true });
    expect(plan.map((item) => item.sourceId)).toEqual(["init", "team-open", "ind-open", "ind-orphan"]);
  });

  it("re-parents onto carried goals and unlinks from goals left behind", () => {
    const plan = planGoalRollover(goals, 2027, "co", { initiatives: true, unfinishedGoals: true });
    const parents = Object.fromEntries(plan.map((item) => [item.sourceId, item.parentSourceId]));
    expect(parents).toEqual({
      init: null,
      "team-open": "init",
      "ind-open": "team-open",
      "ind-orphan": null,
    });
  });

  it("keeps the ClickUp task link but not its sync history, and starts quarters fresh", () => {
    const plan = planGoalRollover(goals, 2027, "co", { initiatives: true, unfinishedGoals: true });
    const team = plan.find((item) => item.sourceId === "team-open")!.draft;
    expect(team.clickup).toEqual({ taskId: "abc", url: "https://app.clickup.com/t/abc", listId: "l1" });
    expect(team.planYear).toBe(2027);
    expect(team.teamId).toBe("ops");
    expect(team.status).toBe("in_progress");
    expect(team.quarters.every((q) => !q.complete)).toBe(true);
    expect(team.rolledOverFrom).toEqual({ goalId: "team-open", planYear: 2026 });
  });

  it("leaves team goals unlinked when initiatives are not carried", () => {
    const plan = planGoalRollover(goals, 2027, "co", { initiatives: false, unfinishedGoals: true });
    expect(plan.find((item) => item.sourceId === "team-open")?.parentSourceId).toBeNull();
    expect(plan.some((item) => item.sourceId === "init")).toBe(false);
  });

  it("copies only initiatives when unfinished goals are not carried", () => {
    const plan = planGoalRollover(goals, 2027, "co", { initiatives: true, unfinishedGoals: false });
    expect(plan.map((item) => item.sourceId)).toEqual(["init"]);
    expect(plan[0].draft.statement).toBe("Grow");
  });
});
