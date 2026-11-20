"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { usePlanYear } from "@/contexts/PlanYearContext";
import { teamLeaderIds, type Team } from "@/types";

export function useTeams() {
  const { companyId } = usePlanYear();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "companies", companyId, "teams"),
      (snapshot) => {
        const items: Team[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        items.sort(
          (a, b) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            (a.name || "").localeCompare(b.name || "")
        );
        setTeams(items);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  const byId = useMemo(
    () => new Map(teams.map((d) => [d.id, d])),
    [teams]
  );

  const getName = useCallback(
    (teamId?: string | null) =>
      teamId ? byId.get(teamId)?.name ?? "Unassigned" : "Unassigned",
    [byId]
  );

  const isLeaderOf = useCallback(
    (userId: string | undefined, teamId?: string | null) =>
      Boolean(
        userId &&
          teamId &&
          teamLeaderIds(byId.get(teamId)).includes(userId)
      ),
    [byId]
  );

  const teamsLedBy = useCallback(
    (userId?: string) =>
      userId
        ? teams.filter((d) => teamLeaderIds(d).includes(userId))
        : [],
    [teams]
  );

  return { teams, loading, byId, getName, isLeaderOf, teamsLedBy };
}
