"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalForm } from "@/components/goals/GoalForm";
import { useGoals } from "@/hooks/use-goals";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanYear } from "@/contexts/PlanYearContext";
import { calculateGoalProgress, currentQuarter } from "@/lib/goal-progress";
import { type Goal } from "@/types";
import { Loader2, PlusIcon, TargetIcon } from "lucide-react";

export default function MyGoals() {
  const { user } = useAuth();
  const { selectedYear } = usePlanYear();
  const { allGoals, loading, byId } = useGoals();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  const myGoals = useMemo(
    () =>
      allGoals.filter(
        (g) =>
          g.ownerId === user?.uid ||
          (g.contributorIds ?? []).includes(user?.uid ?? "")
      ),
    [allGoals, user?.uid]
  );

  const owned = myGoals.filter((g) => g.ownerId === user?.uid);
  const contributing = myGoals.filter((g) => g.ownerId !== user?.uid);

  const summary = useMemo(() => {
    if (owned.length === 0) return { percent: 0, met: 0 };
    const progresses = owned.map(calculateGoalProgress);
    return {
      percent: Math.round(
        progresses.reduce((sum, p) => sum + p.percent, 0) / progresses.length
      ),
      met: progresses.filter((p) => p.met).length,
    };
  }, [owned]);

  const thisQuarter = currentQuarter();
  const dueThisQuarter = owned.filter((goal) => {
    const entry = goal.quarters?.find((q) => q.quarter === thisQuarter);
    return entry && !entry.complete;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TargetIcon className="w-6 h-6" />
            My Goals
          </h2>
          <p className="text-muted-foreground text-sm">
            Everything you own or contribute to in {selectedYear}.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          New Goal
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Average progress</p>
            <p className="text-2xl font-bold tabular-nums">{summary.percent}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Goals met</p>
            <p className="text-2xl font-bold tabular-nums">
              {summary.met}
              <span className="text-base text-muted-foreground">
                /{owned.length}
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">
              Open in {thisQuarter}
            </p>
            <p className="text-2xl font-bold tabular-nums">
              {dueThisQuarter.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Goals I own</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {owned.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              You do not own any goals for {selectedYear} yet.
            </p>
          ) : (
            owned.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                showLevel
                defaultExpanded={owned.length <= 3}
                onEdit={(g) => {
                  setEditing(g);
                  setFormOpen(true);
                }}
              />
            ))
          )}
        </CardContent>
      </Card>

      {contributing.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Goals I contribute to</CardTitle>
            <CardDescription>
              Owned by someone else. You can still update them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {contributing.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                showLevel
                compact
                onEdit={(g) => {
                  setEditing(g);
                  setFormOpen(true);
                }}
              />
            ))}
          </CardContent>
        </Card>
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
