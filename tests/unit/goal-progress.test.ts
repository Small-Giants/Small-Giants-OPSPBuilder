import { describe, expect, it } from "vitest";
import {
  calculateAnnualRollup,
  calculateGoalProgress,
  deriveStatus,
  evenSplit,
  rollUpQuarterValues,
} from "@/lib/goal-progress";
import { emptyQuarters, type Goal, type GoalQuarter } from "@/types";

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: "g1",
    title: "Test goal",
    level: "department",
    planYear: 2026,
    measurement: {
      type: "simple",
      accumulation: "cumulative",
      annualTarget: null,
      unit: "",
    },
    quarters: emptyQuarters(),
    ...overrides,
  };
}

function quarters(
  values: Array<Partial<GoalQuarter>>
): GoalQuarter[] {
  return emptyQuarters().map((q, i) => ({ ...q, ...(values[i] ?? {}) }));
}

describe("evenSplit", () => {
  it("splits a clean number into four equal quarters", () => {
    expect(evenSplit(10000)).toEqual({
      Q1: 2500,
      Q2: 2500,
      Q3: 2500,
      Q4: 2500,
    });
  });

  it("pushes the rounding remainder into Q4 so quarters sum to the annual target", () => {
    const split = evenSplit(10);
    const total = split.Q1! + split.Q2! + split.Q3! + split.Q4!;
    expect(total).toBeCloseTo(10, 5);
  });

  it("returns nulls when there is no annual target", () => {
    expect(evenSplit(null)).toEqual({ Q1: null, Q2: null, Q3: null, Q4: null });
  });
});

describe("rollUpQuarterValues", () => {
  it("sums cumulative targets", () => {
    const q = quarters([
      { target: 2 },
      { target: 2 },
      { target: 4 },
      { target: 2 },
    ]);
    expect(rollUpQuarterValues(q, "cumulative", "target")).toBe(10);
  });

  it("takes the latest reported quarter for point-in-time targets", () => {
    const q = quarters([
      { target: 30 },
      { target: 40 },
      { target: 45 },
      { target: 50 },
    ]);
    expect(rollUpQuarterValues(q, "point_in_time", "target")).toBe(50);
  });

  it("ignores unreported quarters when taking a point-in-time value", () => {
    const q = quarters([{ actual: 30 }, { actual: 42 }]);
    expect(rollUpQuarterValues(q, "point_in_time", "actual")).toBe(42);
  });

  it("returns null when nothing has been reported", () => {
    expect(rollUpQuarterValues(emptyQuarters(), "cumulative", "actual")).toBeNull();
  });
});

describe("calculateGoalProgress - simple measurement", () => {
  it("scores each completed quarter as 25 percent", () => {
    const goal = makeGoal({
      quarters: quarters([{ complete: true }, { complete: true }]),
    });
    const progress = calculateGoalProgress(goal);
    expect(progress.percent).toBe(50);
    expect(progress.quartersComplete).toBe(2);
    expect(progress.met).toBe(false);
    expect(progress.basis).toBe("simple");
  });

  it("is met only when all four quarters are complete", () => {
    const goal = makeGoal({
      quarters: quarters([
        { complete: true },
        { complete: true },
        { complete: true },
        { complete: true },
      ]),
    });
    const progress = calculateGoalProgress(goal);
    expect(progress.percent).toBe(100);
    expect(progress.met).toBe(true);
  });

  it("reports zero for an untouched goal", () => {
    expect(calculateGoalProgress(makeGoal()).percent).toBe(0);
  });
});

