import {
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
  goalId?: string;
  assigneeId?: string;
  assigneeName?: string;
  startDate?: string;
  createdAt?: string;
}

export interface MigrationInput {
  companyId: string;
  /** Every plan year to convert. Priorities outside these years are skipped. */
  planYears: number[];
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
  source: { collection: "priorities"; id: string };
  draft: GoalDraft;
}

/**
 * Rocks are tasks, not goals. The conversion leaves each one in place and only
 * repoints it from the priority it hung off onto the goal that priority became.
 */
export interface PlannedRockUpdate {
  rockId: string;
  /** Goal key, resolved to a real document id once the goals are written. */
  goalKey: string;
  /** Accountable, backfilled from the legacy single assignee. */
  ownerId: string;
  ownerName: string;
  /** Responsible. The old assignee was the person doing the work. */
  contributorIds: string[];
}

export interface MigrationPlan {
  goals: PlannedGoal[];
  rockUpdates: PlannedRockUpdate[];
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

/**
 * Builds the full set of writes, without touching Firestore, so the result can
 * be inspected in a dry run and asserted in tests.
 *
 * Annual priorities become layer 1 goals. Capabilities stay in the priorities
 * collection untouched. Rocks stay rocks and are only repointed onto the goal
 * their priority became. Layer 2 department goals are authored by hand
 * afterwards.
 */
export function planMigration(input: MigrationInput): MigrationPlan {
  const {
    planYears,
    legacyPlanYear,
    priorities,
    rocks,
    companyId,
    userIdByName = {},
  } = input;

  const goals: PlannedGoal[] = [];
  const rockUpdates: PlannedRockUpdate[] = [];
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
  const capabilityIds = new Set<string>();

  priorities.forEach((priority, index) => {
    if (priority.type === "capability") {
      capabilityIds.add(priority.id);
      skipped.push({
        collection: "priorities",
        id: priority.id,
        reason: "Capability, not an annual priority. Left in place.",
      });
      return;
    }

    const year = resolveYear(priority.planYear, legacyPlanYear);
    if (!planYears.includes(year)) {
      skipped.push({
        collection: "priorities",
        id: priority.id,
        reason: `Belongs to plan year ${year}, which was not requested.`,
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
        consultedIds: [],
        informedIds: [],
        startDate: "",
        dueDate: priority.dueDate ?? "",
        planYear: year,
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

  rocks.forEach((rock) => {
    const label = rockLabel({ text: rock.text ?? "", title: rock.title });

    if (!rock.priorityId) {
      skipped.push({
        collection: "rocks",
        id: rock.id,
        reason: "Not linked to a priority. Left as a standalone rock.",
      });
      return;
    }

    if (capabilityIds.has(rock.priorityId)) {
      skipped.push({
        collection: "rocks",
        id: rock.id,
        reason: "Belongs to a capability, which stays in the priorities collection.",
      });
      return;
    }

    const goalKey = annualKeyByPriorityId.get(rock.priorityId);
    if (!goalKey) {
      warnings.push(
        `Rock "${label}" points at priority ${rock.priorityId}, which was not converted. Its link is left as-is.`
      );
      skipped.push({
        collection: "rocks",
        id: rock.id,
        reason: "Parent priority was not converted.",
      });
      return;
    }

    const ownerId = rock.assigneeId ?? "";
    rockUpdates.push({
      rockId: rock.id,
      goalKey,
      ownerId,
      ownerName: rock.assigneeName ?? "",
      // The single assignee both owned and did the work, so they land in
      // Accountable and Responsible. Editable afterwards.
      contributorIds: ownerId ? [ownerId] : [],
    });
  });

  if (goals.length > 0) {
    warnings.push(
      "Legacy data has no department layer. Layer 2 department goals must be created by hand, then the annual priorities' children re-parented onto them."
    );
  }

  return { goals, rockUpdates, skipped, warnings };
}

export interface MigrationSummary {
  annual: number;
  department: number;
  individual: number;
  total: number;
  rocksRepointed: number;
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
    rocksRepointed: plan.rockUpdates.length,
    skipped: plan.skipped.length,
    warnings: plan.warnings.length,
  };
}
