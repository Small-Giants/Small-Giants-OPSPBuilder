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
import { useTeams } from "@/hooks/use-teams";
import { useActiveUsers } from "@/hooks/use-active-users";
import { useAuth } from "@/contexts/AuthContext";
import { calculateGoalProgress } from "@/lib/goal-progress";
import { teamLeaderIds, type Goal } from "@/types";
import { Building2, Loader2, PlusIcon, Users } from "lucide-react";

export default function TeamGoals() {
  const { user } = useAuth();
  const { teams, loading: teamsLoading } = useTeams();
  const { allGoals, loading: goalsLoading } = useGoals();
  const { users } = useActiveUsers();

  const [selectedId, setSelectedId] = useState<string>("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  const myTeamId = useMemo(
    () => users.find((u) => u.id === user?.uid)?.teamId ?? "",
    [users, user?.uid]
  );

  // Land people on their own team rather than an arbitrary first one.
  useEffect(() => {
    if (selectedId || teams.length === 0) return;
    const preferred =
      teams.find((d) => d.id === myTeamId) ??
      teams.find((d) => teamLeaderIds(d).includes(user?.uid ?? "")) ??
      teams[0];
    setSelectedId(preferred.id);
  }, [teams, myTeamId, selectedId, user?.uid]);

  const team = teams.find((d) => d.id === selectedId);

  const teamGoals = useMemo(
    () =>
      allGoals.filter(
        (g) => g.level === "team" && g.teamId === selectedId
      ),
    [allGoals, selectedId]
  );

  const individualGoals = useMemo(
    () =>
      allGoals.filter(
        (g) => g.level === "individual" && g.teamId === selectedId
      ),
    [allGoals, selectedId]
  );

  const members = useMemo(
    () => users.filter((u) => u.teamId === selectedId),
    [users, selectedId]
  );

  const summary = useMemo(() => {
    if (teamGoals.length === 0) {
      return { percent: 0, met: 0, atRisk: 0 };
    }
    const progresses = teamGoals.map(calculateGoalProgress);
    return {
      percent: Math.round(
        progresses.reduce((sum, p) => sum + p.percent, 0) / progresses.length
      ),
      met: progresses.filter((p) => p.met).length,
      atRisk: teamGoals.filter((g) => g.status === "at_risk").length,
    };
  }, [teamGoals]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  if (teamsLoading || goalsLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>No teams yet</CardTitle>
          <CardDescription>
            An admin needs to create teams before team goals can
            exist. Teams are managed under Admin.
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
            Team Goals
          </h2>
          <p className="text-muted-foreground text-sm">
            Layer 2 goals and the individual goals beneath them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a team" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreate}>
            <PlusIcon className="w-4 h-4 mr-2" />
            Team Goal
          </Button>
        </div>
      </div>

      {team && (
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
                  /{teamGoals.length}
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
            {team?.name} goals
            {team?.leaderName && (
              <Badge variant="outline" className="ml-2 font-normal">
                Led by {team.leaderName}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {teamGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No team goals yet.
            </p>
          ) : (
            teamGoals.map((goal) => (
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
            Individual goals in this team
          </CardTitle>
          <CardDescription>
            These give visibility into what the team is working on. They do not
            change the team percentage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {individualGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No individual goals in this team yet.
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
        defaultLevel="team"
        defaultTeamId={selectedId}
      />
    </div>
  );
}
