"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { RockForm } from "@/components/rocks/RockForm";
import { useToast } from "@/hooks/use-toast";
import { usePlanYear } from "@/contexts/PlanYearContext";
import { useActiveUsers } from "@/hooks/use-active-users";
import { deleteRock } from "@/lib/rocks";
import {
  QUARTERS,
  isRockComplete,
  rockLabel,
  rockResponsibleIds,
  type Quarter,
  type Rock,
} from "@/types";
import { ChevronDown, ChevronRight, PlusIcon } from "lucide-react";

interface RockSectionProps {
  /** The goal these rocks hang off. */
  goalId: string;
  rocks: Rock[];
  canEdit?: boolean;
  /** Starts open on screens that are all about rocks. */
  defaultExpanded?: boolean;
  /** Passed through for capabilities, which are not goals. */
  linkOptions?: Array<{ id: string; label: string }>;
}

/**
 * The quarter-grouped rock list, matching the layout the Annual Priorities
 * screen has always used. Rendered inside every goal card.
 */
export function RockSection({
  goalId,
  rocks,
  canEdit = false,
  defaultExpanded = false,
  linkOptions,
}: RockSectionProps) {
  const { toast } = useToast();
  const { companyId } = usePlanYear();
  const { users } = useActiveUsers();

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Rock | null>(null);
  const [addQuarter, setAddQuarter] = useState<Quarter | undefined>();

  const byQuarter = useMemo(() => {
    const map = new Map<Quarter, Rock[]>();
    rocks.forEach((rock) => {
      map.set(rock.quarter, [...(map.get(rock.quarter) ?? []), rock]);
    });
    return map;
  }, [rocks]);

  const userLabel = (userId: string) => {
    const found = users.find((u) => u.id === userId);
    return found?.name || found?.email || userId;
  };

  const responsibleLabel = (rock: Rock) => {
    const ids = rockResponsibleIds(rock);
    if (ids.length === 0) return rock.assigneeName || "";
    if (ids.length <= 2) return ids.map(userLabel).join(", ");
    return `${userLabel(ids[0])} +${ids.length - 1}`;
  };

  const openAdd = (quarter?: Quarter) => {
    setEditing(null);
    setAddQuarter(quarter);
    setExpanded(true);
    setFormOpen(true);
  };

  const openEdit = (rock: Rock) => {
    setEditing(rock);
    setAddQuarter(undefined);
    setFormOpen(true);
  };

  const handleDelete = async (rock: Rock) => {
    try {
      await deleteRock(companyId, rock.id);
      toast({ title: "Rock deleted", description: rockLabel(rock) });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete the rock.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {rocks.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs p-0 h-auto hover:bg-transparent"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 mr-1" />
            ) : (
              <ChevronRight className="h-4 w-4 mr-1" />
            )}
            <span className="text-muted-foreground">
              {rocks.length} rock{rocks.length === 1 ? "" : "s"}
            </span>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">No rocks yet</span>
        )}

        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => openAdd()}
            className="text-xs h-6 px-2 border-dashed"
          >
            <PlusIcon className="h-3 w-3 mr-1" />
            Add Rock
          </Button>
        )}
      </div>

      {expanded && rocks.length > 0 && (
        <div className="mt-2 pl-4 border-l-2 border-muted space-y-3">
          {QUARTERS.map((quarter) => {
            const quarterRocks = byQuarter.get(quarter) ?? [];
            if (quarterRocks.length === 0) return null;

            return (
              <div key={quarter} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {quarter}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {quarterRocks.length} rock
                    {quarterRocks.length === 1 ? "" : "s"}
                  </span>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openAdd(quarter)}
                      className="text-xs h-5 px-1 text-muted-foreground"
                    >
                      <PlusIcon className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {quarterRocks.map((rock) => (
                  <div
                    key={rock.id}
                    className="flex items-start justify-between gap-2 p-2 rounded bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {rock.priority && (
                          <Badge
                            variant="destructive"
                            className="text-[10px] px-1 py-0"
                          >
                            HIGH
                          </Badge>
                        )}
                        <p
                          className={`text-sm ${
                            isRockComplete(rock)
                              ? "line-through text-muted-foreground"
                              : ""
                          }`}
                        >
                          {rockLabel(rock)}
                        </p>
                      </div>
                      {rock.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {rock.description}
                        </p>
                      )}
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        <span>
                          {rock.quarter} {rock.year}
                        </span>
                        {responsibleLabel(rock) && (
                          <span>{responsibleLabel(rock)}</span>
                        )}
                      </div>
                    </div>

                    {canEdit && (
                      <ActionMenu
                        onEdit={() => openEdit(rock)}
                        onDelete={() => handleDelete(rock)}
                      />
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <RockForm
        open={formOpen}
        onOpenChange={setFormOpen}
        rock={editing}
        defaultGoalId={goalId}
        defaultQuarter={addQuarter}
        linkOptions={linkOptions}
      />
    </div>
  );
}
