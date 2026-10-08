"use client";

import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/hooks/use-departments";
import { isRaciMember, type Goal, type Rock } from "@/types";

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
      if (isRaciMember(goal, user.uid)) return true;
      return isLeaderOf(user.uid, goal.departmentId);
    },
    [user, hasRole, isLeaderOf]
  );

  /**
   * A rock inherits the department of the goal it hangs off, so the goal has
   * to be passed in for the department-leader branch to work.
   */
  const canEditRock = useCallback(
    (rock?: Rock | null, goal?: Goal | null) => {
      if (!rock || !user) return false;
      if (hasRole("admin")) return true;
      if (isRaciMember(rock, user.uid)) return true;
      if (rock.assigneeId === user.uid) return true;
      return isLeaderOf(user.uid, goal?.departmentId);
    },
    [user, hasRole, isLeaderOf]
  );

  return { canEditGoal, canEditRock };
}
