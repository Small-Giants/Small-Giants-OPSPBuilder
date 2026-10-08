"use client";

import { useEffect, useMemo, useState } from "react";
import { onSnapshot, query, where } from "firebase/firestore";
import { LEGACY_PLAN_YEAR, usePlanYear } from "@/contexts/PlanYearContext";
import { rocksCollection } from "@/lib/rocks";
import { normalizeRockStatus, rockGoalId, toQuarter, type Rock } from "@/types";

function hydrate(id: string, data: any): Rock {
  return {
    ...data,
    id,
    quarter: toQuarter(data.quarter),
    status: normalizeRockStatus(data.status),
    contributorIds: Array.isArray(data.contributorIds)
      ? data.contributorIds
      : // Pre-RACI documents stored one assignee, who was doing the work.
        [data.assigneeId].filter(Boolean),
    consultedIds: Array.isArray(data.consultedIds) ? data.consultedIds : [],
    informedIds: Array.isArray(data.informedIds) ? data.informedIds : [],
  };
}

/**
 * Every rock for the selected plan year. Rocks are joined to goals in memory
 * by `goalId`, which keeps the query single-field and avoids an index.
 */
export function useRocks() {
  const { companyId, selectedYear } = usePlanYear();
  const [rocks, setRocks] = useState<Rock[]>([]);
  const [legacyRocks, setLegacyRocks] = useState<Rock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      query(rocksCollection(companyId), where("year", "==", selectedYear)),
      (snapshot) => {
        const items: Rock[] = [];
        snapshot.forEach((d) => items.push(hydrate(d.id, d.data())));
        setRocks(items);
        setLoading(false);
      },
      () => {
        setRocks([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [companyId, selectedYear]);

  // Documents written before the year field existed belong to the legacy year.
  useEffect(() => {
    if (selectedYear !== LEGACY_PLAN_YEAR) {
      setLegacyRocks([]);
      return;
    }
    const unsubscribe = onSnapshot(
      query(rocksCollection(companyId), where("year", "==", null)),
      (snapshot) => {
        const items: Rock[] = [];
        snapshot.forEach((d) => items.push(hydrate(d.id, d.data())));
        setLegacyRocks(items);
      },
      () => setLegacyRocks([])
    );
    return () => unsubscribe();
  }, [companyId, selectedYear]);

  const allRocks = useMemo(
    () => [...rocks, ...legacyRocks],
    [rocks, legacyRocks]
  );

  const byGoal = useMemo(() => {
    const map = new Map<string, Rock[]>();
    allRocks.forEach((rock) => {
      const goalId = rockGoalId(rock);
      if (!goalId) return;
      map.set(goalId, [...(map.get(goalId) ?? []), rock]);
    });
    return map;
  }, [allRocks]);

  return { rocks: allRocks, byGoal, loading };
}
