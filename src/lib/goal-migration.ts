import {
  QUARTERS,
  defaultMeasurement,
  emptyQuarters,
  normalizeRockStatus,
  rockLabel,
  toQuarter,
  type Goal,
  type GoalDraft,
  type GoalQuarter,
  type Quarter,
  // Relative rather than aliased: scripts/migrate-goals.ts runs this module
  // under tsx, which does not resolve tsconfig path aliases.
} from "../types";

/**
 * Legacy shapes, kept deliberately loose. These documents predate the shared
 * types and several fields are missing or inconsistently named.
 */
export interface LegacyPriority {
  id: string;
  title?: string;
  description?: string;
  owner?: string;
  ownerName?: string;
  dueDate?: string;
  type?: string;
  planYear?: number | null;
  sortOrder?: number;
  successStatement?: string;
  executiveChampion?: string;
  progress?: number;
  createdAt?: string;
}

export interface LegacyRock {
  id: string;
  text?: string;
  title?: string;
  quarter?: string;
  year?: number | null;
  status?: string;
  priorityId?: string;
  assigneeId?: string;
  assigneeName?: string;
  startDate?: string;
  createdAt?: string;
}

export interface MigrationInput {
  companyId: string;
  planYear: number;
  /** Legacy documents with no year are treated as belonging to this year. */
  legacyPlanYear: number;
  priorities: LegacyPriority[];
  rocks: LegacyRock[];
  /** Maps a user id to their department, used to backfill departmentId. */
  departmentByUserId?: Record<string, string | undefined>;
  /** Resolves a free-text owner name to a user id where possible. */
  userIdByName?: Record<string, string | undefined>;
}

export interface PlannedGoal {
  /** Stable key used to wire children to parents before ids exist. */
  key: string;
  parentKey: string | null;
  source: { collection: "priorities" | "rocks"; id: string };
  draft: GoalDraft;
}

export interface MigrationPlan {
  goals: PlannedGoal[];
  skipped: Array<{ collection: string; id: string; reason: string }>;
  warnings: string[];
}

function resolveYear(
  value: number | null | undefined,
  legacyPlanYear: number
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : legacyPlanYear;
}

/**
 * A legacy priority has no quarterly targets of its own, so completion is
 * inferred from its rocks: a quarter counts as done when every rock scheduled
 * in it is complete.
 */
export function quartersFromRocks(rocks: LegacyRock[]): GoalQuarter[] {
  const base = emptyQuarters();
  if (rocks.length === 0) return base;

  const byQuarter = new Map<Quarter, LegacyRock[]>();
  rocks.forEach((rock) => {
    const quarter = toQuarter(rock.quarter);
    byQuarter.set(quarter, [...(byQuarter.get(quarter) ?? []), rock]);
  });

  return base.map((entry) => {
    const inQuarter = byQuarter.get(entry.quarter) ?? [];
    if (inQuarter.length === 0) return entry;
    return {
      ...entry,
      complete: inQuarter.every(
        (rock) => normalizeRockStatus(rock.status) === "complete"
      ),
    };
  });
}

export function quartersForRock(rock: LegacyRock): GoalQuarter[] {
  const target = toQuarter(rock.quarter);
  const isComplete = normalizeRockStatus(rock.status) === "complete";
  return QUARTERS.map((quarter) => ({
    quarter,
    target: null,
    actual: null,
    complete: quarter === target ? isComplete : false,
  }));
}

/**
 * Builds the full set of goals to write, without touching Firestore, so the
 * result can be inspected in a dry run and asserted in tests.
 *
 * Legacy data has no department layer, so annual priorities become layer 1 and
 * rocks become layer 3 parented directly to their priority. Layer 2 department
 * goals are authored by hand afterwards and the layer 3 goals re-parented.
 */
