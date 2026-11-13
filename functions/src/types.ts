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

/** The ClickUp agent's latest monthly recap, as last pulled by a sync. */
export interface GoalRecap {
  commentId: string;
  commentUrl: string;
  text: string;
  author: string | null;
  postedAt: string | null;
  period: string | null;
  summary: string | null;
  status: GoalStatus | null;
  rockCount: number;
  /** Parser problems, shown to whoever reviews the recap. */
  warnings: string[];
  approvedBy?: RecapApproval | null;
  pulledAt: string;
}

export interface RecapApproval {
  byId: string;
  byName: string;
  at: string;
  via: "clickup" | "app";
}

export interface GoalClickUpLink {
  taskId?: string;
  listId?: string;
  url?: string;
  lastSyncedAt?: string;
  /** When the app last created or updated the ClickUp task from the goal. */
  lastPushedAt?: string;
  /** Set when the last sync attempt failed, cleared on the next success. */
  lastSyncError?: string;
  /** The most recent recap that was approved and applied. */
  recap?: GoalRecap | null;
  /** The newest recap still waiting for the goal owner's approval. */
  pendingRecap?: GoalRecap | null;
  /** Approvals given in the app, keyed by ClickUp comment id. */
  approvals?: Record<string, RecapApproval>;
  /** Every recap already applied, so none is applied twice. */
  appliedRecapIds?: string[];
}

/**
 * RACI. `ownerId` holds Accountable and `contributorIds` holds Responsible;
 * the storage names predate the model. Mirror of src/types/raci.ts.
 */
export interface RaciAssignment {
  ownerId?: string;
  ownerName?: string;
  contributorIds?: string[];
  consultedIds?: string[];
  informedIds?: string[];
  executiveSponsorId?: string;
}

/** Everyone named in any RACI role. */
export function raciMembers(entity: RaciAssignment): string[] {
  const ids = [
    entity.ownerId,
    ...(entity.contributorIds ?? []),
    ...(entity.consultedIds ?? []),
    ...(entity.informedIds ?? []),
    entity.executiveSponsorId,
  ];
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

export interface Goal extends RaciAssignment {
  id: string;
  title: string;
  description?: string;
  /** One sentence written from the SMART answers. */
  statement?: string;
  smart?: Partial<
    Record<"specific" | "measurable" | "achievable" | "relevant" | "timeBound", string>
  >;
  level: GoalLevel;
  parentGoalId?: string | null;
  departmentId?: string | null;
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

export type RockStatus = "not_started" | "ready" | "in_progress" | "complete";

/**
 * A task inside a goal. Mirror of src/types/rock.ts, limited to the fields the
 * ClickUp sync reads or writes.
 */
export interface Rock extends RaciAssignment {
  id: string;
  text: string;
  description?: string;
  status: RockStatus;
  quarter: Quarter;
  year?: number | null;
  /** YYYY-MM-DD. */
  dueDate?: string | null;
  goalId?: string;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
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
  /** "clickup" on a placeholder for a ClickUp member who has not signed in yet. */
  source?: "clickup";
  clickupUserId?: number;
}

export type SyncLogStatus = "success" | "partial" | "error";

export interface SyncLogEntry {
  startedAt: string;
  finishedAt: string;
  triggeredBy: string;
  /** The first-Friday schedule skips a month in which an admin already synced manually. */
  trigger?: "manual" | "scheduled";
  source: "clickup";
  status: SyncLogStatus;
  goalsExamined: number;
  goalsUpdated: number;
  /** Goals where an agent recap comment was found. */
  recapsFound?: number;
  errors: { goalId: string; message: string }[];
}
