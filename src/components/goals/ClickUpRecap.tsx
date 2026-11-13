"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { approveClickUpRecap } from "@/lib/callables";
import { type Goal, type GoalRecap } from "@/types";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
} from "lucide-react";

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}

function RecapBody({ recap, pending }: { recap: GoalRecap; pending?: boolean }) {
  const [open, setOpen] = useState(false);
  const posted = formatDate(recap.postedAt);
  const approved = recap.approvedBy;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            {pending ? (
              <Clock className="w-4 h-4 text-amber-600" />
            ) : (
              <FileText className="w-4 h-4 text-muted-foreground" />
            )}
            {recap.period ? `Recap for ${recap.period}` : pending ? "New ClickUp recap" : "Latest ClickUp recap"}
            {(recap.rockCount ?? 0) > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {recap.rockCount} rock{recap.rockCount === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {[
              posted && `Posted ${posted}`,
              recap.author && `by ${recap.author}`,
              approved && `· approved by ${approved.byName} in ${approved.via === "app" ? "the app" : "ClickUp"}`,
            ]
              .filter(Boolean)
              .join(" ")}
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild className="shrink-0 h-7 text-xs">
          <a href={recap.commentUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="w-3 h-3 mr-1" />
            Open in ClickUp
          </a>
        </Button>
      </div>

      {recap.summary && <p className="text-sm">{recap.summary}</p>}

      {(recap.warnings ?? []).length > 0 && (
        <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-4 space-y-0.5">
          {recap.warnings!.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {open ? "Hide full recap" : "Show full recap"}
      </button>

      {open && (
        <div className="max-h-96 overflow-y-auto rounded border bg-muted/30 p-3 text-xs whitespace-pre-wrap leading-relaxed">
          {recap.text}
        </div>
      )}
    </>
  );
}

/**
 * The ClickUp agent's recaps for a goal: the newest one waiting for approval,
 * then the last one applied. Only the goal's Accountable person or an admin
 * can approve, matching approveClickUpRecap.
 */
export function ClickUpRecap({ goal }: { goal: Goal }) {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const [approving, setApproving] = useState(false);
  const recap = goal.clickup?.recap;
  const pending = goal.clickup?.pendingRecap;

  if (!goal.clickup?.taskId) return null;

  const canApprove = hasRole("admin") || (Boolean(user?.uid) && goal.ownerId === user?.uid);
  const approvedInApp = pending ? goal.clickup?.approvals?.[pending.commentId] : undefined;

  const handleApprove = async () => {
    if (!pending) return;
    setApproving(true);
    try {
      await approveClickUpRecap({ goalId: goal.id, commentId: pending.commentId });
      toast({
        title: "Recap approved",
        description: "It will be applied on the next sync.",
      });
    } catch (error) {
      toast({
        title: "Could not approve",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  if (!recap && !pending) {
    return (
      <p className="text-xs text-muted-foreground">
        No recap from the ClickUp agent yet. Once it posts the rock plan on the
        task and the goal owner approves it, the next sync fills in the rocks.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {pending && (
        <div className="rounded-md border border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-2">
          <RecapBody recap={pending} pending />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {approvedInApp ? (
              <span className="flex items-center gap-1 text-xs text-green-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approved by {approvedInApp.byName}. It applies on the next sync.
              </span>
            ) : canApprove ? (
              <>
                <Button size="sm" className="h-7 text-xs" onClick={handleApprove} disabled={approving}>
                  {approving ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                  )}
                  Approve
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  Or reply &quot;Approved&quot; to the comment in ClickUp. If it is wrong, ask the
                  team to fix the task and rerun the agent.
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                Waiting for the goal&apos;s Accountable person to approve.
              </span>
            )}
          </div>
        </div>
      )}

      {recap && (
        <div className="rounded-md border bg-background p-3 space-y-2">
          <RecapBody recap={recap} />
        </div>
      )}
    </div>
  );
}
