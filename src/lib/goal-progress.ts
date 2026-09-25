import {
  QUARTERS,
  type Goal,
  type GoalQuarter,
  type GoalStatus,
  type Quarter,
} from "@/types";

export interface GoalProgress {
  percent: number;
  /** True only when the goal is fully met, used for the annual boolean rollup. */
  met: boolean;
  quartersComplete: number;
  quartersWithTargets: number;
  actualToDate: number | null;
  targetToDate: number | null;
  annualTarget: number | null;
  basis: "simple" | "quantitative";
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function sortQuarters(quarters: GoalQuarter[]): GoalQuarter[] {
  return [...quarters].sort(
    (a, b) => QUARTERS.indexOf(a.quarter) - QUARTERS.indexOf(b.quarter)
  );
}

/**
 * Spreads an annual target evenly across four quarters, pushing any rounding
 * remainder into Q4 so the quarters always sum back to the annual number.
 */
export function evenSplit(annualTarget: number | null | undefined): Record<Quarter, number | null> {
  if (annualTarget == null || !Number.isFinite(annualTarget)) {
    return { Q1: null, Q2: null, Q3: null, Q4: null };
  }
  const per = Math.round((annualTarget / 4) * 100) / 100;
  const remainder = Math.round((annualTarget - per * 3) * 100) / 100;
  return { Q1: per, Q2: per, Q3: per, Q4: remainder };
}

export function applyEvenSplit(goal: Goal): GoalQuarter[] {
  const split = evenSplit(goal.measurement?.annualTarget);
  return sortQuarters(goal.quarters ?? []).map((q) => ({
    ...q,
    target: split[q.quarter],
  }));
}

/**
 * Cumulative goals sum their quarters into the annual number. Point-in-time
 * goals take the latest reported quarter, because Q4 *is* the annual figure
 * rather than one quarter of it.
 */
export function rollUpQuarterValues(
  quarters: GoalQuarter[],
  accumulation: "cumulative" | "point_in_time",
  field: "target" | "actual"
): number | null {
  const ordered = sortQuarters(quarters);
  const values = ordered
    .map((q) => q[field])
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  if (values.length === 0) return null;

  if (accumulation === "point_in_time") {
    return values[values.length - 1];
  }
  return values.reduce((sum, v) => sum + v, 0);
}

export function calculateGoalProgress(goal: Goal): GoalProgress {
  const quarters = sortQuarters(goal.quarters ?? []);
  const measurement = goal.measurement ?? {
    type: "simple" as const,
    accumulation: "cumulative" as const,
  };

  const quartersComplete = quarters.filter((q) => q.complete).length;
  const quartersWithTargets = quarters.filter(
    (q) => typeof q.target === "number" && Number.isFinite(q.target)
  ).length;

  if (measurement.type === "quantitative" && quartersWithTargets > 0) {
    const actualToDate = rollUpQuarterValues(
      quarters,
      measurement.accumulation,
      "actual"
    );
    const targetToDate = rollUpQuarterValues(
      quarters,
      measurement.accumulation,
      "target"
    );

    const annualTarget =
      typeof measurement.annualTarget === "number"
        ? measurement.annualTarget
        : targetToDate;

    const denominator = annualTarget;
    const percent =
      denominator && denominator !== 0
        ? clampPercent(((actualToDate ?? 0) / denominator) * 100)
        : 0;

    return {
      percent,
      met: percent >= 100,
      quartersComplete,
      quartersWithTargets,
      actualToDate,
      targetToDate,
      annualTarget: annualTarget ?? null,
      basis: "quantitative",
    };
  }

  // Simple measurement: each of the four quarters is worth 25%.
  const percent = clampPercent((quartersComplete / QUARTERS.length) * 100);

  return {
    percent,
    met: quartersComplete === QUARTERS.length,
    quartersComplete,
    quartersWithTargets,
    actualToDate: null,
    targetToDate: null,
    annualTarget: measurement.annualTarget ?? null,
    basis: "simple",
  };
}

export interface AnnualRollup {
  /** Hard boolean: every child department goal met its target. */
  met: boolean;
  /** Soft percentage so a priority at 85% reads differently from one at 20%. */
  percent: number;
  childCount: number;
  childrenMet: number;
  childrenAtRisk: number;
}

/**
 * An annual priority is a boolean: it is met only when every department goal
 * beneath it is met. The averaged percentage is reported alongside it so
 * leadership gets early warning instead of a green light that flips red.
 */
export function calculateAnnualRollup(
  children: Goal[]
): AnnualRollup {
  if (children.length === 0) {
    return { met: false, percent: 0, childCount: 0, childrenMet: 0, childrenAtRisk: 0 };
  }

  const progresses = children.map(calculateGoalProgress);
  const childrenMet = progresses.filter((p) => p.met).length;
  const childrenAtRisk = children.filter((c) => c.status === "at_risk").length;
  const percent = clampPercent(
    progresses.reduce((sum, p) => sum + p.percent, 0) / progresses.length
  );

  return {
    met: childrenMet === children.length,
    percent,
    childCount: children.length,
    childrenMet,
    childrenAtRisk,
  };
}

export function deriveStatus(goal: Goal, progress?: GoalProgress): GoalStatus {
  if (goal.status === "at_risk") return "at_risk";

  const resolved = progress ?? calculateGoalProgress(goal);
  if (resolved.met) return "complete";
  if (resolved.percent > 0) return "in_progress";
  return "not_started";
}

export function currentQuarter(date = new Date()): Quarter {
  const month = date.getMonth();
  if (month <= 2) return "Q1";
  if (month <= 5) return "Q2";
  if (month <= 8) return "Q3";
  return "Q4";
}

export function formatMeasurementValue(
  value: number | null | undefined,
  unit?: string
): string {
  if (value == null || !Number.isFinite(value)) return "\u2014";
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value);
  if (!unit) return formatted;
  return unit === "$" || unit === "%" ? `${unit === "$" ? "$" : ""}${formatted}${unit === "%" ? "%" : ""}` : `${formatted} ${unit}`;
}
