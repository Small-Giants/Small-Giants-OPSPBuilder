import { QUARTERS, type Goal, type Quarter } from "../types";
import type { NotificationIntent } from "./types";

/**
 * Everyone with a stake in a goal: the owner, the contributors, and whoever
 * leads the department it belongs to.
 */
export function stakeholders(
  goal: Goal,
  departmentLeaderId?: string | null
): string[] {
  const ids = [goal.ownerId, ...(goal.contributorIds ?? []), departmentLeaderId];
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

export interface GoalChangeContext {
  before: Goal | null;
  after: Goal | null;
  departmentLeaderId?: string | null;
  /** Who made the change; they do not need to be told about their own edit. */
  actorId?: string;
}

/**
 * Pure decision layer: which notifications a single goal write should produce.
 * Keeping this free of Firestore and network calls is what makes the trigger
 * behaviour testable.
 */
export function intentsForGoalChange({
  before,
  after,
  departmentLeaderId,
  actorId,
}: GoalChangeContext): NotificationIntent[] {
  if (!after) return [];

  const intents: NotificationIntent[] = [];
  const goalRef = { view: "goals", goalId: after.id };

  const ownerChanged = before?.ownerId !== after.ownerId;
  if (ownerChanged && after.ownerId) {
    intents.push({
      ...goalRef,
      kind: "goal_assigned",
      recipientId: after.ownerId,
      title: "You own a new goal",
      body: `${after.title} is now yours for ${after.planYear}.`,
      dedupeKey: `goal_assigned:${after.id}:${after.ownerId}`,
    });
  }

  const before_ = new Set(before?.contributorIds ?? []);
  for (const id of after.contributorIds ?? []) {
    if (before_.has(id)) continue;
    intents.push({
      ...goalRef,
      kind: "contributor_added",
      recipientId: id,
      title: "You were added to a goal",
      body: `${after.ownerName || "Someone"} added you as a contributor on ${after.title}.`,
      dedupeKey: `contributor_added:${after.id}:${id}`,
    });
  }

  const recipients = stakeholders(after, departmentLeaderId);

  if (before?.status !== "at_risk" && after.status === "at_risk") {
    for (const id of recipients) {
      intents.push({
        ...goalRef,
        kind: "goal_at_risk",
        recipientId: id,
        title: "A goal is at risk",
        body: `${after.title} was flagged at risk.`,
        dedupeKey: `goal_at_risk:${after.id}:${id}`,
      });
    }
  }

  if (before?.status !== "complete" && after.status === "complete") {
    for (const id of recipients) {
      intents.push({
        ...goalRef,
        kind: "goal_completed",
        recipientId: id,
        title: "Goal complete",
        body: `${after.title} hit its target.`,
        dedupeKey: `goal_completed:${after.id}:${id}`,
      });
    }
  }

  const newlyChecked = changedQuarters(before, after);
  if (newlyChecked.length > 0) {
    for (const id of recipients) {
      intents.push({
        ...goalRef,
        kind: "quarter_updated",
        recipientId: id,
        title: `${newlyChecked.join(", ")} updated`,
        body: `${after.title} has new check-in data.`,
        dedupeKey: `quarter_updated:${after.id}:${newlyChecked.join("")}:${id}`,
      });
    }
  }

  // Nobody needs a notification about their own edit.
  return intents.filter((intent) => intent.recipientId !== actorId);
}

function changedQuarters(before: Goal | null, after: Goal): Quarter[] {
  const changed: Quarter[] = [];
  for (const quarter of QUARTERS) {
    const was = before?.quarters?.find((q) => q.quarter === quarter);
    const now = after.quarters?.find((q) => q.quarter === quarter);
    if (!now) continue;
    if (was?.actual !== now.actual || was?.complete !== now.complete) {
      changed.push(quarter);
    }
  }
  return changed;
}

export function currentQuarter(date: Date): Quarter {
  return QUARTERS[Math.floor(date.getMonth() / 3)];
}

/** Whole calendar days, so a reminder on the last day reads as 0, not 1. */
export function daysUntilQuarterEnd(date: Date): number {
  const endMonth = Math.floor(date.getMonth() / 3) * 3 + 3;
  const end = new Date(date.getFullYear(), endMonth, 0);
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Nudges owners whose current-quarter check-in is still open as the quarter
 * closes. Only fires inside the window so the reminder stays meaningful.
 */
export function intentsForQuarterDeadline(
  goals: Goal[],
  now: Date,
  warnWithinDays = 14
): NotificationIntent[] {
  const remaining = daysUntilQuarterEnd(now);
  if (remaining > warnWithinDays || remaining < 0) return [];

  const quarter = currentQuarter(now);
  const intents: NotificationIntent[] = [];

  for (const goal of goals) {
    if (!goal.ownerId) continue;
    const entry = goal.quarters?.find((q) => q.quarter === quarter);
    if (!entry) continue;

    const hasTarget = entry.target != null;
    const done = entry.complete || (hasTarget && entry.actual != null && entry.actual >= entry.target!);
    if (done) continue;

    intents.push({
      kind: "quarter_due_soon",
      recipientId: goal.ownerId,
      title:
        remaining === 0
          ? `${quarter} closes today`
          : `${quarter} closes in ${remaining} day${remaining === 1 ? "" : "s"}`,
      body: `${goal.title} still needs a ${quarter} check-in.`,
      view: "my-goals",
      goalId: goal.id,
      // Once per goal per quarter per week, not once per run.
      dedupeKey: `quarter_due_soon:${goal.id}:${quarter}:${weekStamp(now)}`,
    });
  }

  return intents;
}

function weekStamp(date: Date): string {
  const start = new Date(date.getFullYear(), 0, 1);
  const week = Math.floor((date.getTime() - start.getTime()) / (7 * 86_400_000));
  return `${date.getFullYear()}W${week}`;
}

export interface DigestLine {
  goalId: string;
  title: string;
  percent: number;
  needsCheckIn: boolean;
}

/** Collapses a person's goals into one weekly summary body. */
export function buildDigest(
  recipientId: string,
  lines: DigestLine[],
  now: Date
): NotificationIntent | null {
  if (lines.length === 0) return null;

  const open = lines.filter((l) => l.needsCheckIn);
  const average = Math.round(
    lines.reduce((sum, l) => sum + l.percent, 0) / lines.length
  );

  const body =
    open.length === 0
      ? `All ${lines.length} of your goals are up to date. Average progress ${average}%.`
      : `${open.length} of your ${lines.length} goals need a check-in: ${open
          .slice(0, 3)
          .map((l) => l.title)
          .join(", ")}${open.length > 3 ? ", and more" : ""}. Average progress ${average}%.`;

  return {
    kind: "weekly_digest",
    recipientId,
    title: "Your weekly goal summary",
    body,
    view: "my-goals",
    dedupeKey: `weekly_digest:${recipientId}:${weekStamp(now)}`,
  };
}
