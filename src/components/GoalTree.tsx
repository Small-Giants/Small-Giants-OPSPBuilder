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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalForm } from "@/components/goals/GoalForm";
import { AnnualRollup } from "@/components/goals/GoalProgress";
import { useGoals } from "@/hooks/use-goals";
import { useDepartments } from "@/hooks/use-departments";
import { usePlanYear } from "@/contexts/PlanYearContext";
import { GOAL_LEVEL_LABELS, type Goal, type GoalLevel } from "@/types";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  PlusIcon,
  SearchIcon,
  TargetIcon,
} from "lucide-react";

export default function GoalTree() {
  const { selectedYear } = usePlanYear();
  const { allGoals, loading, childrenOf } = useGoals();
  const { getName } = useDepartments();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [formLevel, setFormLevel] = useState<GoalLevel>("annual");
  const [formParent, setFormParent] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  const annualGoals = useMemo(
    () => allGoals.filter((g) => g.level === "annual"),
    [allGoals]
  );

  const orphans = useMemo(
    () =>
      allGoals.filter(
        (g) =>
          g.level !== "annual" &&
          (!g.parentGoalId || !allGoals.some((p) => p.id === g.parentGoalId))
      ),
    [allGoals]
  );

  const matches = (goal: Goal) =>
    !search.trim() ||
    goal.title.toLowerCase().includes(search.toLowerCase()) ||
    (goal.ownerName ?? "").toLowerCase().includes(search.toLowerCase());

  const openCreate = (level: GoalLevel, parentGoalId: string | null) => {
    setEditing(null);
    setFormLevel(level);
    setFormParent(parentGoalId);
    setFormOpen(true);
  };

  const openEdit = (goal: Goal) => {
    setEditing(goal);
    setFormLevel(goal.level);
    setFormParent(goal.parentGoalId ?? null);
    setFormOpen(true);
  };

  const toggle = (goalId: string) =>
    setCollapsed((prev) => ({ ...prev, [goalId]: !prev[goalId] }));

  const renderChildren = (parent: Goal, depth: number) => {
    const children = childrenOf.get(parent.id) ?? [];
    if (children.length === 0) return null;
    if (collapsed[parent.id]) return null;

    return (
      <div
        className="space-y-2 mt-2 border-l-2 border-muted pl-4"
        style={{ marginLeft: depth * 4 }}
      >
        {children.filter(matches).map((child) => (
          <div key={child.id}>
            <GoalCard goal={child} onEdit={openEdit} showLevel compact />
            {renderChildren(child, depth + 1)}
            {child.level === "department" && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 text-xs text-muted-foreground"
                onClick={() => openCreate("individual", child.id)}
              >
                <PlusIcon className="w-3 h-3 mr-1" />
                Add individual goal
              </Button>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TargetIcon className="w-6 h-6" />
            Company Goals
          </h2>
          <p className="text-muted-foreground text-sm">
            Annual priorities, the department goals beneath them, and individual
            goals, for {selectedYear}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <SearchIcon className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search goals or owners"
              className="pl-8 w-56"
            />
          </div>
          <Button onClick={() => openCreate("annual", null)}>
            <PlusIcon className="w-4 h-4 mr-2" />
            Annual Priority
          </Button>
        </div>
      </div>

      {annualGoals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-muted-foreground">
              No annual priorities yet for {selectedYear}.
            </p>
            <Button onClick={() => openCreate("annual", null)}>
              <PlusIcon className="w-4 h-4 mr-2" />
              Create the first one
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {annualGoals.filter(matches).map((annual) => {
            const departmentGoals = childrenOf.get(annual.id) ?? [];

            return (
              <Card key={annual.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => toggle(annual.id)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={collapsed[annual.id] ? "Expand" : "Collapse"}
                        >
                          {collapsed[annual.id] ? (
                            <ChevronRight className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        <CardTitle className="text-lg">{annual.title}</CardTitle>
                        <Badge variant="outline" className="text-[10px]">
                          {GOAL_LEVEL_LABELS.annual}
                        </Badge>
                      </div>
                      {annual.description && (
                        <CardDescription className="mt-1.5">
                          {annual.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(annual)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCreate("department", annual.id)}
                      >
                        <PlusIcon className="w-3.5 h-3.5 mr-1" />
                        Department Goal
                      </Button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <AnnualRollup children={departmentGoals} />
                  </div>
                </CardHeader>

                {!collapsed[annual.id] && departmentGoals.length > 0 && (
                  <CardContent className="pt-0">
                    {renderChildren(annual, 0)}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {orphans.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base">Not linked to a priority</CardTitle>
            <CardDescription>
              These goals do not roll up anywhere, so they are invisible to
              leadership reporting. Edit each one to give it a parent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {orphans.filter(matches).map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={openEdit}
                showLevel
                compact
              />
            ))}
          </CardContent>
        </Card>
      )}

      <GoalForm
        open={formOpen}
        onOpenChange={setFormOpen}
        goal={editing}
        defaultLevel={formLevel}
        defaultParentGoalId={formParent}
      />
    </div>
  );
}
