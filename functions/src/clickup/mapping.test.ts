import { describe, expect, it } from "vitest";
import type { ClickUpTask } from "./client";
import {
  DEFAULT_MAPPING,
  isTaskComplete,
  mapSubtasksToRocks,
  mapTaskToQuarters,
  mergeQuarters,
  mergeRock,
  quarterForTask,
  quarterFromDueDate,
  readFieldNumber,
  type ClickUpMappingConfig,
} from "./mapping";
import type { Goal, GoalQuarter, Rock } from "../types";

const config: ClickUpMappingConfig = { ...DEFAULT_MAPPING, enabled: true };
const STAMP = "2026-01-01T00:00:00.000Z";

function task(overrides: Partial<ClickUpTask> = {}): ClickUpTask {
  return { id: "t1", name: "Task", ...overrides };
}

function quarterField(value: string) {
  return { id: "f-q", name: "Quarter", type: "short_text", value };
}

function actualField(value: string | number) {
  return { id: "f-a", name: "Actual", type: "number", value };
}

function simpleGoal(quarters: GoalQuarter[] = []): Pick<Goal, "measurement" | "quarters"> {
  return { measurement: { type: "simple" }, quarters };
}

function quantitativeGoal(
  quarters: GoalQuarter[] = []
): Pick<Goal, "measurement" | "quarters"> {
  return {
    measurement: { type: "quantitative", annualTarget: 10, accumulation: "cumulative" },
    quarters,
  };
}

describe("isTaskComplete", () => {
  it("trusts ClickUp's own closed flag regardless of the column name", () => {
    expect(isTaskComplete(task({ status: { status: "shipped", type: "closed" } }), config)).toBe(true);
  });

  it("falls back to the configured status names", () => {
    expect(isTaskComplete(task({ status: { status: "Done", type: "custom" } }), config)).toBe(true);
    expect(isTaskComplete(task({ status: { status: "in progress", type: "custom" } }), config)).toBe(false);
  });

  it("treats a task with no status as not complete", () => {
    expect(isTaskComplete(task(), config)).toBe(false);
  });
});

describe("readFieldNumber", () => {
  it("strips currency formatting", () => {
    expect(readFieldNumber(actualField("$2,000,000"))).toBe(2000000);
  });

  it("returns null for non-numeric values", () => {
    expect(readFieldNumber(actualField("not a number"))).toBeNull();
    expect(readFieldNumber(undefined)).toBeNull();
  });

  it("resolves dropdown values by option index", () => {
    const field = {
      id: "f",
      name: "Actual",
      type: "drop_down",
      value: 1,
      type_config: { options: [{ id: "a", name: "5" }, { id: "b", name: "9" }] },
    };
    expect(readFieldNumber(field)).toBe(9);
  });
});

describe("quarterFromDueDate", () => {
  it("maps epoch milliseconds to a calendar quarter", () => {
    expect(quarterFromDueDate(String(Date.UTC(2026, 1, 15)))).toBe("Q1");
    expect(quarterFromDueDate(String(Date.UTC(2026, 7, 15)))).toBe("Q3");
  });

  it("returns null when there is no usable date", () => {
    expect(quarterFromDueDate(null)).toBeNull();
    expect(quarterFromDueDate("nonsense")).toBeNull();
  });
});

describe("quarterForTask", () => {
  it("prefers the explicit field over the due date", () => {
    const subject = task({
      custom_fields: [quarterField("Q4")],
      due_date: String(Date.UTC(2026, 0, 5)),
    });
    expect(quarterForTask(subject, config)).toBe("Q4");
  });

  it("tolerates messy field values like 'q2 2026'", () => {
    expect(quarterForTask(task({ custom_fields: [quarterField("q2 2026")] }), config)).toBe("Q2");
  });
});

