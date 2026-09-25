"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalForm } from "@/components/goals/GoalForm";
import { useGoals } from "@/hooks/use-goals";
import { useDepartments } from "@/hooks/use-departments";
import { useActiveUsers } from "@/hooks/use-active-users";
import { useAuth } from "@/contexts/AuthContext";
import { calculateGoalProgress } from "@/lib/goal-progress";
import { type Goal } from "@/types";
import { Building2, Loader2, PlusIcon, Users } from "lucide-react";

export default function DepartmentGoals() {
  const { user } = useAuth();
  const { departments, loading: departmentsLoading } = useDepartments();
  const { allGoals, loading: goalsLoading } = useGoals();
  const { users } = useActiveUsers();

  const [selectedId, setSelectedId] = useState<string>("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  const myDepartmentId = useMemo(
    () => users.find((u) => u.id === user?.uid)?.departmentId ?? "",
    [users, user?.uid]
  );

  // Land people on their own department rather than an arbitrary first one.
  useEffect(() => {
    if (selectedId || departments.length === 0) return;
    const preferred =
      departments.find((d) => d.id === myDepartmentId) ??
      departments.find((d) => d.leaderId === user?.uid) ??
      departments[0];
    setSelectedId(preferred.id);
  }, [departments, myDepartmentId, selectedId, user?.uid]);

  const department = departments.find((d) => d.id === selectedId);

  const departmentGoals = useMemo(
    () =>
      allGoals.filter(
        (g) => g.level === "department" && g.departmentId === selectedId
      ),
    [allGoals, selectedId]
  );

  const individualGoals = useMemo(
    () =>
      allGoals.filter(
        (g) => g.level === "individual" && g.departmentId === selectedId
      ),
    [allGoals, selectedId]
  );

  const members = useMemo(
    () => users.filter((u) => u.departmentId === selectedId),
    [users, selectedId]
  );

  const summary = useMemo(() => {
    if (departmentGoals.length === 0) {
      return { percent: 0, met: 0, atRisk: 0 };
    }
    const progresses = departmentGoals.map(calculateGoalProgress);
    return {
      percent: Math.round(
        progresses.reduce((sum, p) => sum + p.percent, 0) / progresses.length
      ),
      met: progresses.filter((p) => p.met).length,
      atRisk: departmentGoals.filter((g) => g.status === "at_risk").length,
    };
  }, [departmentGoals]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  if (departmentsLoading || goalsLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (departments.length === 0) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>No departments yet</CardTitle>
          <CardDescription>
            An admin needs to create departments before department goals can
            exist. Departments are managed under Admin.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Department Goals
          </h2>
          <p className="text-muted-foreground text-sm">
            Layer 2 goals and the individual goals beneath them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreate}>
            <PlusIcon className="w-4 h-4 mr-2" />
            Department Goal
          </Button>
        </div>
      </div>

      {department && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                  /{departmentGoals.length}
                </span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">At risk</p>
              <p
                className={`text-2xl font-bold tabular-nums ${
                  summary.atRisk > 0 ? "text-amber-600" : ""
                }`}
              >
                {summary.atRisk}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" />
                People
              </p>
              <p className="text-2xl font-bold tabular-nums">{members.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {department?.name} goals
            {department?.leaderName && (
              <Badge variant="outline" className="ml-2 font-normal">
                Led by {department.leaderName}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {departmentGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No department goals yet.
            </p>
          ) : (
            departmentGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={(g) => {
                  setEditing(g);
                  setFormOpen(true);
                }}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Individual goals in this department
          </CardTitle>
          <CardDescription>
            These give visibility into what the team is working on. They do not
            change the department percentage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {individualGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No individual goals in this department yet.
            </p>
          ) : (
            individualGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                compact
                onEdit={(g) => {
                  setEditing(g);
                  setFormOpen(true);
                }}
              />
            ))
          )}
        </CardContent>
      </Card>

      <GoalForm
        open={formOpen}
        onOpenChange={setFormOpen}
        goal={editing}
        defaultLevel="department"
        defaultDepartmentId={selectedId}
      />
    </div>
  );
}
