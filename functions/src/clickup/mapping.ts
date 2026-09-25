import type { ClickUpCustomField, ClickUpTask } from "./client";
import { QUARTERS, type Goal, type GoalQuarter, type Quarter } from "../types";

export interface ClickUpMappingConfig {
  enabled: boolean;
  /** Dropdown or text field naming the quarter a subtask belongs to. */
  quarterFieldName?: string;
  /** Numeric field carrying the actual value for quantitative goals. */
  progressFieldName?: string;
  /** Status names, lowercased, that mean done. Empty falls back to ClickUp's own flag. */
  completeStatuses: string[];
}

export const DEFAULT_MAPPING: ClickUpMappingConfig = {
  enabled: false,
  quarterFieldName: "Quarter",
  progressFieldName: "Actual",
  completeStatuses: ["complete", "closed", "done"],
};

export function isTaskComplete(
  task: ClickUpTask,
  config: ClickUpMappingConfig
): boolean {
  const type = task.status?.type?.toLowerCase();
  if (type === "closed" || type === "done") return true;

  const name = task.status?.status?.toLowerCase();
  if (!name) return false;
  return config.completeStatuses.map((s) => s.toLowerCase()).includes(name);
}

export function findField(
  task: ClickUpTask,
  fieldName: string | undefined
): ClickUpCustomField | undefined {
  if (!fieldName) return undefined;
  const wanted = fieldName.trim().toLowerCase();
  return task.custom_fields?.find((f) => f.name?.trim().toLowerCase() === wanted);
}

/**
 * ClickUp returns dropdown values as the index into `type_config.options`, and
 * everything else as a string, so both shapes have to be resolved to a label.
 */
export function readFieldLabel(field: ClickUpCustomField | undefined): string | null {
  if (!field || field.value == null || field.value === "") return null;

  if (field.type === "drop_down") {
    const options = field.type_config?.options ?? [];
    const index = Number(field.value);
    const option =
      options.find((o) => o.id === String(field.value)) ??
      (Number.isInteger(index) ? options[index] : undefined);
    return option?.name ?? option?.label ?? null;
  }

  return String(field.value);
}

export function readFieldNumber(field: ClickUpCustomField | undefined): number | null {
  const label = readFieldLabel(field);
  if (label == null) return null;
  const parsed = Number(String(label).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function quarterFromDueDate(dueDate: string | null | undefined): Quarter | null {
  if (!dueDate) return null;
  const ms = Number(dueDate);
  const date = Number.isFinite(ms) ? new Date(ms) : new Date(dueDate);
  if (Number.isNaN(date.getTime())) return null;
  return QUARTERS[Math.floor(date.getMonth() / 3)];
}

/**
 * A subtask's quarter comes from the configured field first, because that is
 * what a person deliberately set, and only falls back to the due date.
 */
export function quarterForTask(
  task: ClickUpTask,
  config: ClickUpMappingConfig
): Quarter | null {
  const label = readFieldLabel(findField(task, config.quarterFieldName));
  // People write "Q2", "q2 2026", and "Quarter 2", so match the digit, not the
  // whole string.
  const match = label?.match(/q(?:uarter)?\s*([1-4])/i);
  if (match) return `Q${match[1]}` as Quarter;

  return quarterFromDueDate(task.due_date);
}

export interface MappedQuarter {
  quarter: Quarter;
  actual: number | null;
  complete: boolean;
  subtaskCount: number;
  subtasksComplete: number;
}

export interface MappingResult {
  quarters: MappedQuarter[];
  /** Subtasks with no quarter field and no due date, so they could not be placed. */
  unplacedSubtasks: string[];
}

/**
 * Turns one ClickUp task and its subtasks into per-quarter values.
 *
 * Simple goals treat a quarter as complete when every subtask in it is closed.
 * Quantitative goals sum the configured numeric field instead, and fall back to
 * the parent task's own value when no subtask carries one.
 */
export function mapTaskToQuarters(
  task: ClickUpTask,
  goal: Pick<Goal, "measurement" | "quarters">,
  config: ClickUpMappingConfig
): MappingResult {
  const subtasks = task.subtasks ?? [];
  const unplacedSubtasks: string[] = [];
  const buckets = new Map<Quarter, ClickUpTask[]>();

  for (const subtask of subtasks) {
    const quarter = quarterForTask(subtask, config);
    if (!quarter) {
      unplacedSubtasks.push(subtask.name);
      continue;
    }
    buckets.set(quarter, [...(buckets.get(quarter) ?? []), subtask]);
  }

  const quantitative = goal.measurement?.type === "quantitative";
  const parentValue = readFieldNumber(findField(task, config.progressFieldName));
  const parentQuarter = quarterForTask(task, config);

  const quarters: MappedQuarter[] = [];

  for (const quarter of QUARTERS) {
    const items = buckets.get(quarter) ?? [];
    const subtasksComplete = items.filter((t) => isTaskComplete(t, config)).length;

    let actual: number | null = null;
    if (quantitative) {
      const values = items
        .map((t) => readFieldNumber(findField(t, config.progressFieldName)))
        .filter((v): v is number => v != null);

      if (values.length > 0) {
        actual = values.reduce((sum, v) => sum + v, 0);
      } else if (items.length === 0 && parentQuarter === quarter && parentValue != null) {
        actual = parentValue;
      }
    }

    const complete =
      items.length > 0
        ? subtasksComplete === items.length
        : parentQuarter === quarter && isTaskComplete(task, config);

    // Leave untouched quarters out entirely rather than writing zeros over
    // numbers a person entered by hand.
    if (items.length === 0 && actual == null && !complete) continue;

    quarters.push({ quarter, actual, complete, subtaskCount: items.length, subtasksComplete });
  }

  return { quarters, unplacedSubtasks };
}

export interface QuarterMerge {
  quarters: GoalQuarter[];
  changed: boolean;
}

/**
 * Applies mapped values onto the goal's existing quarters. Targets are always
 * preserved: ClickUp reports what happened, it does not get to redefine the plan.
 */
export function mergeQuarters(
  existing: GoalQuarter[],
  mapped: MappedQuarter[],
  syncedAt: string
): QuarterMerge {
  let changed = false;

  const quarters = QUARTERS.map((quarter) => {
    const current =
      existing.find((q) => q.quarter === quarter) ??
      ({ quarter, target: null, actual: null, complete: false } as GoalQuarter);

    const update = mapped.find((m) => m.quarter === quarter);
    if (!update) return current;

    const nextActual = update.actual ?? current.actual;
    if (nextActual === current.actual && update.complete === current.complete) {
      return current;
    }

    changed = true;
    return {
      ...current,
      actual: nextActual,
      complete: update.complete,
      updatedAt: syncedAt,
      updatedBy: "clickup",
    };
  });

  return { quarters, changed };
}
