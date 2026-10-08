"use client";

import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RaciFields } from "@/components/RaciFields";
import { SmartGoalFields } from "@/components/goals/SmartGoalFields";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanYear } from "@/contexts/PlanYearContext";
import { useGoals } from "@/hooks/use-goals";
import { buildRockSmart, createRock, newRockDraft, updateRock } from "@/lib/rocks";
import type { RockDraft } from "@/lib/rocks";
import {
  GOAL_LEVEL_LABELS,
  QUARTERS,
  ROCK_STATUSES,
  ROCK_STATUS_LABELS,
  isSmartComplete,
  rockGoalId,
  type Quarter,
  type RaciAssignment,
  type Rock,
  type RockStatus,
} from "@/types";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

interface RockFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing an existing rock when provided, otherwise creating a new one. */
  rock?: Rock | null;
  /** Pre-selects the goal when opened from inside a goal card. */
  defaultGoalId?: string;
  defaultQuarter?: Quarter;
  /**
   * Extra link targets that are not goals. Capabilities stayed in the
   * priorities collection, so they have to be offered explicitly.
   */
  linkOptions?: Array<{ id: string; label: string }>;
}

export function RockForm({
  open,
  onOpenChange,
  rock,
  defaultGoalId,
  defaultQuarter,
  linkOptions = [],
}: RockFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { companyId, selectedYear } = usePlanYear();
  const { allGoals } = useGoals();

  const [draft, setDraft] = useState<RockDraft>(() =>
    newRockDraft({ companyId, year: selectedYear })
  );
  const [saving, setSaving] = useState(false);
  const [smartOpen, setSmartOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (rock) {
      setDraft({ ...rock, goalId: rockGoalId(rock) ?? "" });
      setSmartOpen(Boolean(rock.smart));
      return;
    }

    setSmartOpen(false);
    setDraft(
      newRockDraft({
        companyId,
        year: selectedYear,
        quarter: defaultQuarter,
        goalId: defaultGoalId,
        ownerId: user?.uid,
        ownerName: user?.name ?? "",
      })
    );
  }, [
    open,
    rock,
    companyId,
    selectedYear,
    defaultGoalId,
    defaultQuarter,
    user?.uid,
    user?.name,
  ]);

  const handleRaciChange = (next: RaciAssignment) =>
    setDraft((prev) => ({ ...prev, ...next }));

  const handleSave = async () => {
    if (!draft.text.trim()) return;

    setSaving(true);
    try {
      if (rock) {
        await updateRock(companyId, rock.id, draft, user?.uid);
        toast({ title: "Rock updated", description: draft.text.trim() });
      } else {
        await createRock(companyId, draft, user?.uid);
        toast({ title: "Rock created", description: draft.text.trim() });
      }
      onOpenChange(false);
    } catch {
      toast({
        title: "Error",
        description: "Failed to save the rock.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const smartCount = draft.smart
    ? Object.values(draft.smart).filter((v) => v?.trim()).length
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rock ? "Edit Rock" : "New Rock"}</DialogTitle>
          <DialogDescription>
            A task inside a goal, scheduled to a quarter of {draft.year}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              placeholder="What needs to get done?"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              value={draft.description ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              placeholder="Any detail the team needs (optional)"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Goal</Label>
              <Select
                value={draft.goalId || "__none__"}
                onValueChange={(v) =>
                  setDraft({ ...draft, goalId: v === "__none__" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not linked</SelectItem>
                  {allGoals.map((goal) => (
                    <SelectItem key={goal.id} value={goal.id}>
                      {goal.title} ({GOAL_LEVEL_LABELS[goal.level]})
                    </SelectItem>
                  ))}
                  {linkOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Quarter</Label>
              <Select
                value={draft.quarter}
                onValueChange={(v) =>
                  setDraft({ ...draft, quarter: v as Quarter })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUARTERS.map((quarter) => (
                    <SelectItem key={quarter} value={quarter}>
                      {quarter}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={draft.status}
                onValueChange={(v) =>
                  setDraft({ ...draft, status: v as RockStatus })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROCK_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {ROCK_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <RaciFields value={draft} onChange={handleRaciChange} />

          <div className="rounded-md border">
            <button
              type="button"
              onClick={() => setSmartOpen((v) => !v)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <span className="text-sm font-medium">
                SMART breakdown (optional)
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {isSmartComplete(draft.smart)
                  ? "Complete"
                  : smartCount > 0
                    ? `${smartCount} of 5 answered`
                    : "Not started"}
                {smartOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>
            </button>
            {smartOpen && (
              <div className="border-t p-4">
                <SmartGoalFields
                  value={buildRockSmart(draft.smart)}
                  onChange={(smart) => setDraft({ ...draft, smart })}
                />
                <p className="text-xs text-muted-foreground mt-3">
                  Filling any of these replaces the description above.
                </p>
              </div>
            )}
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
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm">High priority</Label>
                <p className="text-xs text-muted-foreground">
                  Flags this as a top focus item.
                </p>
              </div>
              <Switch
                checked={Boolean(draft.priority)}
                onCheckedChange={(checked) =>
                  setDraft({ ...draft, priority: checked })
                }
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!draft.text.trim() || saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {rock ? "Save Changes" : "Create Rock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
