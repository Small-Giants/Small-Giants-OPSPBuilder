import { QUARTERS, type Quarter } from "./common";

export type GoalLevel = "annual" | "department" | "individual";

export const GOAL_LEVELS: GoalLevel[] = ["annual", "department", "individual"];

export const GOAL_LEVEL_LABELS: Record<GoalLevel, string> = {
  annual: "Annual Priority",
  department: "Department Goal",
  individual: "Individual Goal",
};

/** Layer 1 is owned by the company, layer 2 by a department, layer 3 by a person. */
export const GOAL_LEVEL_PARENT: Record<GoalLevel, GoalLevel | null> = {
  annual: null,
  department: "annual",
  individual: "department",
};

export type GoalStatus = "not_started" | "in_progress" | "at_risk" | "complete";

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  at_risk: "At Risk",
  complete: "Complete",
};

export const GOAL_STATUS_COLORS: Record<GoalStatus, string> = {
  not_started: "bg-gray-500",
  in_progress: "bg-blue-500",
  at_risk: "bg-amber-500",
  complete: "bg-green-500",
};

/**
 * "simple" scores each completed quarter as 25%. "quantitative" scores actuals
 * against per-quarter numeric targets.
 */
export type MeasurementType = "simple" | "quantitative";

/**
 * Revenue-style targets sum across the year. NPS-, headcount-, and margin-style
 * targets are point-in-time, where the last reported quarter is the annual
 * number rather than the sum of the four.
 */
export type TargetAccumulation = "cumulative" | "point_in_time";

export const SMART_FIELDS = [
  "specific",
  "measurable",
  "achievable",
  "relevant",
  "timeBound",
] as const;

export type SmartField = (typeof SMART_FIELDS)[number];

export const SMART_FIELD_LABELS: Record<SmartField, string> = {
  specific: "Specific",
  measurable: "Measurable",
  achievable: "Achievable",
  relevant: "Relevant",
  timeBound: "Time-bound",
};

export const SMART_FIELD_PROMPTS: Record<SmartField, string> = {
  specific: "What exactly will be accomplished?",
  measurable: "How will we know it is done?",
  achievable: "What makes this realistic with the resources we have?",
  relevant: "Why does this matter to the business right now?",
  timeBound: "By when, and what are the checkpoints?",
};

/** Per field, not per goal. Change here to adjust every SMART input at once. */
export const SMART_CHAR_LIMIT = 100;

export type SmartDescription = Record<SmartField, string>;

export function emptySmartDescription(): SmartDescription {
  return {
    specific: "",
    measurable: "",
    achievable: "",
    relevant: "",
    timeBound: "",
  };
}

export function smartToDescription(smart?: Partial<SmartDescription>): string {
  if (!smart) return "";
  return SMART_FIELDS.map((field) => smart[field]?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

export function isSmartComplete(smart?: Partial<SmartDescription>): boolean {
  if (!smart) return false;
  return SMART_FIELDS.every((field) => Boolean(smart[field]?.trim()));
}

export interface GoalQuarter {
  quarter: Quarter;
  /** Null means "no numeric target set for this quarter". */
  target: number | null;
  actual: number | null;
  complete: boolean;
  note?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export function emptyQuarters(): GoalQuarter[] {
  return QUARTERS.map((quarter) => ({
    quarter,
    target: null,
    actual: null,
    complete: false,
  }));
}

export interface GoalMeasurement {
  type: MeasurementType;
  unit?: string;
  annualTarget?: number | null;
  accumulation: TargetAccumulation;
}

export function defaultMeasurement(): GoalMeasurement {
  return { type: "simple", unit: "", annualTarget: null, accumulation: "cumulative" };
}

/** Written by the syncClickUp function; see functions/src/clickup/sync.ts. */
export interface GoalClickUpLink {
  taskId?: string;
  listId?: string;
  url?: string;
  lastSyncedAt?: string;
  /** Set when the last attempt failed, cleared on the next success. */
  lastSyncError?: string | null;
}

/**
 * ClickUp task URLs look like https://app.clickup.com/t/86abc1234, sometimes
 * with a team segment in front. The last path segment is the id.
 */
export function parseClickUpTaskId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!trimmed.includes("/")) return trimmed;

  try {
    const segments = new URL(trimmed).pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? null;
  } catch {
    return null;
  }
}

export interface Goal {
  id: string;
  title: string;
  /** Flattened from `smart` on save so existing list views can read one string. */
  description?: string;
  smart?: SmartDescription;
  level: GoalLevel;
  parentGoalId?: string | null;
  departmentId?: string | null;
  ownerId?: string;
  ownerName?: string;
  contributorIds?: string[];
  startDate?: string;
  dueDate?: string;
  planYear: number;
  measurement: GoalMeasurement;
  quarters: GoalQuarter[];
  status?: GoalStatus;
  sortOrder?: number;
  companyId?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  /** Last editor, used by the notification trigger to skip self-notifications. */
  updatedBy?: string;
  clickup?: GoalClickUpLink;
  /** Set by the migration script so converted records can be traced or rolled back. */
  migratedFrom?: { collection: string; id: string; migratedAt: string };
}

export type GoalDraft = Omit<Goal, "id">;
