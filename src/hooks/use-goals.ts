"use client";

import { useEffect, useMemo, useState } from "react";
import { onSnapshot, query, where } from "firebase/firestore";
import { usePlanYear } from "@/contexts/PlanYearContext";
import { goalsCollection } from "@/lib/goals";
import {
  defaultMeasurement,
  emptyQuarters,
  QUARTERS,
  type Goal,
  type GoalLevel,
} from "@/types";

function hydrate(id: string, data: any): Goal {
  const quarters = Array.isArray(data.quarters) && data.quarters.length
    ? QUARTERS.map(
        (quarter) =>
          data.quarters.find((q: any) => q?.quarter === quarter) ?? {
            quarter,
            target: null,
            actual: null,
            complete: false,
          }
      )
    : emptyQuarters();

  return {
    ...data,
    id,
    level: (data.level ?? "individual") as GoalLevel,
    parentGoalId: data.parentGoalId ?? null,
    departmentId: data.departmentId ?? null,
    contributorIds: Array.isArray(data.contributorIds) ? data.contributorIds : [],
    measurement: { ...defaultMeasurement(), ...(data.measurement ?? {}) },
    quarters,
  };
}

export function useGoals(options?: { level?: GoalLevel }) {
  const { companyId, selectedYear } = usePlanYear();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const unsubscribe = onSnapshot(
      query(goalsCollection(companyId), where("planYear", "==", selectedYear)),
      (snapshot) => {
        const items: Goal[] = [];
        snapshot.forEach((docSnap) => {
          items.push(hydrate(docSnap.id, docSnap.data()));
        });
        items.sort(
          (a, b) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            (a.title || "").localeCompare(b.title || "")
        );
        setGoals(items);
        setLoading(false);
      },
      () => {
        setGoals([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId, selectedYear]);

  const filtered = useMemo(
    () => (options?.level ? goals.filter((g) => g.level === options.level) : goals),
    [goals, options?.level]
  );

  const byId = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  const childrenOf = useMemo(() => {
    const map = new Map<string, Goal[]>();
    goals.forEach((goal) => {
      if (!goal.parentGoalId) return;
      const existing = map.get(goal.parentGoalId) ?? [];
      existing.push(goal);
      map.set(goal.parentGoalId, existing);
    });
    map.forEach((list) =>
      list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    );
    return map;
  }, [goals]);

  return { goals: filtered, allGoals: goals, loading, byId, childrenOf };
}
