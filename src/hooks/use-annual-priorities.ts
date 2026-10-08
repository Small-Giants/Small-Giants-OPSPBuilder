"use client";

import { useMemo } from "react";
import { useGoals } from "@/hooks/use-goals";
import { useRocks } from "@/hooks/use-rocks";
import { calculateGoalProgress, deriveStatus } from "@/lib/goal-progress";
import type { Goal, GoalStatus, Priority, PriorityStatus, Rock } from "@/types";

const STATUS_MAP: Record<GoalStatus, PriorityStatus> = {
  not_started: "not-started",
  in_progress: "in-progress",
  at_risk: "blocked",
  complete: "completed",
};

/** An annual priority goal, shaped like the Priority record screens expect. */
export interface AnnualPriority extends Priority {
  /** The underlying goal, for screens that want quarters or RACI. */
  goal: Goal;
  rocks: Rock[];
}

export function toAnnualPriority(goal: Goal, rocks: Rock[]): AnnualPriority {
  const progress = calculateGoalProgress(goal);
  return {
    id: goal.id,
    title: goal.title,
    description: goal.description,
    owner: goal.ownerName,
    ownerName: goal.ownerName,
    dueDate: goal.dueDate,
    status: STATUS_MAP[deriveStatus(goal, progress)],
    progress: progress.percent,
    successStatement: goal.smart?.measurable,
    type: "priority",
    planYear: goal.planYear,
    companyId: goal.companyId,
    sortOrder: goal.sortOrder,
    createdAt: goal.createdAt,
    rocks,
    goal,
  };
}

/**
 * Annual priorities now live in the goals collection. This presents them in
 * the shape the older planning and execution screens already render, so those
 * screens did not have to be rebuilt around the goal model.
 */
export function useAnnualPriorities() {
  const { goals, loading } = useGoals({ level: "annual" });
  const { byGoal, loading: rocksLoading } = useRocks();

  const priorities = useMemo(
    () => goals.map((goal) => toAnnualPriority(goal, byGoal.get(goal.id) ?? [])),
    [goals, byGoal]
  );

  return { priorities, goals, loading: loading || rocksLoading };
}
