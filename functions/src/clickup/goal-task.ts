import type { ClickUpCustomField, ClickUpTask, NewClickUpTask } from "./client";
import { clickUpIdFor, type Person } from "./people";
import { RACI_FIELD_NAMES } from "./settings";
import type { Goal } from "../types";

const SMART_LABELS = [
  ["specific", "Specific"],
  ["measurable", "Measurable"],
  ["achievable", "Achievable"],
  ["relevant", "Relevant"],
  ["timeBound", "Time-bound"],
] as const;

/** The task description: the goal statement, then the SMART breakdown, one labelled line each. */
export function goalTaskDescription(goal: Pick<Goal, "smart" | "description" | "statement">): string {
  const lines = SMART_LABELS.filter(([key]) => goal.smart?.[key]?.trim()).map(
    ([key, label]) => `**${label}:** ${goal.smart![key]!.trim()}`
  );
  const statement = goal.statement?.trim();
  if (lines.length === 0) return statement || goal.description?.trim() || "";
  const breakdown = lines.join("\n\n");
  return statement ? `**Goal:** ${statement}\n\n### SMART breakdown\n\n${breakdown}` : breakdown;
}

/** ClickUp stores dates as epoch milliseconds; noon UTC keeps the day stable in US time zones. */
export function toClickUpDate(isoDate: string | undefined): number | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  return Date.parse(`${isoDate}T12:00:00Z`);
}

export type RaciRole = keyof typeof RACI_FIELD_NAMES;

export interface RaciClickUpIds {
  ids: Record<RaciRole, number[]>;
  /** Names of people on the goal who have no ClickUp account to assign. */
  unmatched: string[];
}

export function raciClickUpIds(goal: Goal, directory: Person[]): RaciClickUpIds {
  const unmatched: string[] = [];
  const resolve = (personIds: (string | undefined)[]) =>
    personIds.filter((id): id is string => Boolean(id)).flatMap((id) => {
      const clickUpId = clickUpIdFor(directory, id);
      if (clickUpId == null) {
        const name = directory.find((p) => p.id === id)?.name ?? id;
        if (!unmatched.includes(name)) unmatched.push(name);
        return [];
      }
      return [clickUpId];
    });

  return {
    ids: {
      accountable: resolve([goal.ownerId]),
      responsible: resolve(goal.contributorIds ?? []),
      consulted: resolve(goal.consultedIds ?? []),
      informed: resolve(goal.informedIds ?? []),
    },
    unmatched,
  };
}

/** The task's assignees: whoever is Accountable or Responsible. */
export function taskAssignees(raci: RaciClickUpIds): number[] {
  return Array.from(new Set([...raci.ids.accountable, ...raci.ids.responsible]));
}

/** Finds the People field for each RACI role by name, ignoring case. */
export function findRaciFields(
  fields: ClickUpCustomField[]
): Partial<Record<RaciRole, ClickUpCustomField>> {
  const found: Partial<Record<RaciRole, ClickUpCustomField>> = {};
  (Object.keys(RACI_FIELD_NAMES) as RaciRole[]).forEach((role) => {
    const wanted = RACI_FIELD_NAMES[role].toLowerCase();
    const field = fields.find(
      (f) => f.name?.trim().toLowerCase() === wanted && f.type === "users"
    );
    if (field) found[role] = field;
  });
  return found;
}

/** People fields come back as an array of user objects. */
export function currentPeople(field: ClickUpCustomField | undefined): number[] {
  if (!Array.isArray(field?.value)) return [];
  return (field!.value as { id?: number }[])
    .map((user) => user?.id)
    .filter((id): id is number => typeof id === "number");
}

const isBlank = (value: string | null | undefined) => !value?.trim();

/**
 * The changes that fill an existing task's empty fields from the goal. The
 * task belongs to ClickUp once it exists: anything already set there, even if
 * the goal now says otherwise, is left alone, and the name is never touched.
 */
export function fillEmptyTaskFields(
  task: Pick<ClickUpTask, "description" | "text_content" | "due_date" | "start_date" | "assignees">,
  wanted: NewClickUpTask
): Partial<Omit<NewClickUpTask, "assignees">> & { assignees?: { add: number[]; rem: number[] } } {
  const changes: ReturnType<typeof fillEmptyTaskFields> = {};
  if (isBlank(task.description) && isBlank(task.text_content) && wanted.markdown_description?.trim()) {
    changes.markdown_description = wanted.markdown_description;
  }
  if (isBlank(task.due_date) && wanted.due_date != null) changes.due_date = wanted.due_date;
  if (isBlank(task.start_date) && wanted.start_date != null) changes.start_date = wanted.start_date;
  if ((task.assignees ?? []).length === 0 && wanted.assignees?.length) {
    changes.assignees = { add: wanted.assignees, rem: [] };
  }
  return changes;
}

/** A People field is only filled when it is empty, and never has anyone removed. */
export function fillEmptyPeople(current: number[], wanted: number[]): { add: number[]; rem: number[] } {
  return { add: current.length === 0 ? wanted : [], rem: [] };
}