describe("mapTaskToQuarters", () => {
  it("marks a simple quarter complete only when every subtask is closed", () => {
    const subject = task({
      subtasks: [
        task({ id: "s1", custom_fields: [quarterField("Q1")], status: { status: "complete" } }),
        task({ id: "s2", custom_fields: [quarterField("Q1")], status: { status: "in progress" } }),
        task({ id: "s3", custom_fields: [quarterField("Q2")], status: { status: "complete" } }),
      ],
    });

    const { quarters } = mapTaskToQuarters(subject, simpleGoal(), config);
    expect(quarters.find((q) => q.quarter === "Q1")?.complete).toBe(false);
    expect(quarters.find((q) => q.quarter === "Q2")?.complete).toBe(true);
  });

  it("sums the numeric field per quarter for quantitative goals", () => {
    const subject = task({
      subtasks: [
        task({ id: "s1", custom_fields: [quarterField("Q1"), actualField(1_200_000)] }),
        task({ id: "s2", custom_fields: [quarterField("Q1"), actualField(800_000)] }),
        task({ id: "s3", custom_fields: [quarterField("Q3"), actualField(4_000_000)] }),
      ],
    });

    const { quarters } = mapTaskToQuarters(subject, quantitativeGoal(), config);
    expect(quarters.find((q) => q.quarter === "Q1")?.actual).toBe(2_000_000);
    expect(quarters.find((q) => q.quarter === "Q3")?.actual).toBe(4_000_000);
  });

  it("leaves quarters with no ClickUp data out of the result", () => {
    const subject = task({
      subtasks: [task({ id: "s1", custom_fields: [quarterField("Q2")] })],
    });

    const { quarters } = mapTaskToQuarters(subject, simpleGoal(), config);
    expect(quarters.map((q) => q.quarter)).toEqual(["Q2"]);
  });

  it("reports subtasks that could not be placed in a quarter", () => {
    const subject = task({
      subtasks: [task({ id: "s1", name: "Orphan" }), task({ id: "s2", custom_fields: [quarterField("Q1")] })],
    });

    const { unplacedSubtasks } = mapTaskToQuarters(subject, simpleGoal(), config);
    expect(unplacedSubtasks).toEqual(["Orphan"]);
  });

  it("uses the parent task when it has no subtasks", () => {
    const subject = task({
      custom_fields: [quarterField("Q4"), actualField(500)],
      status: { status: "complete" },
    });

    const { quarters } = mapTaskToQuarters(subject, quantitativeGoal(), config);
    expect(quarters).toHaveLength(1);
    expect(quarters[0]).toMatchObject({ quarter: "Q4", actual: 500, complete: true });
  });

  it("does not read numbers for simple goals", () => {
    const subject = task({
      subtasks: [task({ id: "s1", custom_fields: [quarterField("Q1"), actualField(99)] })],
    });

    const { quarters } = mapTaskToQuarters(subject, simpleGoal(), config);
    expect(quarters[0].actual).toBeNull();
  });
});

describe("mapSubtasksToRocks", () => {
  it("turns each placed subtask into a rock carrying its ClickUp id", () => {
    const subject = task({
      subtasks: [
        task({ id: "s1", name: "Land three deals", custom_fields: [quarterField("Q2")] }),
        task({
          id: "s2",
          name: "Ship onboarding",
          custom_fields: [quarterField("Q3")],
          status: { status: "complete" },
        }),
      ],
    });

    const { rocks } = mapSubtasksToRocks(subject, config);
    expect(rocks).toEqual([
      { taskId: "s1", text: "Land three deals", quarter: "Q2", status: "in_progress", url: undefined },
      { taskId: "s2", text: "Ship onboarding", quarter: "Q3", status: "complete", url: undefined },
    ]);
  });

  it("reports subtasks with no quarter and no due date instead of guessing", () => {
    const subject = task({ subtasks: [task({ id: "s1", name: "Unscheduled" })] });

    const { rocks, unplacedSubtasks } = mapSubtasksToRocks(subject, config);
    expect(rocks).toHaveLength(0);
    expect(unplacedSubtasks).toEqual(["Unscheduled"]);
  });

  it("places a subtask by due date when no quarter field is set", () => {
    const subject = task({
      subtasks: [task({ id: "s1", name: "Dated", due_date: String(Date.UTC(2026, 7, 15)) })],
    });
    expect(mapSubtasksToRocks(subject, config).rocks[0].quarter).toBe("Q3");
  });

  it("returns nothing for a task with no subtasks", () => {
    expect(mapSubtasksToRocks(task(), config).rocks).toEqual([]);
  });
});

