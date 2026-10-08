import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  UserIcon,
  FlameIcon,
  PlusIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  Loader2,
} from "lucide-react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { RockForm } from "@/components/rocks/RockForm";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanYear } from "@/contexts/PlanYearContext";
import { useGoals } from "@/hooks/use-goals";
import { useRocks } from "@/hooks/use-rocks";
import { deleteRock } from "@/lib/rocks";
import {
  QUARTERS,
  isRaciMember,
  isRockComplete,
  rockGoalId,
  rockLabel,
  type Quarter,
  type Rock,
} from "@/types";

export default function IndividualRocks() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { companyId } = usePlanYear();
  const { byId: goalsById } = useGoals();
  const { rocks, loading } = useRocks();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Rock | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Anyone named in a RACI role sees the rock here, not just the one person
  // the pre-RACI documents listed as assignee.
  const myRocks = useMemo(
    () =>
      rocks.filter(
        (rock) =>
          isRaciMember(rock, user?.uid) || rock.assigneeId === user?.uid
      ),
    [rocks, user?.uid]
  );

  const byQuarter = useMemo(() => {
    const map = new Map<Quarter, Rock[]>();
    myRocks.forEach((rock) => {
      map.set(rock.quarter, [...(map.get(rock.quarter) ?? []), rock]);
    });
    return map;
  }, [myRocks]);

  const goalTitle = (rock: Rock) => {
    const goalId = rockGoalId(rock);
    return goalId ? goalsById.get(goalId)?.title : undefined;
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl text-foreground">
                <UserIcon className="w-6 h-6" />
                My Rocks - {user?.name || user?.email || "Current User"}
              </CardTitle>
              <div className="text-sm text-muted-foreground mt-1">
                {myRocks.length} rock{myRocks.length === 1 ? "" : "s"} where you
                hold a RACI role.
              </div>
            </div>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Rock
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {QUARTERS.map((quarter) => {
            const quarterRocks = byQuarter.get(quarter) ?? [];
            if (quarterRocks.length === 0) return null;
            const isOpen = !collapsed[quarter];

            return (
              <div
                key={quarter}
                className="border border-border rounded-lg bg-muted"
              >
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() =>
                    setCollapsed((prev) => ({
                      ...prev,
                      [quarter]: !prev[quarter],
                    }))
                  }
                >
                  <div className="flex items-center gap-3">
                    <FlameIcon className="w-5 h-5 text-accent" />
                    <span className="font-semibold text-lg text-foreground">
                      {quarter}
                    </span>
                    <Badge variant="secondary">
                      {quarterRocks.length} rock
                      {quarterRocks.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  {isOpen ? (
                    <ChevronDownIcon className="w-5 h-5 text-accent" />
                  ) : (
                    <ChevronRightIcon className="w-5 h-5 text-accent" />
                  )}
                </div>

                {isOpen && (
                  <div className="p-4 pt-0 space-y-3">
                    {quarterRocks.map((rock) => (
                      <div
                        key={rock.id}
                        className="bg-card rounded-lg p-4 border border-border"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {rock.priority && (
                                <Badge
                                  variant="destructive"
                                  className="text-xs"
                                >
                                  HIGH PRIORITY
                                </Badge>
                              )}
                              <h4
                                className={`text-foreground font-medium ${
                                  isRockComplete(rock)
                                    ? "line-through text-muted-foreground"
                                    : ""
                                }`}
                              >
                                {rockLabel(rock)}
                              </h4>
                            </div>
                            {rock.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {rock.description}
                              </p>
                            )}
                            {goalTitle(rock) && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {goalTitle(rock)}
                              </p>
                            )}
                          </div>
                          <ActionMenu
                            onEdit={() => {
                              setEditing(rock);
                              setFormOpen(true);
                            }}
                            onDelete={() => handleDelete(rock)}
                            testId={`action-menu-rock-${rock.id}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {myRocks.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-lg">
                No rocks assigned to you yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <RockForm open={formOpen} onOpenChange={setFormOpen} rock={editing} />
    </div>
  );
}
