import type { ClickUpCustomField } from "./client";
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

export function peopleDiff(current: number[], wanted: number[]): { add: number[]; rem: number[] } {
  return {
    add: wanted.filter((id) => !current.includes(id)),
    rem: current.filter((id) => !wanted.includes(id)),
  };
}
