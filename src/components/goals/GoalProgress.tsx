"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import {
  calculateAnnualRollup,
  calculateGoalProgress,
  formatMeasurementValue,
} from "@/lib/goal-progress";
import { GOAL_STATUS_COLORS, GOAL_STATUS_LABELS, type Goal } from "@/types";

export function GoalStatusBadge({ goal }: { goal: Goal }) {
  const status = goal.status ?? "not_started";
  return (
    <Badge className={`${GOAL_STATUS_COLORS[status]} text-white`}>
      {GOAL_STATUS_LABELS[status]}
    </Badge>
  );
}

export function GoalProgressBar({
  goal,
  showDetail = true,
}: {
  goal: Goal;
  showDetail?: boolean;
}) {
  const progress = calculateGoalProgress(goal);
  const unit = goal.measurement?.unit;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {progress.basis === "quantitative"
            ? `${formatMeasurementValue(progress.actualToDate, unit)} of ${formatMeasurementValue(progress.annualTarget, unit)}`
            : `${progress.quartersComplete} of 4 quarters`}
        </span>
        <span className="font-medium tabular-nums">{progress.percent}%</span>
      </div>
      <Progress value={progress.percent} className="h-2" />
      {showDetail && progress.basis === "quantitative" && (
        <p className="text-[11px] text-muted-foreground">
          {goal.measurement.accumulation === "cumulative"
            ? "Quarters sum to the annual target"
            : "Latest reported quarter is the annual number"}
        </p>
      )}
    </div>
  );
}

/**
 * An annual priority is met only when every department goal beneath it is met,
 * but the averaged percentage is shown alongside so a near miss is visibly
 * different from a badly missed priority.
 */
export function AnnualRollup({ children }: { children: Goal[] }) {
  const rollup = calculateAnnualRollup(children);

  if (rollup.childCount === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No department goals linked yet, so this priority cannot be met.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {rollup.met ? (
            <Badge className="bg-green-500 text-white gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Met
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-amber-600">
              <AlertTriangle className="w-3 h-3" />
              Not met
            </Badge>
          )}
          <span className="text-muted-foreground">
            {rollup.childrenMet} of {rollup.childCount} department goals met
          </span>
        </div>
        <span className="font-medium tabular-nums">{rollup.percent}%</span>
      </div>
      <Progress value={rollup.percent} className="h-2" />
      {!rollup.met && rollup.percent >= 80 && (
        <p className="text-[11px] text-amber-600">
          Close. {rollup.childCount - rollup.childrenMet} goal
          {rollup.childCount - rollup.childrenMet === 1 ? "" : "s"} still short.
        </p>
      )}
    </div>
  );
}
