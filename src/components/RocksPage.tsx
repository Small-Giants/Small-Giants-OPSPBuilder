import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  TargetIcon,
  PlusIcon,
  CalendarIcon,
  LayoutGridIcon,
  KanbanSquareIcon,
  GripVerticalIcon,
  ListIcon,
  Grid3X3Icon,
  EyeIcon,
  Loader2,
} from "lucide-react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { RockForm } from "@/components/rocks/RockForm";
import { usePlanYear } from "@/contexts/PlanYearContext";
import { useActiveUsers } from "@/hooks/use-active-users";
import { useGoals } from "@/hooks/use-goals";
import { useRocks } from "@/hooks/use-rocks";
import { deleteRock, updateRock } from "@/lib/rocks";
import {
  QUARTERS,
  rockGoalId,
  rockLabel,
  rockResponsibleIds,
  type Quarter,
  type Rock,
} from "@/types";

interface RocksPageProps {
  currentUserId?: string;
  currentUserName?: string;
}

export default function RocksPage(_props: RocksPageProps = {}) {
  const { toast } = useToast();
  const { companyId } = usePlanYear();
  const { users } = useActiveUsers();
  const { byId: goalsById } = useGoals();
  const { rocks, loading } = useRocks();

  const [viewMode, setViewMode] = useState<"quarter" | "status">("status");
  const [displayMode, setDisplayMode] = useState<"list" | "grid" | "kanban">(
    "list"
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Rock | null>(null);
  const [draggedRock, setDraggedRock] = useState<Rock | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

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

  const goalTitle = (rock: Rock) => {
    const goalId = rockGoalId(rock);
    return goalId ? goalsById.get(goalId)?.title : undefined;
  };

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (rock: Rock) => {
    setEditing(rock);
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

  const handleDragStart = (e: React.DragEvent, rock: Rock) => {
    setDraggedRock(rock);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, column: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(column);
  };

  const handleDrop = async (
    e: React.DragEvent,
    targetStatus?: Rock["status"],
    targetQuarter?: Quarter
  ) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggedRock) return;

    const updates: Partial<Rock> = {};
    if (targetStatus) {
      updates.status = targetStatus;
      if (targetStatus === "complete") updates.progress = 100;
    }
    if (targetQuarter) updates.quarter = targetQuarter;

    if (Object.keys(updates).length > 0) {
      try {
        await updateRock(companyId, draggedRock.id, updates);
      } catch {
        toast({
          title: "Error",
          description: "Failed to move the rock.",
          variant: "destructive",
        });
      }
    }

    setDraggedRock(null);
  };

  const getStatusColor = (status: Rock["status"]) => {
    switch (status) {
      case "ready":
        return "border-yellow-500/50";
      case "in_progress":
        return "border-blue-500/50";
      case "complete":
        return "border-green-500/50";
      default:
        return "border-muted-foreground/30";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderRockCard = (rock: Rock) => {
    const isGridMode = displayMode === "grid";
    const isKanbanMode = displayMode === "kanban";
    const parent = goalTitle(rock);

    return (
      <div
        key={rock.id}
        draggable
        onDragStart={(e) => handleDragStart(e, rock)}
        className={`group bg-card rounded-md border ${getStatusColor(rock.status)} hover:border-primary/50 transition-all ${
          isKanbanMode ? "cursor-move" : ""
        } ${isGridMode ? "p-4" : "p-3"}`}
      >
        <div className={`flex ${isGridMode ? "flex-col" : "items-start"} gap-2`}>
          {isKanbanMode && (
            <GripVerticalIcon className="h-4 w-4 text-muted-foreground mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
          <div className="flex-1 min-w-0">
            <div
              className={`flex items-center gap-2 flex-wrap ${isGridMode ? "mb-2" : "mb-1"}`}
            >
              {rock.priority && (
                <Badge variant="destructive" className="text-[10px] px-1 py-0">
                  HIGH
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {rock.quarter}
              </span>
              {parent && (
                <Badge variant="outline" className="text-[10px] truncate max-w-[14rem]">
                  {parent}
                </Badge>
              )}
            </div>

            <p
              className={`${isGridMode ? "text-sm" : "text-xs"} text-foreground ${
                rock.status === "complete" ? "line-through opacity-60" : ""
              } ${isGridMode ? "line-clamp-3" : "line-clamp-2"}`}
            >
              {rockLabel(rock)}
            </p>

            {responsibleLabel(rock) && (
              <p className="text-xs text-muted-foreground mt-1">
                {responsibleLabel(rock)}
              </p>
            )}

            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Progress</span>
                <span className="text-xs text-primary">
                  {rock.progress ?? 0}%
                </span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    rock.status === "complete" ? "bg-green-500" : "bg-primary"
                  }`}
                  style={{ width: `${rock.progress ?? 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
            <ActionMenu
              onEdit={() => openEdit(rock)}
              onDelete={() => handleDelete(rock)}
              testId={`action-menu-rock-${rock.id}`}
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderColumn = (
    key: string,
    label: string,
    columnRocks: Rock[],
    background: string,
    onDropColumn: (e: React.DragEvent) => void,
    icon?: React.ReactNode
  ) => (
    <div
      key={key}
      className={`${background} rounded-lg border ${
        dragOverColumn === key ? "border-primary" : "border-border"
      } transition-colors`}
      onDragOver={(e) => handleDragOver(e, key)}
      onDragLeave={() => setDragOverColumn(null)}
      onDrop={onDropColumn}
    >
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            {icon}
            {label}
          </h3>
          <Badge variant="secondary">{columnRocks.length}</Badge>
        </div>
      </div>
      <div
        className={`p-4 ${
          displayMode === "grid"
            ? "grid grid-cols-1 md:grid-cols-2 gap-3"
            : "space-y-3"
        } min-h-[200px]`}
      >
        {columnRocks.length > 0 ? (
          columnRocks.map(renderRockCard)
        ) : (
          <p className="text-xs text-muted-foreground italic text-center py-8">
            Drop rocks here
          </p>
        )}
      </div>
    </div>
  );

  const renderStatusView = () => {
    const statuses: { key: Rock["status"]; label: string; color: string }[] = [
      { key: "not_started", label: "Backlog", color: "bg-muted" },
      {
        key: "ready",
        label: "Ready",
        color: "bg-yellow-50 dark:bg-yellow-950/20",
      },
      {
        key: "in_progress",
        label: "In Progress",
        color: "bg-blue-50 dark:bg-blue-950/20",
      },
      {
        key: "complete",
        label: "Complete",
        color: "bg-green-50 dark:bg-green-950/20",
      },
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {statuses.map((status) =>
          renderColumn(
            status.key,
            status.label,
            rocks.filter((r) => r.status === status.key),
            status.color,
            (e) => handleDrop(e, status.key)
          )
        )}
      </div>
    );
  };

  const renderQuarterView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {QUARTERS.map((quarter) =>
        renderColumn(
          quarter,
          quarter,
          rocks.filter((r) => r.quarter === quarter),
          "bg-muted/30",
          (e) => handleDrop(e, undefined, quarter),
          <CalendarIcon className="h-4 w-4" />
        )
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TargetIcon className="h-6 w-6" />
            Rocks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every task across the plan, scheduled by quarter.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-md p-1">
            <Button
              size="sm"
              variant={viewMode === "status" ? "default" : "ghost"}
              onClick={() => setViewMode("status")}
              className="text-xs"
              data-testid="button-view-status"
            >
              <KanbanSquareIcon className="h-3 w-3 mr-1" />
              Status
            </Button>
            <Button
              size="sm"
              variant={viewMode === "quarter" ? "default" : "ghost"}
              onClick={() => setViewMode("quarter")}
              className="text-xs"
              data-testid="button-view-quarter"
            >
              <LayoutGridIcon className="h-3 w-3 mr-1" />
              Quarter
            </Button>
          </div>
          <div className="flex bg-muted rounded-md p-1">
            <Button
              size="sm"
              variant={displayMode === "list" ? "default" : "ghost"}
              onClick={() => setDisplayMode("list")}
              className="text-xs"
              data-testid="button-display-list"
            >
              <ListIcon className="h-3 w-3 mr-1" />
              List
            </Button>
            <Button
              size="sm"
              variant={displayMode === "grid" ? "default" : "ghost"}
              onClick={() => setDisplayMode("grid")}
              className="text-xs"
              data-testid="button-display-grid"
            >
              <Grid3X3Icon className="h-3 w-3 mr-1" />
              Grid
            </Button>
            <Button
              size="sm"
              variant={displayMode === "kanban" ? "default" : "ghost"}
              onClick={() => setDisplayMode("kanban")}
              className="text-xs"
              data-testid="button-display-kanban"
            >
              <EyeIcon className="h-3 w-3 mr-1" />
              Kanban
            </Button>
          </div>
          <Button onClick={openAdd} data-testid="button-add-rock">
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Rock
          </Button>
        </div>
      </div>

      {viewMode === "status" ? renderStatusView() : renderQuarterView()}

      <RockForm open={formOpen} onOpenChange={setFormOpen} rock={editing} />
    </div>
  );
}
