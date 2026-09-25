import type { Quarter } from "./common";

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

export interface Rock {
  id: string;
  text: string;
  status: RockStatus;
  quarter: Quarter;
  /** Legacy documents predate the field and store null. */
  year?: number | null;
  progress?: number;
  category?: string;
  priorityId?: string;
  /** Flags a rock as a top focus item. Distinct from the Priority entity. */
  priority?: boolean;
  assigneeId?: string;
  assigneeName?: string;
  executiveSponsor?: string;
  responsible?: string;
  accountable?: string;
  startDate?: string;
  projectManagement?: boolean;
  bloomGrowthVisibility?: boolean;
  visionStatement?: string;
  companyId?: string;
  createdAt?: string;
  /** Older documents stored the label under `title` instead of `text`. */
  title?: string;
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
