import {
  QUARTERS,
  emptyQuarters,
  type Goal,
  type GoalLevel,
  type GoalQuarter,
  type GoalStatus,
  type Quarter,
} from "../types";

/**
 * Relative rather than aliased: scripts/import-workleap.ts runs this module
 * under tsx, which does not resolve tsconfig path aliases.
 */

/**
 * Minimal RFC 4180 parser. Workleap exports quote any field containing a comma
 * or a newline, and escape embedded quotes by doubling them.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];

    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/**
 * Workleap has renamed columns across versions and admins rename them again on
 * export, so match on any of the known spellings rather than one exact header.
 */
const HEADER_ALIASES: Record<string, string[]> = {
  title: ["goal", "goal name", "objective", "title", "name"],
  description: ["description", "details", "notes"],
  ownerEmail: ["owner email", "owner", "assignee email", "assignee", "email"],
  departmentName: ["team", "department", "group"],
  parentTitle: ["parent goal", "parent", "aligns to", "contributes to"],
  status: ["status", "state"],
  progress: ["progress", "completion", "percent complete", "% complete"],
  startDate: ["start date", "start", "created"],
  dueDate: ["due date", "due", "end date", "target date", "deadline"],
  target: ["target", "target value", "goal value"],
  current: ["current", "current value", "actual"],
  unit: ["unit", "measure", "metric"],
};

export type WorkleapColumn = keyof typeof HEADER_ALIASES;

export function mapHeaders(header: string[]): Partial<Record<WorkleapColumn, number>> {
  const mapped: Partial<Record<WorkleapColumn, number>> = {};

  header.forEach((raw, index) => {
    const normalized = raw.trim().toLowerCase();
    for (const [column, aliases] of Object.entries(HEADER_ALIASES)) {
      if (mapped[column as WorkleapColumn] !== undefined) continue;
      if (aliases.includes(normalized)) {
        mapped[column as WorkleapColumn] = index;
        return;
      }
    }
  });

  return mapped;
}

export function normalizeStatus(value: string | undefined): GoalStatus {
  const normalized = (value ?? "").trim().toLowerCase();
  if (["completed", "complete", "achieved", "done", "closed"].includes(normalized)) {
    return "complete";
  }
  if (["at risk", "at-risk", "off track", "behind"].includes(normalized)) {
    return "at_risk";
  }
  if (["not started", "draft", "planned", "new"].includes(normalized)) {
    return "not_started";
  }
  return "in_progress";
}

