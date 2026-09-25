"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalForm } from "@/components/goals/GoalForm";
import { useGoals } from "@/hooks/use-goals";
import { useActiveUsers } from "@/hooks/use-active-users";
import { useDepartments } from "@/hooks/use-departments";
import { useAuth } from "@/contexts/AuthContext";
import { calculateGoalProgress } from "@/lib/goal-progress";
import { type Goal } from "@/types";
import { Loader2, UsersIcon } from "lucide-react";

export default function TeamGoals() {
  const { user } = useAuth();
  const { users, loading: usersLoading } = useActiveUsers();
  const { departmentsLedBy, loading: departmentsLoading } = useDepartments();
  const { allGoals, loading: goalsLoading } = useGoals();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  const ledDepartmentIds = useMemo(
    () => departmentsLedBy(user?.uid).map((d) => d.id),
    [departmentsLedBy, user?.uid]
  );

  /**
   * A person is on your team if they report to you directly, or if they sit in
   * a department you lead.
   */
  const teamMembers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.id !== user?.uid &&
          (u.managerId === user?.uid ||
            (u.departmentId && ledDepartmentIds.includes(u.departmentId)))
      ),
    [users, user?.uid, ledDepartmentIds]
  );

  const goalsByOwner = useMemo(() => {
    const map = new Map<string, Goal[]>();
    allGoals.forEach((goal) => {
      if (!goal.ownerId) return;
      map.set(goal.ownerId, [...(map.get(goal.ownerId) ?? []), goal]);
    });
    return map;
  }, [allGoals]);

  const loading = usersLoading || departmentsLoading || goalsLoading;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <UsersIcon className="w-6 h-6" />
          My Team
        </h2>
        <p className="text-muted-foreground text-sm">
          Goals owned by people who report to you or sit in a department you
          lead.
        </p>
      </div>

      {teamMembers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Nobody reports to you and you do not lead a department, so there
              is nothing to show here.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Reporting lines and department leadership are set by an admin.
            </p>
          </CardContent>
        </Card>
      ) : (
        teamMembers.map((member) => {
          const goals = goalsByOwner.get(member.id) ?? [];
          const progresses = goals.map(calculateGoalProgress);
          const average = progresses.length
            ? Math.round(
                progresses.reduce((sum, p) => sum + p.percent, 0) /
                  progresses.length
              )
            : 0;

          return (
            <Card key={member.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {member.name || member.email}
                    </CardTitle>
                    <CardDescription>
                      {goals.length} goal{goals.length === 1 ? "" : "s"}
                    </CardDescription>
                  </div>
                  {goals.length > 0 && (
                    <Badge variant="secondary" className="tabular-nums">
                      {average}%
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {goals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No goals set yet.
                  </p>
                ) : (
                  goals.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      compact
                      showLevel
                      onEdit={(g) => {
                        setEditing(g);
                        setFormOpen(true);
                      }}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      <GoalForm
        open={formOpen}
        onOpenChange={setFormOpen}
        goal={editing}
        defaultLevel="individual"
      />
    </div>
  );
}
