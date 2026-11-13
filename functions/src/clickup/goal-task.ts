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
  const breakdown = lines.join("\n");
  return statement ? `**Goal:** ${statement}\n\n### SMART breakdown\n${breakdown}` : breakdown;
}

/** Labels what the app wrote into a task, and tells the app it already has. */
export const OPSP_MARKER = "Added by OPSP app";

/** The goal's description under the OPSP label, dated in Arizona time. */
export function opspDescriptionBlock(
  goal: Pick<Goal, "smart" | "description" | "statement">,
  now = new Date()
): string {
  const body = goalTaskDescription(goal);
  if (!body) return "";
  const date = now.toLocaleDateString("en-US", {
    timeZone: "America/Phoenix",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `***${OPSP_MARKER}*** *(${date})*\n${body}`;
}

const squash = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * The new description for an existing task, or null to leave it alone. An
 * empty description gets the OPSP block; one with text gets the block added
 * above it, unless it already has the block or the goal statement. Without
 * the task's markdown the original formatting could not be kept, so nothing
 * is added.
 */
export function descriptionWithOpspBlock(
  task: Pick<ClickUpTask, "description" | "text_content" | "markdown_description">,
  block: string,
  statement: string | undefined
): string | null {
  if (!block.trim()) return null;
  const plain = task.text_content?.trim() || task.description?.trim() || "";
  const markdown = task.markdown_description?.trim() ?? "";
  if (!plain && !markdown) return block;

  const existing = squash(`${plain} ${markdown}`);
  if (existing.includes(squash(OPSP_MARKER))) return null;
  if (statement?.trim() && existing.includes(squash(statement))) return null;
  if (!markdown) return null;
  return `${block}\n\n---\n\n${markdown}`;
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

/**
 * Word stems that identify each role in a field name, so "A (Accountable)",
 * "C (Consulting)", and "I (Inform)" are found as well as the plain names.
 */
const RACI_FIELD_STEMS: Record<RaciRole, RegExp> = {
  accountable: /\baccountab/,
  responsible: /\bresponsib/,
  consulted: /\bconsult/,
  informed: /\binform/,
};

/** Finds the People field for each RACI role by name, ignoring case; an exact name wins. */
export function findRaciFields(
  fields: ClickUpCustomField[]
): Partial<Record<RaciRole, ClickUpCustomField>> {
  const people = fields.filter((f) => f.type === "users");
  const found: Partial<Record<RaciRole, ClickUpCustomField>> = {};
  (Object.keys(RACI_FIELD_NAMES) as RaciRole[]).forEach((role) => {
    const name = (f: ClickUpCustomField) => f.name?.trim().toLowerCase() ?? "";
    const field =
      people.find((f) => name(f) === RACI_FIELD_NAMES[role].toLowerCase()) ??
      people.find((f) => RACI_FIELD_STEMS[role].test(name(f)));
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
 * Two things are added to rather than filled: the labelled OPSP block goes
 * above an existing description (see descriptionWithOpspBlock), and people
 * the goal names are added to the assignees without removing anyone.
 */
export function fillEmptyTaskFields(
  task: Pick<
    ClickUpTask,
    "description" | "text_content" | "markdown_description" | "due_date" | "start_date" | "assignees"
  >,
  wanted: NewClickUpTask,
  statement?: string
): Partial<Omit<NewClickUpTask, "assignees">> & { assignees?: { add: number[]; rem: number[] } } {
  const changes: ReturnType<typeof fillEmptyTaskFields> = {};
  const description = descriptionWithOpspBlock(task, wanted.markdown_description ?? "", statement);
  if (description) changes.markdown_description = description;
  if (isBlank(task.due_date) && wanted.due_date != null) changes.due_date = wanted.due_date;
  if (isBlank(task.start_date) && wanted.start_date != null) changes.start_date = wanted.start_date;
  const currentAssignees = (task.assignees ?? [])
    .map((u) => u.id)
    .filter((id): id is number => typeof id === "number");
  const assignees = addMissingPeople(currentAssignees, wanted.assignees ?? []);
  if (assignees.add.length > 0) changes.assignees = assignees;
  return changes;
}

/**
 * Adds the people the goal names that the task lacks. Nobody is ever removed,
 * so people added in ClickUp stay.
 */
export function addMissingPeople(current: number[], wanted: number[]): { add: number[]; rem: number[] } {
  return { add: wanted.filter((id) => !current.includes(id)), rem: [] };
}

/**
 * The change to one RACI People field. Accountable holds a single person, so
 * it is only set when empty; someone else already there is a conflict to
 * report, never a second Accountable.
 */
export function raciFieldChange(
  role: RaciRole,
  current: number[],
  wanted: number[]
): { add: number[]; rem: number[]; conflict: boolean } {
  if (role !== "accountable") return { ...addMissingPeople(current, wanted), conflict: false };
  if (current.length === 0) return { add: wanted.slice(0, 1), rem: [], conflict: false };
  return { add: [], rem: [], conflict: wanted.length > 0 && !current.includes(wanted[0]) };
}