export function parseNumber(value: string | undefined): number | null {
  if (value == null) return null;
  const cleaned = value.replace(/[$,%\s,]/g, "");
  if (cleaned === "") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Accepts ISO dates and the US-style dates Workleap emits, returns ISO. */
export function parseDate(value: string | undefined): string | undefined {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return undefined;

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);

  const us = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (us) {
    const [, month, day, year] = us;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

export function quarterFromDate(iso: string | undefined): Quarter | null {
  if (!iso) return null;
  const month = Number(iso.slice(5, 7));
  if (!month) return null;
  return QUARTERS[Math.floor((month - 1) / 3)];
}

export interface ImportContext {
  planYear: number;
  /** Lowercased email to Firestore user id. */
  usersByEmail: Map<string, { id: string; name: string; departmentId?: string | null }>;
  /** Lowercased department name to id. */
  departmentsByName: Map<string, string>;
}

export interface ImportedGoal extends Omit<Goal, "id"> {
  /** Resolved after all rows are mapped, since parents may appear later. */
  parentTitle?: string;
}

export interface ImportPlan {
  goals: ImportedGoal[];
  warnings: string[];
  skipped: { row: number; reason: string }[];
  missingColumns: WorkleapColumn[];
}

const REQUIRED_COLUMNS: WorkleapColumn[] = ["title"];

/**
 * Turns a Workleap CSV export into goal drafts. Nothing is written here: the
 * caller decides whether to commit, so a bad export can be inspected first.
 */
export function planWorkleapImport(csv: string, context: ImportContext): ImportPlan {
  const rows = parseCsv(csv);
  if (rows.length === 0) {
    return { goals: [], warnings: [], skipped: [], missingColumns: REQUIRED_COLUMNS };
  }

  const [header, ...body] = rows;
  const columns = mapHeaders(header);
  const missingColumns = REQUIRED_COLUMNS.filter((c) => columns[c] === undefined);
  if (missingColumns.length > 0) {
    return { goals: [], warnings: [], skipped: [], missingColumns };
  }

  const warnings: string[] = [];
  const skipped: { row: number; reason: string }[] = [];
  const goals: ImportedGoal[] = [];

  const read = (row: string[], column: WorkleapColumn): string | undefined => {
    const index = columns[column];
    return index === undefined ? undefined : row[index]?.trim();
  };

  const unmappedHeaders = header.filter((raw) => {
    const normalized = raw.trim().toLowerCase();
    return (
      normalized !== "" &&
      !Object.values(HEADER_ALIASES).some((aliases) => aliases.includes(normalized))
    );
  });
  if (unmappedHeaders.length > 0) {
    warnings.push(`Ignored unrecognised columns: ${unmappedHeaders.join(", ")}.`);
  }

  body.forEach((row, index) => {
    const rowNumber = index + 2; // 1-based, plus the header
    const title = read(row, "title");
    if (!title) {
      skipped.push({ row: rowNumber, reason: "No goal name." });
      return;
    }

    const email = read(row, "ownerEmail")?.toLowerCase() ?? "";
    const owner = context.usersByEmail.get(email);
    if (email && !owner) {
      warnings.push(
        `Row ${rowNumber} (${title}): no OPSP account for ${email}, imported unassigned.`
      );
    }

    const departmentName = read(row, "departmentName")?.toLowerCase() ?? "";
    const departmentId =
      context.departmentsByName.get(departmentName) ?? owner?.departmentId ?? null;
    if (departmentName && !context.departmentsByName.has(departmentName)) {
      warnings.push(
        `Row ${rowNumber} (${title}): no department named "${read(row, "departmentName")}", using the owner's department.`
      );
    }

    const parentTitle = read(row, "parentTitle");
    // Workleap has no annual layer, so a goal with a parent is individual and
    // one without becomes a department goal for a human to re-parent later.
    const level: GoalLevel = parentTitle ? "individual" : "department";

    const startDate = parseDate(read(row, "startDate"));
    const dueDate = parseDate(read(row, "dueDate"));
    const target = parseNumber(read(row, "target"));
    const current = parseNumber(read(row, "current"));
    const progress = parseNumber(read(row, "progress"));
    const status = normalizeStatus(read(row, "status"));

    const quarters = buildQuarters({ dueDate, target, current, progress, status });

    goals.push({
      title,
      description: read(row, "description") ?? "",
      level,
      parentGoalId: null,
      parentTitle,
      departmentId,
      ownerId: owner?.id ?? "",
      ownerName: owner?.name ?? "",
      contributorIds: [],
      startDate,
      dueDate,
      planYear: context.planYear,
      measurement:
        target != null
          ? {
              type: "quantitative",
              unit: read(row, "unit") ?? "",
              annualTarget: target,
              accumulation: "point_in_time",
            }
          : { type: "simple", unit: "", annualTarget: null, accumulation: "cumulative" },
      quarters,
      status,
      migratedFrom: {
        collection: "workleap",
        id: `row-${rowNumber}`,
        migratedAt: new Date().toISOString(),
      },
    });
  });

  return { goals, warnings, skipped, missingColumns: [] };
}

/**
 * Workleap tracks a single current value, not a quarterly history, so the whole
 * import lands in the quarter the goal is due and earlier quarters stay empty.
 */
function buildQuarters({
  dueDate,
  target,
  current,
  progress,
  status,
}: {
  dueDate?: string;
  target: number | null;
  current: number | null;
  progress: number | null;
  status: GoalStatus;
}): GoalQuarter[] {
  const quarter = quarterFromDate(dueDate) ?? "Q4";
  const complete = status === "complete";

  return emptyQuarters().map((q) =>
    q.quarter === quarter
      ? {
          ...q,
          target,
          actual: current ?? (target != null && progress != null ? (target * progress) / 100 : null),
          complete,
        }
      : q
  );
}

/** Second pass: link children now that every goal has an id. */
export function resolveParents(
  goals: (ImportedGoal & { id: string })[]
): { resolved: number; orphaned: string[] } {
  const byTitle = new Map(goals.map((g) => [g.title.trim().toLowerCase(), g.id]));
  const orphaned: string[] = [];
  let resolved = 0;

  for (const goal of goals) {
    if (!goal.parentTitle) continue;
    const parentId = byTitle.get(goal.parentTitle.trim().toLowerCase());
    if (!parentId || parentId === goal.id) {
      orphaned.push(goal.title);
      continue;
    }
    goal.parentGoalId = parentId;
    resolved += 1;
  }

  return { resolved, orphaned };
}

export function summarizeImport(plan: ImportPlan): string {
  const byLevel = plan.goals.reduce<Record<string, number>>((acc, goal) => {
    acc[goal.level] = (acc[goal.level] ?? 0) + 1;
    return acc;
  }, {});

  return [
    `${plan.goals.length} goal(s) ready to import.`,
    ...Object.entries(byLevel).map(([level, count]) => `  ${level}: ${count}`),
    plan.skipped.length > 0 ? `${plan.skipped.length} row(s) skipped.` : "",
    plan.warnings.length > 0 ? `${plan.warnings.length} warning(s).` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
