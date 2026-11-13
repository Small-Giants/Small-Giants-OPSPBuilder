import { QUARTERS, type Quarter } from "./common";
import type { RaciAssignment } from "./raci";

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
export const SMART_CHAR_LIMIT = 300;

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

export interface RecapApproval {
  byId: string;
  byName: string;
  at: string;
  via: "clickup" | "app";
}

/**
 * A rock plan or monthly recap the ClickUp agent posted on the goal's task.
 * Once approved it is the source of truth for the goal's status, quarter
 * progress, and rocks.
 */
export interface GoalRecap {
  commentId: string;
  commentUrl: string;
  text: string;
  author: string | null;
  postedAt: string | null;
  period: string | null;
  summary: string | null;
  status: GoalStatus | null;
  rockCount?: number;
  warnings?: string[];
  approvedBy?: RecapApproval | null;
  pulledAt: string;
}

/** Written by Cloud Functions; see functions/src/clickup/sync.ts. */
export interface GoalClickUpLink {
  taskId?: string;
  listId?: string;
  url?: string;
  lastSyncedAt?: string;
  lastPushedAt?: string;
  /** Set when the last attempt failed, cleared on the next success. */
  lastSyncError?: string | null;
  /** The most recent recap that was approved and applied. */
  recap?: GoalRecap | null;
  /** The newest recap still waiting for approval. */
  pendingRecap?: GoalRecap | null;
  approvals?: Record<string, RecapApproval>;
  appliedRecapIds?: string[];
}

export type ClickUpLocationKind = "list" | "space";

/**
 * Where the app creates goal tasks, from a ClickUp List or Space URL. Mirror
 * of functions/src/clickup/location.ts, used here only to validate input.
 */
export function parseClickUpLocation(
  url: string
): { kind: ClickUpLocationKind; id: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)clickup\.com$/.test(parsed.hostname)) return null;
  const path = parsed.pathname;
  const list = path.match(/\/v\/li\/(\d+)/) ?? path.match(/\/v\/l\/\d+-(\d+)-\d+/);
  if (list) return { kind: "list", id: list[1] };
  const space = path.match(/\/v\/(?:o\/)?s\/(\d+)/);
  if (space) return { kind: "space", id: space[1] };
  return null;
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

export interface Goal extends RaciAssignment {
  id: string;
  title: string;
  /** The statement, or else `smart` flattened, so list views can read one string. */
  description?: string;
  /** One concise goal sentence written from the SMART answers, editable by the lead. */
  statement?: string;
  smart?: SmartDescription;
  level: GoalLevel;
  parentGoalId?: string | null;
  departmentId?: string | null;
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
