"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanYear } from "@/contexts/PlanYearContext";
import { updateGoal, updateGoalQuarter } from "@/lib/goals";
import {
  calculateGoalProgress,
  currentQuarter,
  deriveStatus,
  formatMeasurementValue,
} from "@/lib/goal-progress";
import { QUARTERS, type Goal, type Quarter } from "@/types";
import { Loader2 } from "lucide-react";

interface QuarterCheckInProps {
  goal: Goal;
  /** Read-only rendering for people who cannot edit this goal. */
  canEdit?: boolean;
}

export function QuarterCheckIn({ goal, canEdit = true }: QuarterCheckInProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { companyId } = usePlanYear();
  const [savingQuarter, setSavingQuarter] = useState<Quarter | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<Quarter, string>>>({});

  const isQuantitative = goal.measurement?.type === "quantitative";
  const thisQuarter = currentQuarter();

  const entryFor = (quarter: Quarter) =>
    goal.quarters?.find((q) => q.quarter === quarter);

  const persist = async (
    quarter: Quarter,
    changes: Parameters<typeof updateGoalQuarter>[3]
  ) => {
    setSavingQuarter(quarter);
    try {
      await updateGoalQuarter(companyId, goal, quarter, changes, user?.uid);

      // Keep the denormalised status in step with the quarters that drive it.
      const next: Goal = {
        ...goal,
        quarters: (goal.quarters ?? []).map((q) =>
          q.quarter === quarter ? { ...q, ...changes } : q
        ),
      };
      const status = deriveStatus(next);
      if (status !== goal.status) {
        await updateGoal(companyId, goal.id, { status });
      }
    } catch {
      toast({
        title: "Error",
        description: `Failed to update ${quarter}.`,
        variant: "destructive",
      });
    } finally {
      setSavingQuarter(null);
    }
  };

  const handleActualBlur = (quarter: Quarter) => {
    const raw = drafts[quarter];
    if (raw === undefined) return;

    const parsed = raw.trim() === "" ? null : Number(raw);
    if (parsed !== null && !Number.isFinite(parsed)) {
      toast({
        title: "Not a number",
        description: `"${raw}" could not be read as a number.`,
        variant: "destructive",
      });
      return;
    }

    setDrafts((prev) => {
      const next = { ...prev };
      delete next[quarter];
      return next;
    });

    if (parsed === entryFor(quarter)?.actual) return;
    persist(quarter, { actual: parsed });
  };

  const progress = calculateGoalProgress(goal);
  const unit = goal.measurement?.unit;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {QUARTERS.map((quarter) => {
          const entry = entryFor(quarter);
          const isCurrent = quarter === thisQuarter;
          const saving = savingQuarter === quarter;

          return (
            <div
              key={quarter}
              className={`rounded-md border p-3 space-y-2 ${
                isCurrent ? "border-primary/60 bg-primary/5" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{quarter}</span>
                <div className="flex items-center gap-1.5">
                  {isCurrent && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      Now
                    </Badge>
                  )}
                  {saving && (
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>

              {isQuantitative && (
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
                    <span>Target</span>
                    <span className="tabular-nums">
                      {formatMeasurementValue(entry?.target ?? null, unit)}
                    </span>
                  </div>
                  <Input
                    type="number"
                    inputMode="decimal"
                    disabled={!canEdit}
                    value={
                      drafts[quarter] ??
                      (entry?.actual != null ? String(entry.actual) : "")
                    }
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [quarter]: e.target.value }))
                    }
                    onBlur={() => handleActualBlur(quarter)}
                    placeholder="Actual"
                    className="h-8 text-sm"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={Boolean(entry?.complete)}
                  disabled={!canEdit}
                  onCheckedChange={(checked) =>
                    persist(quarter, { complete: checked === true })
                  }
                />
                <span className={entry?.complete ? "text-green-600" : ""}>
                  {entry?.complete ? "Complete" : "Mark complete"}
                </span>
              </label>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {progress.basis === "quantitative"
            ? `${formatMeasurementValue(progress.actualToDate, unit)} of ${formatMeasurementValue(progress.annualTarget, unit)} ${
                goal.measurement.accumulation === "cumulative"
                  ? "(cumulative)"
                  : "(point in time)"
              }`
            : `${progress.quartersComplete} of 4 quarters complete`}
        </span>
        <span className="font-medium text-foreground tabular-nums">
          {progress.percent}%
        </span>
      </div>
    </div>
  );
}
