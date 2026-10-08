import React, { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  PlusIcon,
  CheckIcon,
  XIcon,
  TrendingUpIcon,
  TargetIcon,
  GripVertical,
  Loader2,
} from "lucide-react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { UserCombobox } from "@/components/ui/user-combobox";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalForm } from "@/components/goals/GoalForm";
import { RockSection } from "@/components/rocks/RockSection";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { LEGACY_PLAN_YEAR, usePlanYear } from "@/contexts/PlanYearContext";
import { useAuth } from "@/contexts/AuthContext";
import { useGoals } from "@/hooks/use-goals";
import { useRocks } from "@/hooks/use-rocks";
import { reorderGoals } from "@/lib/goals";
import type { Goal } from "@/types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing z-10 text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="pl-8">{children}</div>
    </div>
  );
}

interface Capability {
  id: string;
  title: string;
  description?: string;
  executiveChampion?: string;
  successStatement?: string;
  owner?: string;
  sortOrder?: number;
}

const emptyCapabilityForm = {
  title: "",
  description: "",
  executiveChampion: "",
  successStatement: "",
  owner: "",
};

/**
 * Two columns from two sources. Annual priorities are goals at the annual
 * level; capabilities never moved and still live in the priorities collection.
 */
export default function PriorityManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { companyId, selectedYear } = usePlanYear();
  const { goals: annualGoals, loading: goalsLoading } = useGoals({
    level: "annual",
  });
  const { byGoal } = useRocks();

  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);
  const [showCapabilityForm, setShowCapabilityForm] = useState(false);
  const [capabilityForm, setCapabilityForm] = useState(emptyCapabilityForm);
  const [editingCapabilityId, setEditingCapabilityId] = useState<string | null>(
    null
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    let unsubYear: Unsubscribe | undefined;
    let unsubLegacy: Unsubscribe | undefined;

    const byId = new Map<string, Capability>();
    const apply = () => {
      setCapabilities(
        Array.from(byId.values()).sort(
          (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
        )
      );
      setCapabilitiesLoading(false);
    };

    const col = collection(db, "companies", companyId, "priorities");

    unsubYear = onSnapshot(
      query(col, where("planYear", "==", selectedYear)),
      (snapshot) => {
        byId.clear();
        snapshot.forEach((d) => {
          const data = d.data() as any;
          if (data.type !== "capability") return;
          byId.set(d.id, { id: d.id, ...data });
        });
        apply();
      },
      () => setCapabilitiesLoading(false)
    );

    if (selectedYear === LEGACY_PLAN_YEAR) {
      unsubLegacy = onSnapshot(
        query(col, where("planYear", "==", null)),
        (snapshot) => {
          snapshot.forEach((d) => {
            const data = d.data() as any;
            if (data.type !== "capability" || byId.has(d.id)) return;
            byId.set(d.id, { id: d.id, ...data });
          });
          apply();
        },
        () => undefined
      );
    }

    return () => {
      unsubYear?.();
      unsubLegacy?.();
    };
  }, [companyId, selectedYear]);

  const capabilityLinkOptions = useMemo(
    () =>
      capabilities.map((c) => ({ id: c.id, label: `${c.title} (Capability)` })),
    [capabilities]
  );

  const openNewGoal = () => {
    setEditingGoal(null);
    setGoalFormOpen(true);
  };

  const openEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setGoalFormOpen(true);
  };

  const handleGoalsDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = annualGoals.findIndex((g) => g.id === active.id);
    const newIndex = annualGoals.findIndex((g) => g.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(annualGoals, oldIndex, newIndex);
    try {
      await reorderGoals(
        companyId,
        reordered.map((g) => g.id)
      );
    } catch {
      toast({
        title: "Error",
        description: "Failed to reorder annual priorities.",
        variant: "destructive",
      });
    }
  };

  const handleCapabilitiesDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = capabilities.findIndex((c) => c.id === active.id);
    const newIndex = capabilities.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(capabilities, oldIndex, newIndex);
    try {
      const batch = writeBatch(db);
      reordered.forEach((item, index) => {
        batch.update(
          doc(db, "companies", companyId, "priorities", item.id),
          { sortOrder: index }
        );
      });
      await batch.commit();
    } catch {
      toast({
        title: "Error",
        description: "Failed to reorder capabilities.",
        variant: "destructive",
      });
    }
  };

  const handleSaveCapability = async () => {
    if (!capabilityForm.title.trim()) return;

    try {
      if (editingCapabilityId) {
        await updateDoc(
          doc(db, "companies", companyId, "priorities", editingCapabilityId),
          { ...capabilityForm, updatedAt: new Date().toISOString() }
        );
        toast({ title: "Capability updated", description: capabilityForm.title });
      } else {
        const maxSortOrder = capabilities.reduce(
          (max, item) => Math.max(max, item.sortOrder ?? 0),
          0
        );
        await addDoc(collection(db, "companies", companyId, "priorities"), {
          ...capabilityForm,
          type: "capability",
          planYear: selectedYear,
          companyId,
          sortOrder: maxSortOrder + 1,
          createdAt: new Date().toISOString(),
        });
        toast({ title: "Capability created", description: capabilityForm.title });
      }
      resetCapabilityForm();
    } catch {
      toast({
        title: "Error",
        description: "Failed to save the capability.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCapability = async (id: string) => {
    try {
      await deleteDoc(doc(db, "companies", companyId, "priorities", id));
      toast({ title: "Capability deleted" });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete the capability.",
        variant: "destructive",
      });
    }
  };

  const startEditCapability = (capability: Capability) => {
    setEditingCapabilityId(capability.id);
    setCapabilityForm({
      title: capability.title ?? "",
      description: capability.description ?? "",
      executiveChampion: capability.executiveChampion ?? "",
      successStatement: capability.successStatement ?? "",
      owner: capability.owner ?? "",
    });
    setShowCapabilityForm(true);
  };

  const resetCapabilityForm = () => {
    setShowCapabilityForm(false);
    setEditingCapabilityId(null);
    setCapabilityForm(emptyCapabilityForm);
  };

  if (goalsLoading && capabilitiesLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Priorities & Capabilities</CardTitle>
            <CardDescription>
              Annual priorities are goals, so they carry RACI, quarterly
              targets, and rocks. Capabilities stay a lighter planning list.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={openNewGoal} size="sm" data-testid="button-add-priority">
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Annual Priority
            </Button>
            <Button
              onClick={() => {
                setEditingCapabilityId(null);
                setCapabilityForm(emptyCapabilityForm);
                setShowCapabilityForm((v) => !v);
              }}
              variant="outline"
              size="sm"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Capability
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showCapabilityForm && (
            <Card className="mb-6 bg-muted/20">
              <CardContent className="pt-6">
                <div className="grid gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Title</label>
                    <Input
                      value={capabilityForm.title}
                      onChange={(e) =>
                        setCapabilityForm({
                          ...capabilityForm,
                          title: e.target.value,
                        })
                      }
                      placeholder="Enter title..."
                      autoFocus
                      data-testid="input-priority-title"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Description
                    </label>
                    <Textarea
                      value={capabilityForm.description}
                      onChange={(e) =>
                        setCapabilityForm({
                          ...capabilityForm,
                          description: e.target.value,
                        })
                      }
                      placeholder="Enter description..."
                      rows={3}
                      data-testid="textarea-priority-description"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">
                        Executive Champion
                      </label>
                      <Input
                        value={capabilityForm.executiveChampion}
                        onChange={(e) =>
                          setCapabilityForm({
                            ...capabilityForm,
                            executiveChampion: e.target.value,
                          })
                        }
                        placeholder="Enter executive champion..."
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">
                        Success Statement
                      </label>
                      <Input
                        value={capabilityForm.successStatement}
                        onChange={(e) =>
                          setCapabilityForm({
                            ...capabilityForm,
                            successStatement: e.target.value,
                          })
                        }
                        placeholder="Enter success statement..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Owner
                    </label>
                    <UserCombobox
                      value={capabilityForm.owner}
                      onValueChange={(v) =>
                        setCapabilityForm({ ...capabilityForm, owner: v })
                      }
                      placeholder="Select an owner"
                      valueMode="name"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetCapabilityForm}
                      data-testid="button-cancel-add"
                    >
                      <XIcon className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveCapability}
                      disabled={!capabilityForm.title.trim()}
                      data-testid="button-save-priority"
                    >
                      <CheckIcon className="h-4 w-4 mr-1" />
                      {editingCapabilityId ? "Save Changes" : "Create"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <TargetIcon className="h-5 w-5 mr-2 text-primary" />
                Annual Priorities
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  (drag to reorder)
                </span>
              </h3>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleGoalsDragEnd}
              >
                <SortableContext
                  items={annualGoals.map((g) => g.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {annualGoals.length === 0 ? (
                      <div className="text-muted-foreground text-sm py-4 text-center">
                        No annual priorities yet. Click "Add Annual Priority" to
                        create one.
                      </div>
                    ) : (
                      annualGoals.map((goal) => (
                        <SortableItem key={goal.id} id={goal.id}>
                          <GoalCard goal={goal} onEdit={openEditGoal} />
                        </SortableItem>
                      ))
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <TrendingUpIcon className="h-5 w-5 mr-2 text-primary" />
                Capabilities
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  (drag to reorder)
                </span>
              </h3>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleCapabilitiesDragEnd}
              >
                <SortableContext
                  items={capabilities.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {capabilities.length === 0 ? (
                      <div className="text-muted-foreground text-sm py-4 text-center">
                        No capabilities yet. Click "Add Capability" to create
                        one.
                      </div>
                    ) : (
                      capabilities.map((capability) => (
                        <SortableItem key={capability.id} id={capability.id}>
                          <Card className="hover-elevate group">
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <h4 className="font-medium">
                                      {capability.title}
                                    </h4>
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      Capability
                                    </Badge>
                                  </div>
                                  {capability.description && (
                                    <p className="text-sm text-muted-foreground">
                                      {capability.description}
                                    </p>
                                  )}
                                  {(capability.executiveChampion ||
                                    capability.successStatement ||
                                    capability.owner) && (
                                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                      {capability.owner && (
                                        <div>
                                          <span className="font-medium text-muted-foreground">
                                            Owner:{" "}
                                          </span>
                                          <span>{capability.owner}</span>
                                        </div>
                                      )}
                                      {capability.executiveChampion && (
                                        <div>
                                          <span className="font-medium text-muted-foreground">
                                            Champion:{" "}
                                          </span>
                                          <span>
                                            {capability.executiveChampion}
                                          </span>
                                        </div>
                                      )}
                                      {capability.successStatement && (
                                        <div>
                                          <span className="font-medium text-muted-foreground">
                                            Success:{" "}
                                          </span>
                                          <span>
                                            {capability.successStatement}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div className="mt-3">
                                    <RockSection
                                      goalId={capability.id}
                                      rocks={byGoal.get(capability.id) ?? []}
                                      canEdit={Boolean(user)}
                                      linkOptions={capabilityLinkOptions}
                                    />
                                  </div>
                                </div>
                                <ActionMenu
                                  onEdit={() => startEditCapability(capability)}
                                  onDelete={() =>
                                    handleDeleteCapability(capability.id)
                                  }
                                />
                              </div>
                            </CardContent>
                          </Card>
                        </SortableItem>
                      ))
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </CardContent>
      </Card>

      <GoalForm
        open={goalFormOpen}
        onOpenChange={setGoalFormOpen}
        goal={editingGoal}
        defaultLevel="annual"
      />
    </div>
  );
}
