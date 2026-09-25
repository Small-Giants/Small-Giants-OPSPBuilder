import type { Rock } from "./rock";

export type PriorityStatus =
  | "not-started"
  | "in-progress"
  | "completed"
  | "blocked";

export type PriorityType = "priority" | "capability";

export const PRIORITY_STATUS_LABELS: Record<PriorityStatus, string> = {
  "not-started": "Not Started",
  "in-progress": "In Progress",
  completed: "Completed",
  blocked: "Blocked",
};

export const PRIORITY_STATUS_COLORS: Record<PriorityStatus, string> = {
  "not-started": "bg-gray-500",
  "in-progress": "bg-blue-500",
  completed: "bg-green-500",
  blocked: "bg-red-500",
};

export interface SubPriority {
  id: string;
  title: string;
  completed: boolean;
}

export interface Priority {
  id: string;
  title: string;
  description?: string;
  owner?: string;
  ownerName?: string;
  dueDate?: string;
  status?: PriorityStatus;
  progress?: number;
  evidence?: string;
  subPriorities?: SubPriority[];
  type?: PriorityType;
  executiveChampion?: string;
  successStatement?: string;
  planYear?: number;
  companyId?: string;
  sortOrder?: number;
  createdAt?: string;
  /** Joined at read time from the rocks collection; never persisted. */
  rocks?: Rock[];
}