describe("mergeRock", () => {
  const mapped = {
    taskId: "s1",
    text: "Land three deals",
    quarter: "Q2" as const,
    status: "in_progress" as const,
  };

  function rock(overrides: Partial<Rock> = {}): Rock {
    return {
      id: "r1",
      text: "Land three deals",
      status: "in_progress",
      quarter: "Q2",
      ...overrides,
    };
  }

  it("reports no change when ClickUp agrees with what is stored", () => {
    const { changes, changed } = mergeRock(rock(), mapped, STAMP);
    expect(changed).toBe(false);
    expect(changes).toEqual({});
  });

  it("renames a rock when its subtask was renamed, rather than duplicating it", () => {
    const { changes, changed } = mergeRock(
      rock({ text: "Old name" }),
      mapped,
      STAMP
    );
    expect(changed).toBe(true);
    expect(changes.text).toBe("Land three deals");
  });

  it("moves a rock to the quarter ClickUp reports", () => {
    const { changes } = mergeRock(rock({ quarter: "Q4" }), mapped, STAMP);
    expect(changes.quarter).toBe("Q2");
  });

  it("leaves RACI and description alone so app edits survive a sync", () => {
    const { changes } = mergeRock(
      rock({ text: "Old", description: "Written in the app", ownerId: "u1", contributorIds: ["u2"] }),
      mapped,
      STAMP
    );
    expect(changes).not.toHaveProperty("description");
    expect(changes).not.toHaveProperty("ownerId");
    expect(changes).not.toHaveProperty("contributorIds");
  });

  it("treats a missing rock as fully changed so it gets created", () => {
    const { changed, changes } = mergeRock(undefined, mapped, STAMP);
    expect(changed).toBe(true);
    expect(changes).toMatchObject({ text: "Land three deals", quarter: "Q2", updatedBy: "clickup" });
  });
});

describe("mergeQuarters", () => {
  const existing: GoalQuarter[] = [
    { quarter: "Q1", target: 2_000_000, actual: null, complete: false },
    { quarter: "Q2", target: 2_000_000, actual: null, complete: false },
    { quarter: "Q3", target: 4_000_000, actual: null, complete: false },
    { quarter: "Q4", target: 2_000_000, actual: null, complete: false },
  ];

  it("never overwrites the planned targets", () => {
    const { quarters } = mergeQuarters(
      existing,
      [{ quarter: "Q1", actual: 1_000_000, complete: false, subtaskCount: 1, subtasksComplete: 0 }],
      "2026-01-01T00:00:00.000Z"
    );
    expect(quarters.map((q) => q.target)).toEqual([2_000_000, 2_000_000, 4_000_000, 2_000_000]);
  });

  it("always returns all four quarters", () => {
    const { quarters } = mergeQuarters([], [], "2026-01-01T00:00:00.000Z");
    expect(quarters.map((q) => q.quarter)).toEqual(["Q1", "Q2", "Q3", "Q4"]);
  });

  it("reports no change when ClickUp agrees with what is already stored", () => {
    const current: GoalQuarter[] = [
      { quarter: "Q1", target: 100, actual: 50, complete: false },
    ];
    const { changed } = mergeQuarters(
      current,
      [{ quarter: "Q1", actual: 50, complete: false, subtaskCount: 1, subtasksComplete: 0 }],
      "2026-01-01T00:00:00.000Z"
    );
    expect(changed).toBe(false);
  });

  it("keeps a hand-entered actual when ClickUp has nothing to say", () => {
    const current: GoalQuarter[] = [
      { quarter: "Q1", target: 100, actual: 75, complete: false },
    ];
    const { quarters } = mergeQuarters(
      current,
      [{ quarter: "Q1", actual: null, complete: true, subtaskCount: 1, subtasksComplete: 1 }],
      "2026-01-01T00:00:00.000Z"
    );
    expect(quarters[0].actual).toBe(75);
    expect(quarters[0].complete).toBe(true);
  });

  it("stamps clickup as the author of a synced change", () => {
    const { quarters } = mergeQuarters(
      existing,
      [{ quarter: "Q2", actual: 10, complete: true, subtaskCount: 1, subtasksComplete: 1 }],
      "2026-04-01T00:00:00.000Z"
    );
    const q2 = quarters.find((q) => q.quarter === "Q2");
    expect(q2?.updatedBy).toBe("clickup");
    expect(q2?.updatedAt).toBe("2026-04-01T00:00:00.000Z");
  });
});