describe("calculateGoalProgress - quantitative measurement", () => {
  it("measures cumulative actuals against the annual target", () => {
    const goal = makeGoal({
      measurement: {
        type: "quantitative",
        accumulation: "cumulative",
        annualTarget: 10,
        unit: "$M",
      },
      quarters: quarters([
        { target: 2, actual: 2 },
        { target: 2, actual: 3 },
        { target: 4, actual: null },
        { target: 2, actual: null },
      ]),
    });

    const progress = calculateGoalProgress(goal);
    expect(progress.actualToDate).toBe(5);
    expect(progress.targetToDate).toBe(10);
    expect(progress.percent).toBe(50);
    expect(progress.basis).toBe("quantitative");
  });

  it("handles the uneven quarterly weighting from the scope example", () => {
    // 2m in Q1, Q2 and Q4, but 4m in Q3, for an annual total of 10m.
    const goal = makeGoal({
      measurement: {
        type: "quantitative",
        accumulation: "cumulative",
        annualTarget: 10,
        unit: "$M",
      },
      quarters: quarters([
        { target: 2, actual: 2 },
        { target: 2, actual: 2 },
        { target: 4, actual: 4 },
        { target: 2, actual: 2 },
      ]),
    });

    const progress = calculateGoalProgress(goal);
    expect(progress.targetToDate).toBe(10);
    expect(progress.percent).toBe(100);
    expect(progress.met).toBe(true);
  });

  it("does not sum point-in-time actuals", () => {
    const goal = makeGoal({
      measurement: {
        type: "quantitative",
        accumulation: "point_in_time",
        annualTarget: 50,
        unit: "NPS",
      },
      quarters: quarters([
        { target: 35, actual: 30 },
        { target: 40, actual: 42 },
      ]),
    });

    const progress = calculateGoalProgress(goal);
    // Latest reported actual is 42, not 30 + 42.
    expect(progress.actualToDate).toBe(42);
    expect(progress.percent).toBe(84);
  });

  it("caps progress at 100 percent when a goal is overachieved", () => {
    const goal = makeGoal({
      measurement: {
        type: "quantitative",
        accumulation: "cumulative",
        annualTarget: 10,
        unit: "",
      },
      quarters: quarters([{ target: 10, actual: 25 }]),
    });
    expect(calculateGoalProgress(goal).percent).toBe(100);
  });

  it("falls back to simple scoring when no quarterly targets are set", () => {
    const goal = makeGoal({
      measurement: {
        type: "quantitative",
        accumulation: "cumulative",
        annualTarget: null,
        unit: "",
      },
      quarters: quarters([{ complete: true }]),
    });
    const progress = calculateGoalProgress(goal);
    expect(progress.basis).toBe("simple");
    expect(progress.percent).toBe(25);
  });
});

describe("calculateAnnualRollup", () => {
  const met = () =>
    makeGoal({
      quarters: quarters([
        { complete: true },
        { complete: true },
        { complete: true },
        { complete: true },
      ]),
    });

  const partial = (completeCount: number) =>
    makeGoal({
      quarters: quarters(
        Array.from({ length: 4 }, (_, i) => ({ complete: i < completeCount }))
      ),
    });

  it("is met only when every department goal is met", () => {
    const rollup = calculateAnnualRollup([met(), met()]);
    expect(rollup.met).toBe(true);
    expect(rollup.percent).toBe(100);
    expect(rollup.childrenMet).toBe(2);
  });

  it("fails the boolean when a single child falls short", () => {
    const rollup = calculateAnnualRollup([met(), partial(3)]);
    expect(rollup.met).toBe(false);
    expect(rollup.childrenMet).toBe(1);
  });

  it("still reports a high percentage for a near miss, as early warning", () => {
    const rollup = calculateAnnualRollup([met(), partial(3)]);
    expect(rollup.percent).toBe(88);
  });

  it("distinguishes a near miss from a badly missed priority", () => {
    const nearMiss = calculateAnnualRollup([met(), partial(3)]);
    const badMiss = calculateAnnualRollup([partial(1), partial(0)]);
    expect(nearMiss.met).toBe(false);
    expect(badMiss.met).toBe(false);
    expect(nearMiss.percent).toBeGreaterThan(badMiss.percent);
  });

  it("reports zero and not-met for a priority with no children", () => {
    const rollup = calculateAnnualRollup([]);
    expect(rollup.met).toBe(false);
    expect(rollup.percent).toBe(0);
    expect(rollup.childCount).toBe(0);
  });
});

describe("deriveStatus", () => {
  it("keeps an explicit at-risk flag", () => {
    const goal = makeGoal({
      status: "at_risk",
      quarters: quarters([{ complete: true }]),
    });
    expect(deriveStatus(goal)).toBe("at_risk");
  });

  it("reports complete when fully met", () => {
    const goal = makeGoal({
      quarters: quarters([
        { complete: true },
        { complete: true },
        { complete: true },
        { complete: true },
      ]),
    });
    expect(deriveStatus(goal)).toBe("complete");
  });

  it("reports in progress once any quarter lands", () => {
    const goal = makeGoal({ quarters: quarters([{ complete: true }]) });
    expect(deriveStatus(goal)).toBe("in_progress");
  });

  it("reports not started for an empty goal", () => {
    expect(deriveStatus(makeGoal())).toBe("not_started");
  });
});
