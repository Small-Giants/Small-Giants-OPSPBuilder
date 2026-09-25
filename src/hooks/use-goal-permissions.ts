"use client";

import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/hooks/use-departments";
import type { Goal } from "@/types";

/**
 * Mirrors the write rule in firestore.rules. Kept in sync by hand: the rules
 * are the real gate, this only decides whether to show editing affordances.
 */
export function useGoalPermissions() {
  const { user, hasRole } = useAuth();
  const { isLeaderOf } = useDepartments();

  const canEditGoal = useCallback(
    (goal?: Goal | null) => {
      if (!goal || !user) return false;
      if (hasRole("admin")) return true;
      if (goal.ownerId === user.uid) return true;
      if ((goal.contributorIds ?? []).includes(user.uid)) return true;
      return isLeaderOf(user.uid, goal.departmentId);
    },
    [user, hasRole, isLeaderOf]
  );

  return { canEditGoal };
}