export function planMigration(input: MigrationInput): MigrationPlan {
  const {
    planYear,
    legacyPlanYear,
    priorities,
    rocks,
    companyId,
    departmentByUserId = {},
    userIdByName = {},
  } = input;

  const goals: PlannedGoal[] = [];
  const skipped: MigrationPlan["skipped"] = [];
  const warnings: string[] = [];

  const rocksByPriority = new Map<string, LegacyRock[]>();
  rocks.forEach((rock) => {
    if (!rock.priorityId) return;
    rocksByPriority.set(rock.priorityId, [
      ...(rocksByPriority.get(rock.priorityId) ?? []),
      rock,
    ]);
  });

  const annualKeyByPriorityId = new Map<string, string>();

  priorities.forEach((priority, index) => {
    if (priority.type === "capability") {
      skipped.push({
        collection: "priorities",
        id: priority.id,
        reason: "Capability, not an annual priority. Left in place.",
      });
      return;
    }

    const year = resolveYear(priority.planYear, legacyPlanYear);
    if (year !== planYear) {
      skipped.push({
        collection: "priorities",
        id: priority.id,
        reason: `Belongs to plan year ${year}, not ${planYear}.`,
      });
      return;
    }

    if (!priority.title?.trim()) {
      skipped.push({
        collection: "priorities",
        id: priority.id,
        reason: "No title.",
      });
      return;
    }

    const key = `priority:${priority.id}`;
    annualKeyByPriorityId.set(priority.id, key);

    const ownerName = priority.owner || priority.ownerName || "";
    const ownerId = userIdByName[ownerName] ?? "";
    if (ownerName && !ownerId) {
      warnings.push(
        `Priority "${priority.title}" has owner "${ownerName}" with no matching user account. Owner left unset.`
      );
    }

    const linkedRocks = rocksByPriority.get(priority.id) ?? [];

    goals.push({
      key,
      parentKey: null,
      source: { collection: "priorities", id: priority.id },
      draft: {
        title: priority.title.trim(),
        description:
          priority.description?.trim() || priority.successStatement?.trim() || "",
        level: "annual",
        parentGoalId: null,
        departmentId: null,
        ownerId,
        ownerName,
        contributorIds: [],
        startDate: "",
        dueDate: priority.dueDate ?? "",
        planYear,
        measurement: defaultMeasurement(),
        quarters: quartersFromRocks(linkedRocks),
        status: "not_started",
        sortOrder: priority.sortOrder ?? index,
        companyId,
        createdAt: priority.createdAt,
        migratedFrom: {
          collection: "priorities",
          id: priority.id,
          migratedAt: new Date().toISOString(),
        },
      },
    });
  });

  rocks.forEach((rock, index) => {
    const year = resolveYear(rock.year, legacyPlanYear);
    if (year !== planYear) {
      skipped.push({
        collection: "rocks",
        id: rock.id,
        reason: `Belongs to plan year ${year}, not ${planYear}.`,
      });
      return;
    }

    const label = rockLabel({ text: rock.text ?? "", title: rock.title });
    if (!label.trim()) {
      skipped.push({ collection: "rocks", id: rock.id, reason: "No text." });
      return;
    }

    const parentKey = rock.priorityId
      ? annualKeyByPriorityId.get(rock.priorityId) ?? null
      : null;

    if (rock.priorityId && !parentKey) {
      warnings.push(
        `Rock "${label}" points at priority ${rock.priorityId}, which was not migrated. It will be created unparented.`
      );
    }

    const ownerId = rock.assigneeId ?? "";

    goals.push({
      key: `rock:${rock.id}`,
      parentKey,
      source: { collection: "rocks", id: rock.id },
      draft: {
        title: label.trim(),
        description: "",
        level: "individual",
        parentGoalId: null,
        departmentId: ownerId ? departmentByUserId[ownerId] ?? null : null,
        ownerId,
        ownerName: rock.assigneeName ?? "",
        contributorIds: [],
        startDate: rock.startDate ?? "",
        dueDate: "",
        planYear,
        measurement: defaultMeasurement(),
        quarters: quartersForRock(rock),
        status:
          normalizeRockStatus(rock.status) === "complete"
            ? "complete"
            : "not_started",
        sortOrder: index,
        companyId,
        createdAt: rock.createdAt,
        migratedFrom: {
          collection: "rocks",
          id: rock.id,
          migratedAt: new Date().toISOString(),
        },
      },
    });
  });

  const unparented = goals.filter(
    (g) => g.draft.level === "individual" && !g.parentKey
  ).length;
  if (unparented > 0) {
    warnings.push(
      `${unparented} individual goal(s) have no parent. Create department goals and re-parent them to restore rollups.`
    );
  }

  if (goals.some((g) => g.draft.level === "annual")) {
    warnings.push(
      "Legacy data has no department layer. Layer 2 department goals must be created by hand, then individual goals re-parented onto them."
    );
  }

  return { goals, skipped, warnings };
}

export interface MigrationSummary {
  annual: number;
  department: number;
  individual: number;
  total: number;
  skipped: number;
  warnings: number;
}

export function summarizePlan(plan: MigrationPlan): MigrationSummary {
  const count = (level: Goal["level"]) =>
    plan.goals.filter((g) => g.draft.level === level).length;

  return {
    annual: count("annual"),
    department: count("department"),
    individual: count("individual"),
    total: plan.goals.length,
    skipped: plan.skipped.length,
    warnings: plan.warnings.length,
  };
}
