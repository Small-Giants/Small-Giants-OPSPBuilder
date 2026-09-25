import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  emptyQuarters,
  defaultMeasurement,
  smartToDescription,
  type Goal,
  type GoalDraft,
  type GoalLevel,
  type GoalQuarter,
  type Quarter,
  type SmartDescription,
} from "@/types";

export function goalsCollection(companyId: string) {
  return collection(db, "companies", companyId, "goals");
}

export function goalDoc(companyId: string, goalId: string) {
  return doc(db, "companies", companyId, "goals", goalId);
}

/** Strips undefined values, which Firestore rejects outright. */
function scrub<T extends Record<string, any>>(value: T): T {
  const out: Record<string, any> = {};
  Object.entries(value).forEach(([key, v]) => {
    if (v === undefined) return;
    out[key] = v;
  });
  return out as T;
}

export function newGoalDraft(params: {
  level: GoalLevel;
  planYear: number;
  companyId: string;
  ownerId?: string;
  ownerName?: string;
  departmentId?: string | null;
  parentGoalId?: string | null;
  sortOrder?: number;
}): GoalDraft {
  return {
    title: "",
    description: "",
    smart: undefined,
    level: params.level,
    parentGoalId: params.parentGoalId ?? null,
    departmentId: params.departmentId ?? null,
    ownerId: params.ownerId ?? "",
    ownerName: params.ownerName ?? "",
    contributorIds: [],
    startDate: "",
    dueDate: "",
    planYear: params.planYear,
    measurement: defaultMeasurement(),
    quarters: emptyQuarters(),
    status: "not_started",
    sortOrder: params.sortOrder ?? 0,
    companyId: params.companyId,
  };
}

export async function createGoal(
  companyId: string,
  draft: GoalDraft,
  createdBy?: string
): Promise<string> {
  const payload = scrub({
    ...draft,
    description: draft.smart
      ? smartToDescription(draft.smart)
      : draft.description ?? "",
    companyId,
    createdBy: createdBy ?? "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const ref = await addDoc(goalsCollection(companyId), payload);
  return ref.id;
}

export async function updateGoal(
  companyId: string,
  goalId: string,
  updates: Partial<Goal>,
  updatedBy?: string
): Promise<void> {
  const { id: _id, ...rest } = updates as Partial<Goal> & { id?: string };
  const payload = scrub({
    ...rest,
    ...(rest.smart ? { description: smartToDescription(rest.smart) } : {}),
    updatedAt: new Date().toISOString(),
    // Read by the notification trigger so people are not told about their own
    // edits.
    updatedBy: updatedBy ?? rest.updatedBy,
  });

  await updateDoc(goalDoc(companyId, goalId), payload);
}

export async function updateGoalQuarter(
  companyId: string,
  goal: Goal,
  quarter: Quarter,
  changes: Partial<Omit<GoalQuarter, "quarter">>,
  updatedBy?: string
): Promise<void> {
  const quarters = (goal.quarters ?? emptyQuarters()).map((q) =>
    q.quarter === quarter
      ? scrub({
          ...q,
          ...changes,
          updatedAt: new Date().toISOString(),
          updatedBy: updatedBy ?? q.updatedBy ?? "",
        })
      : q
  );

  await updateGoal(companyId, goal.id, { quarters }, updatedBy);
}

/**
 * Deleting a parent would otherwise orphan its children and silently remove
 * them from every rollup, so children are re-pointed at the deleted goal's
 * own parent instead.
 */
export async function deleteGoal(
  companyId: string,
  goalId: string,
  parentGoalId: string | null = null
): Promise<number> {
  const children = await getDocs(
    query(goalsCollection(companyId), where("parentGoalId", "==", goalId))
  );

  if (!children.empty) {
    const batch = writeBatch(db);
    children.forEach((child) => {
      batch.update(child.ref, {
        parentGoalId,
        updatedAt: new Date().toISOString(),
      });
    });
    await batch.commit();
  }

  await deleteDoc(goalDoc(companyId, goalId));
  return children.size;
}

export async function reorderGoals(
  companyId: string,
  orderedIds: string[]
): Promise<void> {
  const batch = writeBatch(db);
  orderedIds.forEach((goalId, index) => {
    batch.update(goalDoc(companyId, goalId), { sortOrder: index });
  });
  await batch.commit();
}

export function buildSmart(
  partial: Partial<SmartDescription> | undefined
): SmartDescription {
  return {
    specific: partial?.specific ?? "",
    measurable: partial?.measurable ?? "",
    achievable: partial?.achievable ?? "",
    relevant: partial?.relevant ?? "",
    timeBound: partial?.timeBound ?? "",
  };
}

export function groupGoalsByLevel(goals: Goal[]): Record<GoalLevel, Goal[]> {
  return {
    annual: goals.filter((g) => g.level === "annual"),
    department: goals.filter((g) => g.level === "department"),
    individual: goals.filter((g) => g.level === "individual"),
  };
}

export function childrenOf(goals: Goal[], parentGoalId: string): Goal[] {
  return goals
    .filter((g) => g.parentGoalId === parentGoalId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}
