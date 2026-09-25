"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { usePlanYear } from "@/contexts/PlanYearContext";
import type { Department } from "@/types";

export function useDepartments() {
  const { companyId } = usePlanYear();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "companies", companyId, "departments"),
      (snapshot) => {
        const items: Department[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        items.sort(
          (a, b) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            (a.name || "").localeCompare(b.name || "")
        );
        setDepartments(items);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  const byId = useMemo(
    () => new Map(departments.map((d) => [d.id, d])),
    [departments]
  );

  const getName = useCallback(
    (departmentId?: string | null) =>
      departmentId ? byId.get(departmentId)?.name ?? "Unassigned" : "Unassigned",
    [byId]
  );

  const isLeaderOf = useCallback(
    (userId: string | undefined, departmentId?: string | null) =>
      Boolean(userId && departmentId && byId.get(departmentId)?.leaderId === userId),
    [byId]
  );

  const departmentsLedBy = useCallback(
    (userId?: string) =>
      userId ? departments.filter((d) => d.leaderId === userId) : [],
    [departments]
  );

  return { departments, loading, byId, getName, isLeaderOf, departmentsLedBy };
}
