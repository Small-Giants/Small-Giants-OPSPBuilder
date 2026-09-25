/**
 * Mirror of the goal shapes in src/types/goal.ts. The functions package builds
 * separately from the app, so it cannot import across the root boundary; only
 * the fields the backend actually reads are duplicated here.
 */

export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

export const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

export type GoalLevel = "annual" | "department" | "individual";

export type GoalStatus = "not_started" | "in_progress" | "at_risk" | "complete";

export interface GoalQuarter {
  quarter: Quarter;
  target: number | null;
  actual: number | null;
  complete: boolean;
  note?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface GoalClickUpLink {
  taskId?: string;
  listId?: string;
  url?: string;
  lastSyncedAt?: string;
  /** Set when the last sync attempt failed, cleared on the next success. */
  lastSyncError?: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  level: GoalLevel;
  parentGoalId?: string | null;
  departmentId?: string | null;
  ownerId?: string;
  ownerName?: string;
  contributorIds?: string[];
  startDate?: string;
  dueDate?: string;
  planYear: number;
  measurement: {
    type: "simple" | "quantitative";
    unit?: string;
    annualTarget?: number | null;
    accumulation?: "cumulative" | "point_in_time";
  };
  quarters: GoalQuarter[];
  status?: GoalStatus;
  clickup?: GoalClickUpLink;
}

export interface UserRecord {
  id: string;
  email?: string;
  name?: string;
  role?: "superadmin" | "admin" | "user";
  departmentId?: string | null;
  managerId?: string | null;
  deletedAt?: string | null;
}

export type SyncLogStatus = "success" | "partial" | "error";

export interface SyncLogEntry {
  startedAt: string;
  finishedAt: string;
  triggeredBy: string;
  source: "clickup";
  status: SyncLogStatus;
  goalsExamined: number;
  goalsUpdated: number;
  errors: { goalId: string; message: string }[];
}
