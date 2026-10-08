import type { Quarter } from "./common";
import type { SmartDescription } from "./goal";
import type { RaciAssignment } from "./raci";

export type RockStatus = "not_started" | "ready" | "in_progress" | "complete";

export const ROCK_STATUSES: RockStatus[] = [
  "not_started",
  "ready",
  "in_progress",
  "complete",
];

export const ROCK_STATUS_LABELS: Record<RockStatus, string> = {
  not_started: "Not Started",
  ready: "Ready",
  in_progress: "In Progress",
  complete: "Complete",
};

/**
 * A task that lives inside a goal at any of the three levels. Rocks carry the
 * same RACI and SMART structure as goals so the two read consistently.
 */
export interface Rock extends RaciAssignment {
  id: string;
  /** The title. Stored as `text` because `title` means something else below. */
  text: string;
  description?: string;
  /** Optional, unlike a goal: a rock can be saved with just a title. */
  smart?: SmartDescription;
  status: RockStatus;
  quarter: Quarter;
  /** Legacy documents predate the field and store null. */
  year?: number | null;
  /** The goal this rock belongs to, at any level. */
  goalId?: string;
  /** Pre-conversion link to the priorities collection. Read, never written. */
  priorityId?: string;
  progress?: number;
  category?: string;
  /** Flags a rock as a top focus item. Distinct from the Priority entity. */
  priority?: boolean;
  startDate?: string;
  projectManagement?: boolean;
  bloomGrowthVisibility?: boolean;
  visionStatement?: string;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
  /** Older documents stored the label under `title` instead of `text`. */
  title?: string;
  /** Pre-RACI single assignee. Read for legacy docs, never written. */
  assigneeId?: string;
  assigneeName?: string;
}

/**
 * Older documents and an earlier PriorityTracker interface used "backlog" where
 * every writer in the app now produces "not_started".
 */
export function normalizeRockStatus(value: unknown): RockStatus {
  if (value === "backlog" || value == null || value === "") return "not_started";
  return (ROCK_STATUSES as string[]).includes(value as string)
    ? (value as RockStatus)
    : "not_started";
}

export function rockLabel(rock: Pick<Rock, "text" | "title">): string {
  return rock.text || rock.title || "";
}

export function isRockComplete(rock: Pick<Rock, "status">): boolean {
  return normalizeRockStatus(rock.status) === "complete";
}

/**
 * The goal a rock hangs off. Documents written before the conversion still
 * carry `priorityId`, which pointed at the priority that became that goal.
 */
export function rockGoalId(rock: Pick<Rock, "goalId" | "priorityId">): string | null {
  return rock.goalId || rock.priorityId || null;
}

/**
 * Who is doing the work. Legacy rocks stored one `assigneeId`; that person is
 * Responsible under the RACI model.
 */
export function rockResponsibleIds(
  rock: Pick<Rock, "contributorIds" | "assigneeId">
): string[] {
  const ids = rock.contributorIds ?? [];
  if (ids.length > 0) return ids;
  return rock.assigneeId ? [rock.assigneeId] : [];
}
