"use client";

import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTeams } from "@/hooks/use-teams";
import { isRaciMember, type Goal, type Rock } from "@/types";

/**
 * Mirrors the write rule in firestore.rules. Kept in sync by hand: the rules
 * are the real gate, this only decides whether to show editing affordances.
 */
export function useGoalPermissions() {
  const { user, hasRole } = useAuth();
  const { isLeaderOf } = useTeams();

  const canEditGoal = useCallback(
    (goal?: Goal | null) => {
      if (!goal || !user) return false;
      if (hasRole("admin")) return true;
      if (isRaciMember(goal, user.uid)) return true;
      return isLeaderOf(user.uid, goal.teamId);
    },
    [user, hasRole, isLeaderOf]
  );

  /**
   * A rock inherits the team of the goal it hangs off, so the goal has
   * to be passed in for the team-leader branch to work.
   */
  const canEditRock = useCallback(
    (rock?: Rock | null, goal?: Goal | null) => {
      if (!rock || !user) return false;
      if (hasRole("admin")) return true;
      if (isRaciMember(rock, user.uid)) return true;
      if (rock.assigneeId === user.uid) return true;
      return isLeaderOf(user.uid, goal?.teamId);
    },
    [user, hasRole, isLeaderOf]
  );

  return { canEditGoal, canEditRock };
}
