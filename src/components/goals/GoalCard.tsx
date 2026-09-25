"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { GoalProgressBar, GoalStatusBadge } from "@/components/goals/GoalProgress";
import { QuarterCheckIn } from "@/components/goals/QuarterCheckIn";
import { useToast } from "@/hooks/use-toast";
import { usePlanYear } from "@/contexts/PlanYearContext";
import { useDepartments } from "@/hooks/use-departments";
import { useGoalPermissions } from "@/hooks/use-goal-permissions";
import { deleteGoal } from "@/lib/goals";
import { syncClickUp } from "@/lib/callables";
import { GOAL_LEVEL_LABELS, type Goal } from "@/types";
import {
  CalendarIcon,
  ChevronDown,
  ChevronRight,
  PencilIcon,
  RefreshCw,
  Trash2,
  UserIcon,
} from "lucide-react";

interface GoalCardProps {
  goal: Goal;
  onEdit?: (goal: Goal) => void;
  showLevel?: boolean;
  showCheckIn?: boolean;
  defaultExpanded?: boolean;
  compact?: boolean;
}

export function GoalCard({
  goal,
  onEdit,
  showLevel = false,
  showCheckIn = true,
  defaultExpanded = false,
  compact = false,
}: GoalCardProps) {
  const { toast } = useToast();
  const { companyId } = usePlanYear();
  const { getName } = useDepartments();
  const { canEditGoal } = useGoalPermissions();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [syncing, setSyncing] = useState(false);

  const canEdit = canEditGoal(goal);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncClickUp({ goalId: goal.id });
      toast({
        title: result.goalsUpdated > 0 ? "Pulled from ClickUp" : "Already up to date",
        description:
          result.warnings[0] ??
          (result.goalsUpdated > 0
            ? "Quarter actuals updated from the linked task."
            : "Nothing in ClickUp has changed since the last sync."),
      });
    } catch (error: any) {
      toast({
        title: "Sync failed",
        description: error?.message ?? "Unknown error.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    try {
      const reparented = await deleteGoal(
        companyId,
        goal.id,
        goal.parentGoalId ?? null
      );
      toast({
        title: "Goal deleted",
        description: reparented
          ? `${reparented} child goal${reparented === 1 ? "" : "s"} moved up a level.`
          : goal.title,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete the goal.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="rounded-md border bg-card">
      <div className={compact ? "p-3" : "p-4"}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {showCheckIn && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={expanded ? "Collapse" : "Expand"}
                >
                  {expanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              )}
              <span className="font-medium truncate">{goal.title}</span>
              <GoalStatusBadge goal={goal} />
              {showLevel && (
                <Badge variant="outline" className="text-[10px]">
                  {GOAL_LEVEL_LABELS[goal.level]}
                </Badge>
              )}
            </div>

            {goal.description && !compact && (
              <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
                {goal.description}
              </p>
            )}

            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <UserIcon className="w-3 h-3" />
                {goal.ownerName || "Unassigned"}
              </span>
              {goal.departmentId && <span>{getName(goal.departmentId)}</span>}
              {goal.dueDate && (
                <span className="flex items-center gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  {goal.dueDate}
                </span>
              )}
              {(goal.contributorIds?.length ?? 0) > 0 && (
                <span>
                  +{goal.contributorIds!.length} contributor
                  {goal.contributorIds!.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            <div className="mt-3">
              <GoalProgressBar goal={goal} showDetail={false} />
            </div>
          </div>

          {canEdit && (
            <div className="flex items-center gap-1 shrink-0">
              {goal.clickup?.taskId && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSync}
                  disabled={syncing}
                  title={
                    goal.clickup.lastSyncError
                      ? `Last sync failed: ${goal.clickup.lastSyncError}`
                      : "Pull progress from ClickUp"
                  }
                >
                  <RefreshCw
                    className={`w-4 h-4 ${syncing ? "animate-spin" : ""} ${
                      goal.clickup.lastSyncError ? "text-destructive" : ""
                    }`}
                  />
                </Button>
              )}
              {onEdit && (
                <Button variant="ghost" size="icon" onClick={() => onEdit(goal)}>
                  <PencilIcon className="w-4 h-4" />
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {goal.title}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Any goals rolling up to this one will move up to its
                      parent rather than being deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </div>

      {showCheckIn && expanded && (
        <div className="border-t p-4 bg-muted/30">
          <QuarterCheckIn goal={goal} canEdit={canEdit} />
        </div>
      )}
    </div>
  );
}
