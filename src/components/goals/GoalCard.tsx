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
import { ClickUpRecap } from "@/components/goals/ClickUpRecap";
import { GoalProgressBar, GoalStatusBadge } from "@/components/goals/GoalProgress";
import { QuarterCheckIn } from "@/components/goals/QuarterCheckIn";
import { RockSection } from "@/components/rocks/RockSection";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanYear } from "@/contexts/PlanYearContext";
import { useDepartments } from "@/hooks/use-departments";
import { useGoalPermissions } from "@/hooks/use-goal-permissions";
import { useRocks } from "@/hooks/use-rocks";
import { deleteGoal } from "@/lib/goals";
import { GOAL_LEVEL_LABELS, raciMembers, type Goal } from "@/types";
import {
  AlertCircle,
  CalendarIcon,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  PencilIcon,
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
  /** Hidden on dense surfaces like the weekly meeting agenda. */
  showRocks?: boolean;
}

export function GoalCard({
  goal,
  onEdit,
  showLevel = false,
  showCheckIn = true,
  defaultExpanded = false,
  compact = false,
  showRocks = true,
}: GoalCardProps) {
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const { companyId } = usePlanYear();
  const { getName } = useDepartments();
  const { canEditGoal } = useGoalPermissions();
  const { byGoal } = useRocks();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const isAdmin = hasRole("admin");
  const canEdit = canEditGoal(goal);
  const linkedToClickUp = Boolean(goal.clickup?.taskId);
  // Progress on a linked goal comes from the ClickUp recap. Admins keep the
  // ability to correct it, knowing the next sync will apply the recap again.
  const canCheckIn = canEdit && (!linkedToClickUp || isAdmin);
  const rocks = byGoal.get(goal.id) ?? [];
  const peopleCount = raciMembers(goal).length;
  const recap = goal.clickup?.recap;
  // Without a statement the description is the flattened SMART answers, too
  // long for compact cards.
  const summary = goal.statement?.trim() || (compact ? "" : goal.description);

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

            {summary && (
              <p
                className={`text-sm text-muted-foreground mt-1.5 ${compact ? "line-clamp-2" : "line-clamp-3"}`}
                title={summary}
              >
                {summary}
              </p>
            )}

            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
              <span
                className={`flex items-center gap-1 ${
                  !goal.ownerName && peopleCount > 0 ? "text-amber-600" : ""
                }`}
                title="Accountable"
              >
                <UserIcon className="w-3 h-3" />
                {goal.ownerName ||
                  (peopleCount > 0 ? "No one accountable" : "Unassigned")}
              </span>
              {goal.departmentId && <span>{getName(goal.departmentId)}</span>}
              {goal.dueDate && (
                <span className="flex items-center gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  {goal.dueDate}
                </span>
              )}
              {peopleCount > (goal.ownerId ? 1 : 0) && (
                <span>
                  {goal.ownerId ? "+" : ""}
                  {peopleCount - (goal.ownerId ? 1 : 0)} in RACI
                </span>
              )}
              {recap && (
                <span className="flex items-center gap-1" title="Latest ClickUp recap">
                  <FileText className="w-3 h-3" />
                  {recap.period ?? "ClickUp recap"}
                </span>
              )}
              {goal.clickup?.pendingRecap && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="flex items-center gap-1 text-amber-600 hover:underline"
                >
                  <Clock className="w-3 h-3" />
                  Recap to approve
                </button>
              )}
              {isAdmin && goal.clickup?.lastSyncError && (
                <span
                  className="flex items-center gap-1 text-destructive"
                  title={goal.clickup.lastSyncError}
                >
                  <AlertCircle className="w-3 h-3" />
                  Last sync failed
                </span>
              )}
            </div>

            <div className="mt-3">
              <GoalProgressBar goal={goal} showDetail={false} />
            </div>

            {showRocks && (
              <div className="mt-3">
                <RockSection
                  goalId={goal.id}
                  rocks={rocks}
                  canEdit={canEdit}
                />
              </div>
            )}
          </div>

          {canEdit && (
            <div className="flex items-center gap-1 shrink-0">
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
        <div className="border-t p-4 bg-muted/30 space-y-3">
          <ClickUpRecap goal={goal} />
          <QuarterCheckIn goal={goal} canEdit={canCheckIn} />
          {linkedToClickUp && (
            <p className="text-[11px] text-muted-foreground">
              Status and quarter progress come from the monthly recap on the
              ClickUp task. Add notes and updates in ClickUp, not here.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
