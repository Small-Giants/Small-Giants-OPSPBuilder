"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DepartmentCombobox } from "@/components/ui/department-combobox";
import { RaciFields, peopleModeForGoal } from "@/components/RaciFields";
import { pushGoalToClickUp, writeSmartGoal } from "@/lib/callables";
import { Textarea } from "@/components/ui/textarea";
import { SmartGoalFields } from "@/components/goals/SmartGoalFields";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanYear } from "@/contexts/PlanYearContext";
import { useActiveUsers } from "@/hooks/use-active-users";
import { useGoals } from "@/hooks/use-goals";
import { buildSmart, createGoal, newGoalDraft, updateGoal } from "@/lib/goals";
import { evenSplit } from "@/lib/goal-progress";
import {
  GOAL_LEVELS,
  GOAL_LEVEL_LABELS,
  GOAL_LEVEL_PARENT,
  QUARTERS,
  emptyQuarters,
  parseClickUpTaskId,
  type Goal,
  type GoalDraft,
  type GoalLevel,
  type GoalQuarter,
  type MeasurementType,
  type RaciAssignment,
  type TargetAccumulation,
} from "@/types";
import { Loader2, Sparkles, SplitIcon } from "lucide-react";

function smartAnswered(draft: Pick<GoalDraft, "smart">): number {
  return Object.values(draft.smart ?? {}).filter((v) => v?.trim()).length;
}

interface GoalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing an existing goal when provided, otherwise creating a new one. */
  goal?: Goal | null;
  defaultLevel?: GoalLevel;
  defaultParentGoalId?: string | null;
  defaultDepartmentId?: string | null;
}

