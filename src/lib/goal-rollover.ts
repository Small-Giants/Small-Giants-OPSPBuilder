import { newGoalDraft } from "@/lib/goals";
import type { Goal, GoalDraft, GoalLevel } from "@/types";

export interface RolloverItem {
  sourceId: string;
  /** The source goal's parent, when that parent is also being carried. */
  parentSourceId: string | null;
  draft: GoalDraft;
}

export interface RolloverOptions {
  /** Copy every company initiative's title, statement, and RACI. */
  initiatives: boolean;
  /** Carry team and individual goals that are not complete. */
  unfinishedGoals: boolean;
}

const LEVEL_ORDER: GoalLevel[] = ["initiative", "team", "individual"];

/**
 * The goals a new plan year starts with, parents before children so the
 * caller can map old ids to new ones as it creates them. Quarters start
 * empty; the ClickUp task link carries over so syncing continues on the
 * same task, but its recap and approval history stays with the old year.
 */
export function planGoalRollover(
  goals: Goal[],
  toYear: number,
  companyId: string,
  options: RolloverOptions
): RolloverItem[] {
  const carried = goals.filter((goal) =>
    goal.level === "initiative"
      ? options.initiatives
      : options.unfinishedGoals && goal.status !== "complete"
  );
  const carriedIds = new Set(carried.map((goal) => goal.id));

  return carried
    .sort(
      (a, b) =>
        LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) ||
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    )
    .map((goal) => {
      const parentSourceId =
        goal.parentGoalId && carriedIds.has(goal.parentGoalId) ? goal.parentGoalId : null;
      const base = newGoalDraft({
        level: goal.level,
        planYear: toYear,
        companyId,
        teamId: goal.teamId ?? null,
        sortOrder: goal.sortOrder,
      });
      const draft: GoalDraft = {
        ...base,
        title: goal.title,
        description: goal.description ?? "",
        statement: goal.statement,
        smart: goal.smart,
        ownerId: goal.ownerId ?? "",
        ownerName: goal.ownerName ?? "",
        contributorIds: goal.contributorIds ?? [],
        consultedIds: goal.consultedIds ?? [],
        informedIds: goal.informedIds ?? [],
        executiveSponsorId: goal.executiveSponsorId,
        rolledOverFrom: { goalId: goal.id, planYear: goal.planYear },
      };
      if (goal.level !== "initiative") {
        draft.measurement = goal.measurement;
        draft.status = goal.status ?? "not_started";
        draft.startDate = goal.startDate ?? "";
        draft.dueDate = goal.dueDate ?? "";
        if (goal.clickup?.taskId) {
          draft.clickup = {
            taskId: goal.clickup.taskId,
            ...(goal.clickup.url ? { url: goal.clickup.url } : {}),
            ...(goal.clickup.listId ? { listId: goal.clickup.listId } : {}),
          };
        }
      }
      return { sourceId: goal.id, parentSourceId, draft };
    });
}