export function GoalForm({
  open,
  onOpenChange,
  goal,
  defaultLevel = "annual",
  defaultParentGoalId = null,
  defaultDepartmentId = null,
}: GoalFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { companyId, selectedYear } = usePlanYear();
  const { users } = useActiveUsers();
  const { allGoals } = useGoals();

  const [draft, setDraft] = useState<GoalDraft>(() =>
    newGoalDraft({
      level: defaultLevel,
      planYear: selectedYear,
      companyId,
      parentGoalId: defaultParentGoalId,
      departmentId: defaultDepartmentId,
    })
  );
  const [saving, setSaving] = useState(false);
  const [writing, setWriting] = useState(false);
  const [clickUpInput, setClickUpInput] = useState("");

  useEffect(() => {
    if (!open) return;

    if (goal) {
      setDraft({ ...goal, smart: buildSmart(goal.smart) });
      setClickUpInput(goal.clickup?.url ?? goal.clickup?.taskId ?? "");
      return;
    }

    setClickUpInput("");

    setDraft({
      ...newGoalDraft({
        level: defaultLevel,
        planYear: selectedYear,
        companyId,
        parentGoalId: defaultParentGoalId,
        departmentId: defaultDepartmentId,
        ownerId: defaultLevel === "individual" ? user?.uid : "",
        ownerName: defaultLevel === "individual" ? user?.name ?? "" : "",
      }),
      smart: buildSmart(undefined),
    });
  }, [
    open,
    goal,
    defaultLevel,
    defaultParentGoalId,
    defaultDepartmentId,
    selectedYear,
    companyId,
    user?.uid,
    user?.name,
  ]);

  const parentLevel = GOAL_LEVEL_PARENT[draft.level];

  const parentOptions = useMemo(
    () =>
      parentLevel
        ? allGoals.filter((g) => g.level === parentLevel && g.id !== goal?.id)
        : [],
    [allGoals, parentLevel, goal?.id]
  );

  const setMeasurement = (changes: Partial<GoalDraft["measurement"]>) =>
    setDraft((prev) => ({
      ...prev,
      measurement: { ...prev.measurement, ...changes },
    }));

  const setQuarter = (
    quarter: GoalQuarter["quarter"],
    changes: Partial<GoalQuarter>
  ) =>
    setDraft((prev) => ({
      ...prev,
      quarters: (prev.quarters ?? emptyQuarters()).map((q) =>
        q.quarter === quarter ? { ...q, ...changes } : q
      ),
    }));

  const handleEvenSplit = () => {
    const split = evenSplit(draft.measurement.annualTarget);
    setDraft((prev) => ({
      ...prev,
      quarters: (prev.quarters ?? emptyQuarters()).map((q) => ({
        ...q,
        target: split[q.quarter],
      })),
    }));
  };

  const handleRaciChange = (next: RaciAssignment) =>
    setDraft((prev) => {
      const ownerChanged = next.ownerId !== prev.ownerId;
      const owner = users.find((u) => u.id === next.ownerId);
      return {
        ...prev,
        ...next,
        // An individual goal inherits the department of whoever owns it.
        departmentId:
          ownerChanged && prev.level === "individual"
            ? owner?.departmentId ?? prev.departmentId ?? null
            : prev.departmentId ?? null,
      };
    });

  const handleClickUpBlur = () => {
    const raw = clickUpInput.trim();
    if (!raw) {
      setDraft((prev) => ({ ...prev, clickup: undefined }));
      return;
    }

    const taskId = parseClickUpTaskId(raw);
    if (!taskId) {
      toast({
        title: "Could not read that link",
        description: "Paste a ClickUp task URL or just the task ID.",
        variant: "destructive",
      });
      return;
    }

    setDraft((prev) => ({
      ...prev,
      clickup: {
        ...prev.clickup,
        taskId,
        url: raw.includes("/") ? raw : prev.clickup?.url,
      },
    }));
  };

  const handleLevelChange = (level: GoalLevel) =>
    setDraft((prev) => ({
      ...prev,
      level,
      // The old parent belongs to the wrong layer once the level changes.
      parentGoalId: null,
    }));

  const pushToClickUp = async (goalId: string) => {
    try {
      const result = await pushGoalToClickUp({ goalId });
      if (result.status === "skipped") {
        if (result.reason) {
          toast({ title: "Not sent to ClickUp", description: result.reason });
        }
        return;
      }
      toast({
        title: result.status === "created" ? "ClickUp task created" : "ClickUp task updated",
        description: result.warnings.length
          ? result.warnings.join(" ")
          : "The task, description, and RACI fields match this goal.",
      });
    } catch (error) {
      toast({
        title: "Saved, but ClickUp was not updated",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const requestStatement = async (): Promise<string | null> => {
    const result = await writeSmartGoal({
      title: draft.title,
      smart: buildSmart(draft.smart) as unknown as Record<string, string>,
    });
    return result.statement || null;
  };

  const handleWriteStatement = async () => {
    setWriting(true);
    try {
      const statement = await requestStatement();
      if (statement) setDraft((prev) => ({ ...prev, statement }));
    } catch (error) {
      toast({
        title: "Could not write the statement",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setWriting(false);
    }
  };

  const handleSave = async () => {
    if (!draft.title.trim()) return;

    setSaving(true);
    let savedId: string | null = null;
    let toSave = draft;
    if (!draft.statement?.trim() && smartAnswered(draft) >= 2) {
      try {
        const statement = await requestStatement();
        if (statement) toSave = { ...draft, statement };
      } catch {
        // A missing statement must not block saving; the lead can add it later.
      }
    }
    try {
      // The sync owns the rest of `clickup`; writing the whole object from a
      // draft opened earlier could undo a recap applied in the meantime.
      const { clickup, ...fields } = toSave;
      if (goal) {
        await updateGoal(
          companyId,
          goal.id,
          (clickup?.taskId || goal.clickup?.taskId
            ? {
                ...fields,
                "clickup.taskId": clickup?.taskId ?? null,
                "clickup.url": clickup?.url ?? null,
              }
            : fields) as Partial<Goal>,
          user?.uid
        );
        savedId = goal.id;
        toast({ title: "Goal updated", description: draft.title.trim() });
      } else {
        savedId = await createGoal(
          companyId,
          clickup?.taskId ? { ...fields, clickup: { taskId: clickup.taskId, url: clickup.url } } : fields,
          user?.uid
        );
        toast({ title: "Goal created", description: draft.title.trim() });
      }
      onOpenChange(false);
    } catch {
      toast({
        title: "Error",
        description: "Failed to save the goal.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }

    if (savedId && draft.level === "department") await pushToClickUp(savedId);
  };

  const isQuantitative = draft.measurement.type === "quantitative";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{goal ? "Edit Goal" : "New Goal"}</DialogTitle>
          <DialogDescription>
            {GOAL_LEVEL_LABELS[draft.level]} for {draft.planYear}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-1">
            <Label>Goal name</Label>
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="What is the goal called?"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Layer</Label>
              <Select
                value={draft.level}
                onValueChange={(v) => handleLevelChange(v as GoalLevel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {GOAL_LEVEL_LABELS[level]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {parentLevel && (
              <div className="space-y-1">
                <Label>Rolls up to ({GOAL_LEVEL_LABELS[parentLevel]})</Label>
                <Select
                  value={draft.parentGoalId ?? "__none__"}
                  onValueChange={(v) =>
                    setDraft({
                      ...draft,
                      parentGoalId: v === "__none__" ? null : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a parent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not linked</SelectItem>
                    {parentOptions.map((parent) => (
                      <SelectItem key={parent.id} value={parent.id}>
                        {parent.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <SmartGoalFields
            value={buildSmart(draft.smart)}
            onChange={(smart) => setDraft({ ...draft, smart })}
          />

          <div className="space-y-1.5 rounded-md border p-4">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="goal-statement" className="text-sm font-medium">
                Goal statement
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleWriteStatement}
                disabled={writing || smartAnswered(draft) < 2}
              >
                {writing ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                )}
                {draft.statement?.trim() ? "Rewrite" : "Write goal statement"}
              </Button>
            </div>
            <Textarea
              id="goal-statement"
              value={draft.statement ?? ""}
              onChange={(e) => setDraft({ ...draft, statement: e.target.value })}
              placeholder="One sentence written from the SMART answers above. Press Write goal statement, or type your own."
              rows={3}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Shown as the goal&apos;s description and at the top of its ClickUp
              task. If this is empty when you save, it is written for you.
            </p>
          </div>

          <RaciFields
            value={draft}
            onChange={handleRaciChange}
            mode={peopleModeForGoal(draft.level)}
          />

          <div className="space-y-1">
            <Label>Department</Label>
            <DepartmentCombobox
              value={draft.departmentId ?? ""}
              onValueChange={(v) =>
                setDraft({ ...draft, departmentId: v || null })
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Start date</Label>
              <Input
                type="date"
                value={draft.startDate ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, startDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Due date</Label>
              <Input
                type="date"
                value={draft.dueDate ?? ""}
                onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-4">
            <Label className="text-sm font-medium">How we measure success</Label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Measurement</Label>
                <Select
                  value={draft.measurement.type}
                  onValueChange={(v) =>
                    setMeasurement({ type: v as MeasurementType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">
                      Simple (each quarter is 25%)
                    </SelectItem>
                    <SelectItem value="quantitative">
                      Numeric target per quarter
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isQuantitative && (
                <div className="space-y-1">
                  <Label className="text-xs">Quarters add up as</Label>
                  <Select
                    value={draft.measurement.accumulation}
                    onValueChange={(v) =>
                      setMeasurement({ accumulation: v as TargetAccumulation })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cumulative">
                        Cumulative (revenue, units sold)
                      </SelectItem>
                      <SelectItem value="point_in_time">
                        Point in time (NPS, headcount)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {isQuantitative && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Annual target</Label>
                    <Input
                      type="number"
                      value={draft.measurement.annualTarget ?? ""}
                      onChange={(e) =>
                        setMeasurement({
                          annualTarget:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        })
                      }
                      placeholder="10000000"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unit</Label>
                    <Input
                      value={draft.measurement.unit ?? ""}
                      onChange={(e) => setMeasurement({ unit: e.target.value })}
                      placeholder="$, %, hires"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Quarterly targets</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleEvenSplit}
                      disabled={draft.measurement.annualTarget == null}
                    >
                      <SplitIcon className="w-3.5 h-3.5 mr-1" />
                      Split evenly
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {QUARTERS.map((quarter) => {
                      const entry = (draft.quarters ?? []).find(
                        (q) => q.quarter === quarter
                      );
                      return (
                        <div key={quarter} className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">
                            {quarter}
                          </Label>
                          <Input
                            type="number"
                            value={entry?.target ?? ""}
                            onChange={(e) =>
                              setQuarter(quarter, {
                                target:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                            className="h-9"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {draft.measurement.accumulation === "cumulative"
                      ? "Quarters sum to the annual target. Override any quarter to weight it differently."
                      : "The latest reported quarter is the annual number, not the sum."}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="space-y-2 rounded-md border p-4">
            <Label className="text-sm font-medium">ClickUp task</Label>
            <Input
              value={clickUpInput}
              onChange={(e) => setClickUpInput(e.target.value)}
              onBlur={handleClickUpBlur}
              placeholder="Paste the task URL or ID"
            />
            <p className="text-xs text-muted-foreground">
              {draft.level === "department"
                ? "Leave this empty and saving creates the task in ClickUp, with the SMART breakdown as its description and the RACI fields filled in. Paste a link only to use a task that already exists."
                : "Paste a link to follow a ClickUp task. Only department goals get a task created for them."}{" "}
              Once the goal owner approves the ClickUp agent&apos;s rock plan and
              monthly recaps, they set the rocks, status, and quarter progress.
              Targets you set here are never overwritten.
            </p>
            {draft.clickup?.lastSyncError && (
              <p className="text-xs text-destructive">
                Last sync failed: {draft.clickup.lastSyncError}
              </p>
            )}
            {draft.clickup?.lastSyncedAt && !draft.clickup.lastSyncError && (
              <p className="text-xs text-muted-foreground">
                Last synced {new Date(draft.clickup.lastSyncedAt).toLocaleString()}.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!draft.title.trim() || saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {goal ? "Save Changes" : "Create Goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
