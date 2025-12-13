import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  PlusIcon,
  CheckIcon,
  XIcon,
  TrendingUpIcon,
  TargetIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from "lucide-react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, type Unsubscribe } from "firebase/firestore";
import { LEGACY_PLAN_YEAR, usePlanYear } from "@/contexts/PlanYearContext";

export default function PriorityManagement() {
  const { toast } = useToast();
  const { companyId, selectedYear, availableYears } = usePlanYear();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", type: "priority", executiveChampion: "", successStatement: "", owner: "", dueDate: "", planYear: selectedYear });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newForm, setNewForm] = useState({ title: "", description: "", type: "priority", executiveChampion: "", successStatement: "", owner: "", dueDate: "", planYear: selectedYear });
  const [expandedPriority, setExpandedPriority] = useState<string | null>(null);
  const [expandedCapability, setExpandedCapability] = useState<string | null>(null);
  const [addingRockTo, setAddingRockTo] = useState<string | null>(null);
  const [newRockForm, setNewRockForm] = useState({ text: "", assigneeId: "", assigneeName: "", quarter: "Q1", year: selectedYear, priority: false });
  const [editingRock, setEditingRock] = useState<string | null>(null);
  const [editRockForm, setEditRockForm] = useState({ text: "", assigneeId: "", assigneeName: "", quarter: "Q1", year: selectedYear, priority: false });
  
  const [prioritiesData, setPrioritiesData] = useState<any[]>([]);
  const [rocksData, setRocksData] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const yearOptions = Array.from(new Set<number>([...availableYears, selectedYear, selectedYear + 1])).sort((a, b) => a - b);

  useEffect(() => {
    let unsubPrioritiesYear: Unsubscribe | undefined;
    let unsubPrioritiesLegacy: Unsubscribe | undefined;
    let unsubRocksYear: Unsubscribe | undefined;
    let unsubRocksLegacy: Unsubscribe | undefined;

    const prioritiesById = new Map<string, any>();
    const applyPriorities = () => {
      setPrioritiesData(Array.from(prioritiesById.values()));
      setLoading(false);
    };

    const prioritiesCol = collection(db, "companies", companyId, "priorities");
    const qPrioritiesYear = query(prioritiesCol, where("planYear", "==", selectedYear));
    unsubPrioritiesYear = onSnapshot(qPrioritiesYear, (snapshot) => {
      prioritiesById.clear();
      snapshot.forEach((d) => prioritiesById.set(d.id, { id: d.id, ...d.data() }));
      applyPriorities();
    });

    if (selectedYear === LEGACY_PLAN_YEAR) {
      const qPrioritiesLegacy = query(prioritiesCol, where("planYear", "==", null));
      unsubPrioritiesLegacy = onSnapshot(
        qPrioritiesLegacy,
        (snapshot) => {
          snapshot.forEach((d) => {
            if (!prioritiesById.has(d.id)) prioritiesById.set(d.id, { id: d.id, ...d.data() });
          });
          applyPriorities();
        },
        () => {
          // ignore
        }
      );
    }

    const rocksById = new Map<string, any>();
    const applyRocks = () => setRocksData(Array.from(rocksById.values()));

    const rocksCol = collection(db, "companies", companyId, "rocks");
    const qRocksYear = query(rocksCol, where("year", "==", selectedYear));
    unsubRocksYear = onSnapshot(qRocksYear, (snapshot) => {
      rocksById.clear();
      snapshot.forEach((d) => rocksById.set(d.id, { id: d.id, ...d.data() }));
      applyRocks();
    });

    if (selectedYear === LEGACY_PLAN_YEAR) {
      const qRocksLegacy = query(rocksCol, where("year", "==", null));
      unsubRocksLegacy = onSnapshot(
        qRocksLegacy,
        (snapshot) => {
          snapshot.forEach((d) => {
            if (!rocksById.has(d.id)) rocksById.set(d.id, { id: d.id, ...d.data() });
          });
          applyRocks();
        },
        () => {
          // ignore
        }
      );
    }

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      setUsers(items);
    });

    return () => {
      unsubPrioritiesYear?.();
      unsubPrioritiesLegacy?.();
      unsubRocksYear?.();
      unsubRocksLegacy?.();
      unsubUsers();
    };
  }, [companyId, selectedYear]);

  useEffect(() => {
    setNewRockForm((prev) => ({ ...prev, year: selectedYear }));
    setEditRockForm((prev) => ({ ...prev, year: selectedYear }));
  }, [selectedYear]);

  useEffect(() => {
    setNewForm((prev) => ({ ...prev, planYear: selectedYear }));
  }, [selectedYear]);

  // Attach rocks to priorities
  const prioritiesWithRocks = prioritiesData.map(p => ({
    ...p,
    rocks: rocksData.filter(r => r.priorityId === p.id)
  }));

  const handleAdd = async () => {
    if (!newForm.title.trim()) return;

    try {
      await addDoc(collection(db, 'companies', companyId, 'priorities'), {
        ...newForm,
        planYear: newForm.planYear ?? selectedYear,
        companyId,
        createdAt: new Date().toISOString()
      });
      
      setShowAddForm(false);
      setNewForm({ title: "", description: "", type: "priority", executiveChampion: "", successStatement: "", owner: "", dueDate: "", planYear: selectedYear });
      toast({ title: "Success", description: "Priority created" });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to create priority", variant: "destructive" });
    }
  };

  const handleEdit = (priority: any) => {
    setEditingId(priority.id);
    setEditForm({
      title: priority.title,
      description: priority.description || "",
      type: priority.type || "priority",
      executiveChampion: priority.executiveChampion || "",
      successStatement: priority.successStatement || "",
      owner: priority.owner || "",
      dueDate: priority.dueDate || "",
      planYear: typeof priority.planYear === "number" ? priority.planYear : selectedYear
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      await updateDoc(doc(db, 'companies', companyId, 'priorities', editingId), editForm);
      setEditingId(null);
      toast({ title: "Success", description: "Priority updated" });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to update priority", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'companies', companyId, 'priorities', id));
      toast({ title: "Success", description: "Priority deleted" });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to delete priority", variant: "destructive" });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ title: "", description: "", type: "priority", executiveChampion: "", successStatement: "", owner: "", dueDate: "", planYear: selectedYear });
  };

  const handleAddRock = async (priorityId: string) => {
    if (!newRockForm.text.trim()) {
      toast({ title: "Error", description: "Rock text is required", variant: "destructive" });
      return;
    }
    
    try {
      const assignee = users.find((u: any) => u.id === newRockForm.assigneeId);
      await addDoc(collection(db, 'companies', companyId, 'rocks'), {
        priorityId: priorityId,
        text: newRockForm.text,
        quarter: newRockForm.quarter,
        year: newRockForm.year ?? selectedYear,
        assigneeId: newRockForm.assigneeId || null,
        assigneeName: assignee?.name || null,
        status: 'not_started',
        priority: newRockForm.priority,
        createdAt: new Date().toISOString()
      });
      
      setAddingRockTo(null);
      setNewRockForm({ text: "", assigneeId: "", assigneeName: "", quarter: "Q1", year: selectedYear, priority: false });
      toast({ title: "Success", description: "Rock added" });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to add rock", variant: "destructive" });
    }
  };

  const handleEditRock = (rock: any) => {
    setEditingRock(rock.id);
    setEditRockForm({
      text: rock.text,
      assigneeId: rock.assigneeId || "",
      assigneeName: rock.assigneeName || "",
      quarter: rock.quarter || "Q1",
      year: rock.year || selectedYear,
      priority: rock.priority || false
    });
  };

  const handleSaveRock = async () => {
    if (!editingRock) return;
    try {
      const assignee = users.find((u: any) => u.id === editRockForm.assigneeId);
      const rockRef = doc(db, 'companies', companyId, 'rocks', editingRock);
      await updateDoc(rockRef, {
        text: editRockForm.text,
        quarter: editRockForm.quarter,
        year: editRockForm.year,
        assigneeId: editRockForm.assigneeId || null,
        assigneeName: assignee?.name || null,
        priority: editRockForm.priority
      });
      setEditingRock(null);
      toast({ title: "Success", description: "Rock updated" });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to update rock", variant: "destructive" });
    }
  };

  const handleDeleteRock = async (rockId: string) => {
    try {
      await deleteDoc(doc(db, 'companies', companyId, 'rocks', rockId));
      toast({ title: "Success", description: "Rock deleted" });
    } catch (error) {
       console.error(error);
       toast({ title: "Error", description: "Failed to delete rock", variant: "destructive" });
    }
  };
  
  const handleCancelRockEdit = () => {
    setEditingRock(null);
    setEditRockForm({ text: "", assigneeId: "", assigneeName: "", quarter: "Q1", year: selectedYear, priority: false });
  };
  
  const groupRocksByQuarter = (rocks: any[]) => {
    const grouped: { [key: string]: any[] } = { Q1: [], Q2: [], Q3: [], Q4: [] };
    rocks.forEach((rock) => {
      const quarter = rock.quarter || 'Q1';
      if (grouped[quarter]) {
        grouped[quarter].push(rock);
      }
    });
    return grouped;
  };
  
  const capabilities = prioritiesWithRocks.filter((p: any) => p.type === 'capability');
  const annualPriorities = prioritiesWithRocks.filter((p: any) => p.type === 'priority');
  
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading priorities...</div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Priority & Capability Management</CardTitle>
            <CardDescription>
              Manage your strategic priorities and capabilities that feed into the roadmap canvas
            </CardDescription>
          </div>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            variant="default"
            size="sm"
            data-testid="button-add-priority"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add New
          </Button>
        </CardHeader>
        <CardContent>
          {showAddForm && (
            <Card className="mb-6 bg-muted/20">
              <CardContent className="pt-6">
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Type</label>
                      <Select
                        value={newForm.type}
                        onValueChange={(value) => setNewForm({ ...newForm, type: value })}
                      >
                        <SelectTrigger data-testid="select-priority-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="priority">Annual Priority</SelectItem>
                          <SelectItem value="capability">Capability</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Title</label>
                      <Input
                        value={newForm.title}
                        onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
                        placeholder="Enter title..."
                        data-testid="input-priority-title"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Description</label>
                    <Textarea
                      value={newForm.description}
                      onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                      placeholder="Enter description..."
                      rows={3}
                      data-testid="textarea-priority-description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Executive Champion</label>
                      <Input
                        value={newForm.executiveChampion}
                        onChange={(e) => setNewForm({ ...newForm, executiveChampion: e.target.value })}
                        placeholder="Enter executive champion..."
                        data-testid="input-priority-executive-champion"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Success Statement</label>
                      <Input
                        value={newForm.successStatement}
                        onChange={(e) => setNewForm({ ...newForm, successStatement: e.target.value })}
                        placeholder="Enter success statement..."
                        data-testid="input-priority-success-statement"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Owner/Person Responsible</label>
                      <Select
                        value={newForm.owner || "unassigned"}
                        onValueChange={(value) => setNewForm({ ...newForm, owner: value === "unassigned" ? "" : value })}
                      >
                        <SelectTrigger data-testid="select-priority-owner">
                          <SelectValue placeholder="Select owner/person responsible" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {users.map((user: any) => (
                            <SelectItem key={user.id} value={user.name || user.email}>
                              {user.name || user.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Due Date/Quarter</label>
                      <Input
                        value={newForm.dueDate}
                        onChange={(e) => setNewForm({ ...newForm, dueDate: e.target.value })}
                        placeholder="Enter due date/quarter (e.g., Q1 2025)..."
                        data-testid="input-priority-due-date"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowAddForm(false);
                        setNewForm({ title: "", description: "", type: "priority", executiveChampion: "", successStatement: "", owner: "", dueDate: "", planYear: selectedYear });
                      }}
                      data-testid="button-cancel-add"
                    >
                      <XIcon className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleAdd}
                      disabled={!newForm.title.trim()}
                      data-testid="button-save-priority"
                    >
                      <CheckIcon className="h-4 w-4 mr-1" />
                      Create
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <TrendingUpIcon className="h-5 w-5 mr-2 text-primary" />
                Capabilities
              </h3>
              <div className="space-y-3">
                {capabilities.length === 0 ? (
                  <div className="text-muted-foreground text-sm py-4 text-center">
                    No capabilities added yet. Click "Add New" to create one.
                  </div>
                ) : (
                  capabilities.map((capability: any) => (
                    <Card key={capability.id} className="hover-elevate group">
                      <CardContent className="pt-4">
                        {editingId === capability.id ? (
                          <div className="space-y-3">
                            <Input
                              value={editForm.title}
                              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                              placeholder="Title"
                              data-testid={`input-edit-title-${capability.id}`}
                            />
                            <Textarea
                              value={editForm.description}
                              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                              placeholder="Description"
                              rows={2}
                              data-testid={`textarea-edit-description-${capability.id}`}
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <Input
                                value={editForm.executiveChampion}
                                onChange={(e) => setEditForm({ ...editForm, executiveChampion: e.target.value })}
                                placeholder="Executive Champion"
                                data-testid={`input-edit-exec-champion-${capability.id}`}
                              />
                              <Input
                                value={editForm.successStatement}
                                onChange={(e) => setEditForm({ ...editForm, successStatement: e.target.value })}
                                placeholder="Success Statement"
                                data-testid={`input-edit-success-statement-${capability.id}`}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <Select
                                value={editForm.owner || "unassigned"}
                                onValueChange={(value) => setEditForm({ ...editForm, owner: value === "unassigned" ? "" : value })}
                              >
                                <SelectTrigger data-testid={`select-edit-owner-${capability.id}`}>
                                  <SelectValue placeholder="Select owner/person responsible" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">Unassigned</SelectItem>
                                  {users.map((user: any) => (
                                    <SelectItem key={user.id} value={user.name || user.email}>
                                      {user.name || user.email}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                value={editForm.dueDate}
                                onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                                placeholder="Due Date/Quarter (e.g., Q1 2025)"
                                data-testid={`input-edit-due-date-${capability.id}`}
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCancelEdit}
                                data-testid={`button-cancel-edit-${capability.id}`}
                              >
                                <XIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={handleSaveEdit}
                                data-testid={`button-save-edit-${capability.id}`}
                              >
                                <CheckIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium">{capability.title}</h4>
                                  <Badge variant="secondary" className="text-xs">
                                    Capability
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {capability.description}
                                </p>
                                {(capability.executiveChampion || capability.successStatement) && (
                                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                    {capability.executiveChampion && (
                                      <div>
                                        <span className="font-medium text-muted-foreground">Champion: </span>
                                        <span>{capability.executiveChampion}</span>
                                      </div>
                                    )}
                                    {capability.successStatement && (
                                      <div>
                                        <span className="font-medium text-muted-foreground">Success: </span>
                                        <span>{capability.successStatement}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div className="mt-2 flex items-center gap-2">
                                  {capability.rocks && capability.rocks.length > 0 ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setExpandedCapability(
                                        expandedCapability === capability.id ? null : capability.id
                                      )}
                                      className="text-xs p-0 h-auto hover:bg-transparent"
                                      data-testid={`button-expand-rocks-${capability.id}`}
                                    >
                                      {expandedCapability === capability.id ? (
                                        <ChevronDownIcon className="h-4 w-4 mr-1" />
                                      ) : (
                                        <ChevronRightIcon className="h-4 w-4 mr-1" />
                                      )}
                                      <span className="text-muted-foreground">
                                        {capability.rocks.length} rocks
                                      </span>
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">No rocks yet</span>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setAddingRockTo(capability.id);
                                      setExpandedCapability(capability.id);
                                    }}
                                    className="text-xs h-6 px-2 border-dashed"
                                    data-testid={`button-add-rock-to-capability-${capability.id}`}
                                  >
                                    <PlusIcon className="h-3 w-3 mr-1" />
                                    Add Rock
                                  </Button>
                                </div>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <ActionMenu
                                  onEdit={() => handleEdit(capability)}
                                  onDelete={() => handleDelete(capability.id)}
                                  testId={`action-menu-${capability.id}`}
                                />
                              </div>
                            </div>
                            
                            {expandedCapability === capability.id && (
                              <div className="mt-4 pl-4 border-l-2 border-muted space-y-2">
                                {capability.rocks && capability.rocks.length > 0 ? (
                                  capability.rocks.map((rock: any) => (
                                  <div key={rock.id} className="flex items-start justify-between gap-2 p-2 rounded bg-muted/30">
                                    {editingRock === rock.id ? (
                                      <div className="flex-1 space-y-2">
                                        <Input
                                          value={editRockForm.text}
                                          onChange={(e) => setEditRockForm({ ...editRockForm, text: e.target.value })}
                                          placeholder="Rock text"
                                          className="text-sm"
                                          data-testid={`input-edit-rock-text-${rock.id}`}
                                        />
                                        <Select
                                          value={editRockForm.assigneeId || "unassigned"}
                                          onValueChange={(value) => setEditRockForm({ ...editRockForm, assigneeId: value === "unassigned" ? "" : value })}
                                        >
                                          <SelectTrigger className="text-sm" data-testid={`select-edit-rock-assignee-${rock.id}`}>
                                            <SelectValue placeholder="Select assignee" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="unassigned">Unassigned</SelectItem>
                                            {users.map((user: any) => (
                                              <SelectItem key={user.id} value={user.id}>
                                                {user.name || user.email}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <div className="grid grid-cols-2 gap-2">
                                          <Select
                                            value={editRockForm.quarter}
                                            onValueChange={(value) => setEditRockForm({ ...editRockForm, quarter: value })}
                                          >
                                            <SelectTrigger className="text-sm" data-testid={`select-edit-rock-quarter-${rock.id}`}>
                                              <SelectValue placeholder="Quarter" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="Q1">Q1</SelectItem>
                                              <SelectItem value="Q2">Q2</SelectItem>
                                              <SelectItem value="Q3">Q3</SelectItem>
                                              <SelectItem value="Q4">Q4</SelectItem>
                                            </SelectContent>
                                          </Select>
                                          <Select
                                            value={editRockForm.year.toString()}
                                            onValueChange={(value) => setEditRockForm({ ...editRockForm, year: parseInt(value) })}
                                          >
                                            <SelectTrigger className="text-sm" data-testid={`select-edit-rock-year-${rock.id}`}>
                                              <SelectValue placeholder="Year" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {yearOptions.map((y) => (
                                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          <input
                                            type="checkbox"
                                            checked={editRockForm.priority}
                                            onChange={(e) => setEditRockForm({ ...editRockForm, priority: e.target.checked })}
                                            className="h-4 w-4 rounded border-input"
                                            data-testid={`checkbox-edit-rock-priority-${rock.id}`}
                                          />
                                          <label className="text-sm text-muted-foreground">High Priority (Move to Top)</label>
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            variant="default"
                                            size="sm"
                                            onClick={handleSaveRock}
                                            data-testid={`button-save-rock-${rock.id}`}
                                          >
                                            <CheckIcon className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleCancelRockEdit}
                                            data-testid={`button-cancel-edit-rock-${rock.id}`}
                                          >
                                            <XIcon className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex-1">
                                          <p className="text-sm">{rock.text}</p>
                                          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                                            <span>{rock.quarter} {rock.year}</span>
                                            {rock.assigneeName && (
                                              <span>• {rock.assigneeName}</span>
                                            )}
                                          </div>
                                        </div>
                                        <ActionMenu
                                          onEdit={() => handleEditRock(rock)}
                                          onDelete={() => handleDeleteRock(rock.id)}
                                          testId={`action-menu-rock-${rock.id}`}
                                        />
                                      </>
                                    )}
                                  </div>
                                  ))
                                ) : (
                                  <div className="text-center py-4 text-muted-foreground text-sm">
                                    No rocks yet. Click "Add Rock" to get started.
                                  </div>
                                )}
                                
                                {addingRockTo === capability.id ? (
                                  <div className="p-2 rounded bg-muted/50 space-y-2">
                                    <Input
                                      value={newRockForm.text}
                                      onChange={(e) => setNewRockForm({ ...newRockForm, text: e.target.value })}
                                      placeholder="Enter rock text..."
                                      className="text-sm"
                                      autoFocus
                                      data-testid={`input-new-rock-text-${capability.id}`}
                                    />
                                    <Select
                                      value={newRockForm.assigneeId || "unassigned"}
                                      onValueChange={(value) => setNewRockForm({ ...newRockForm, assigneeId: value === "unassigned" ? "" : value })}
                                    >
                                      <SelectTrigger className="text-sm" data-testid={`select-new-rock-assignee-${capability.id}`}>
                                        <SelectValue placeholder="Select assignee (optional)" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="unassigned">Unassigned</SelectItem>
                                        {users.map((user: any) => (
                                          <SelectItem key={user.id} value={user.id}>
                                            {user.name || user.email}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <div className="grid grid-cols-2 gap-2">
                                      <Select
                                        value={newRockForm.quarter}
                                        onValueChange={(value) => setNewRockForm({ ...newRockForm, quarter: value })}
                                      >
                                        <SelectTrigger className="text-sm" data-testid={`select-new-rock-quarter-${capability.id}`}>
                                          <SelectValue placeholder="Quarter" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Q1">Q1</SelectItem>
                                          <SelectItem value="Q2">Q2</SelectItem>
                                          <SelectItem value="Q3">Q3</SelectItem>
                                          <SelectItem value="Q4">Q4</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Select
                                        value={newRockForm.year.toString()}
                                        onValueChange={(value) => setNewRockForm({ ...newRockForm, year: parseInt(value) })}
                                      >
                                        <SelectTrigger className="text-sm" data-testid={`select-new-rock-year-${capability.id}`}>
                                          <SelectValue placeholder="Year" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {yearOptions.map((y) => (
                                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        checked={newRockForm.priority}
                                        onChange={(e) => setNewRockForm({ ...newRockForm, priority: e.target.checked })}
                                        className="h-4 w-4 rounded border-input"
                                        data-testid={`checkbox-new-rock-priority-${capability.id}`}
                                      />
                                      <label className="text-sm text-muted-foreground">High Priority (Move to Top)</label>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => handleAddRock(capability.id)}
                                        data-testid={`button-save-new-rock-${capability.id}`}
                                      >
                                        <CheckIcon className="h-3 w-3 mr-1" />
                                        Add
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setAddingRockTo(null);
                                          setNewRockForm({ text: "", assigneeId: "", assigneeName: "", quarter: "Q1", year: selectedYear, priority: false });
                                        }}
                                        data-testid={`button-cancel-new-rock-${capability.id}`}
                                      >
                                        <XIcon className="h-3 w-3 mr-1" />
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setAddingRockTo(capability.id)}
                                    className="w-full text-xs border-dashed"
                                    data-testid={`button-add-rock-${capability.id}`}
                                  >
                                    <PlusIcon className="h-3 w-3 mr-1" />
                                    Add Rock
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <TargetIcon className="h-5 w-5 mr-2 text-primary" />
                Annual Priorities
              </h3>
              <div className="space-y-3">
                {annualPriorities.length === 0 ? (
                  <div className="text-muted-foreground text-sm py-4 text-center">
                    No annual priorities added yet. Click "Add New" to create one.
                  </div>
                ) : (
                  annualPriorities.map((priority: any) => (
                    <Card key={priority.id} className="hover-elevate group">
                      <CardContent className="pt-4">
                        {editingId === priority.id ? (
                           <div className="space-y-3">
                            {/* Edit Form for Priority */}
                            <Input value={editForm.title} onChange={(e) => setEditForm({...editForm, title: e.target.value})} placeholder="Title" />
                            <Textarea value={editForm.description} onChange={(e) => setEditForm({...editForm, description: e.target.value})} placeholder="Description" rows={2} />
                            <div className="grid grid-cols-2 gap-3">
                                <Input value={editForm.executiveChampion} onChange={(e) => setEditForm({...editForm, executiveChampion: e.target.value})} placeholder="Executive Champion" />
                                <Input value={editForm.successStatement} onChange={(e) => setEditForm({...editForm, successStatement: e.target.value})} placeholder="Success Statement" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Select value={editForm.owner || "unassigned"} onValueChange={(v) => setEditForm({...editForm, owner: v === "unassigned" ? "" : v})}>
                                    <SelectTrigger><SelectValue placeholder="Owner" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">Unassigned</SelectItem>
                                        {users.map(u => <SelectItem key={u.id} value={u.name || u.email}>{u.name || u.email}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Input value={editForm.dueDate} onChange={(e) => setEditForm({...editForm, dueDate: e.target.value})} placeholder="Due Date" />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={handleCancelEdit}><XIcon className="h-4 w-4" /></Button>
                                <Button variant="default" size="sm" onClick={handleSaveEdit}><CheckIcon className="h-4 w-4" /></Button>
                            </div>
                           </div>
                        ) : (
                           <div>
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-medium">{priority.title}</h4>
                                        <Badge variant="outline" className="text-xs">Priority</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{priority.description}</p>
                                    {(priority.executiveChampion || priority.successStatement) && (
                                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                            {priority.executiveChampion && <div><span className="font-medium text-muted-foreground">Champion: </span><span>{priority.executiveChampion}</span></div>}
                                            {priority.successStatement && <div><span className="font-medium text-muted-foreground">Success: </span><span>{priority.successStatement}</span></div>}
                                        </div>
                                    )}
                                    <div className="mt-2 flex items-center gap-2">
                                        {priority.rocks && priority.rocks.length > 0 ? (
                                            <Button variant="ghost" size="sm" onClick={() => setExpandedPriority(expandedPriority === priority.id ? null : priority.id)} className="text-xs p-0 h-auto hover:bg-transparent">
                                                {expandedPriority === priority.id ? <ChevronDownIcon className="h-4 w-4 mr-1" /> : <ChevronRightIcon className="h-4 w-4 mr-1" />}
                                                <span className="text-muted-foreground">{priority.rocks.length} rocks</span>
                                            </Button>
                                        ) : <span className="text-xs text-muted-foreground">No rocks yet</span>}
                                        <Button variant="outline" size="sm" onClick={() => { setAddingRockTo(priority.id); setExpandedPriority(priority.id); }} className="text-xs h-6 px-2 border-dashed"><PlusIcon className="h-3 w-3 mr-1" />Add Rock</Button>
                                    </div>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ActionMenu onEdit={() => handleEdit(priority)} onDelete={() => handleDelete(priority.id)} />
                                </div>
                            </div>

                            {expandedPriority === priority.id && (
                                <div className="mt-4 ml-4 space-y-2">
                                    {priority.rocks && priority.rocks.length > 0 && (
                                        <div className="mt-4 pl-4 border-l-2 border-muted space-y-3">
                                            {(() => {
                                                const rocksByQuarter = groupRocksByQuarter(priority.rocks);
                                                return (['Q1', 'Q2', 'Q3', 'Q4'] as const).map(quarter => {
                                                    const quarterRocks = rocksByQuarter[quarter] || [];
                                                    if (quarterRocks.length === 0 && addingRockTo !== priority.id) return null;
                                                    return (
                                                        <div key={quarter} className="space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="secondary" className="text-xs">{quarter}</Badge>
                                                                <span className="text-xs text-muted-foreground">{quarterRocks.length} rocks</span>
                                                            </div>
                                                            {quarterRocks.map((rock: any) => (
                                                                <div key={rock.id} className="flex items-start justify-between gap-2 p-2 rounded bg-muted/30">
                                                                    {editingRock === rock.id ? (
                                                                        // Edit Rock Form
                                                                        <div className="flex-1 space-y-2">
                                                                            <Input value={editRockForm.text} onChange={(e) => setEditRockForm({...editRockForm, text: e.target.value})} placeholder="Rock text" className="text-sm" />
                                                                            <Select value={editRockForm.assigneeId || "unassigned"} onValueChange={(v) => setEditRockForm({...editRockForm, assigneeId: v === "unassigned" ? "" : v})}>
                                                                                <SelectTrigger className="text-sm"><SelectValue placeholder="Assignee" /></SelectTrigger>
                                                                                <SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}</SelectContent>
                                                                            </Select>
                                                                            <div className="grid grid-cols-2 gap-2">
                                                                                <Select value={editRockForm.quarter} onValueChange={(v) => setEditRockForm({...editRockForm, quarter: v})}><SelectTrigger className="text-sm"><SelectValue placeholder="Quarter" /></SelectTrigger><SelectContent><SelectItem value="Q1">Q1</SelectItem><SelectItem value="Q2">Q2</SelectItem><SelectItem value="Q3">Q3</SelectItem><SelectItem value="Q4">Q4</SelectItem></SelectContent></Select>
                                                                                <Select value={editRockForm.year.toString()} onValueChange={(v) => setEditRockForm({...editRockForm, year: parseInt(v)})}><SelectTrigger className="text-sm"><SelectValue placeholder="Year" /></SelectTrigger><SelectContent>{yearOptions.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}</SelectContent></Select>
                                                                            </div>
                                                                            <div className="flex items-center space-x-2">
                                                                                <input type="checkbox" checked={editRockForm.priority} onChange={(e) => setEditRockForm({...editRockForm, priority: e.target.checked})} className="h-4 w-4 rounded border-input" />
                                                                                <label className="text-sm text-muted-foreground">High Priority</label>
                                                                            </div>
                                                                            <div className="flex gap-2"><Button size="sm" onClick={handleSaveRock}><CheckIcon className="h-3 w-3" /></Button><Button size="sm" variant="ghost" onClick={handleCancelRockEdit}><XIcon className="h-3 w-3" /></Button></div>
                                                                        </div>
                                                                    ) : (
                                                                        // View Rock
                                                                        <>
                                                                        <div className="flex-1">
                                                                            <p className="text-sm">{rock.text}</p>
                                                                            <div className="flex gap-3 mt-1 text-xs text-muted-foreground"><span>{rock.quarter} {rock.year}</span>{rock.assigneeName && <span>• {rock.assigneeName}</span>}</div>
                                                                        </div>
                                                                        <ActionMenu onEdit={() => handleEditRock(rock)} onDelete={() => handleDeleteRock(rock.id)} />
                                                                        </>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            {addingRockTo === priority.id && quarter === newRockForm.quarter && (
                                                                <div className="p-2 rounded bg-muted/50 space-y-2">
                                                                    <Input value={newRockForm.text} onChange={(e) => setNewRockForm({...newRockForm, text: e.target.value})} placeholder="New rock..." autoFocus className="text-sm" />
                                                                    <Select value={newRockForm.assigneeId || "unassigned"} onValueChange={(v) => setNewRockForm({...newRockForm, assigneeId: v === "unassigned" ? "" : v})}>
                                                                        <SelectTrigger className="text-sm"><SelectValue placeholder="Assignee" /></SelectTrigger>
                                                                        <SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}</SelectContent>
                                                                    </Select>
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <Select value={newRockForm.quarter} onValueChange={(v) => setNewRockForm({...newRockForm, quarter: v})}><SelectTrigger className="text-sm"><SelectValue placeholder="Quarter" /></SelectTrigger><SelectContent><SelectItem value="Q1">Q1</SelectItem><SelectItem value="Q2">Q2</SelectItem><SelectItem value="Q3">Q3</SelectItem><SelectItem value="Q4">Q4</SelectItem></SelectContent></Select>
                                                                        <Select value={newRockForm.year.toString()} onValueChange={(v) => setNewRockForm({...newRockForm, year: parseInt(v)})}><SelectTrigger className="text-sm"><SelectValue placeholder="Year" /></SelectTrigger><SelectContent>{yearOptions.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}</SelectContent></Select>
                                                                    </div>
                                                                    <div className="flex items-center space-x-2"><input type="checkbox" checked={newRockForm.priority} onChange={(e) => setNewRockForm({...newRockForm, priority: e.target.checked})} className="h-4 w-4 rounded border-input" /><label className="text-sm text-muted-foreground">High Priority</label></div>
                                                                    <div className="flex gap-2"><Button size="sm" onClick={() => handleAddRock(priority.id)}><CheckIcon className="h-3 w-3 mr-1" />Add</Button><Button size="sm" variant="ghost" onClick={() => setAddingRockTo(null)}><XIcon className="h-3 w-3 mr-1" />Cancel</Button></div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            })()}
                                            {priority.rocks.length === 0 && addingRockTo !== priority.id && <div className="text-center py-4 text-muted-foreground text-sm">No rocks yet.</div>}
                                            {addingRockTo !== priority.id && <Button variant="outline" size="sm" onClick={() => { setAddingRockTo(priority.id); setNewRockForm({...newRockForm, quarter: "Q1"}); }} className="w-full text-xs border-dashed"><PlusIcon className="h-3 w-3 mr-1" />Add Rock</Button>}
                                        </div>
                                    )}
                                    {(!priority.rocks || priority.rocks.length === 0) && addingRockTo === priority.id && (
                                        <div className="mt-4 pl-4 border-l-2 border-muted">
                                             <div className="p-2 rounded bg-muted/50 space-y-2">
                                                <Input value={newRockForm.text} onChange={(e) => setNewRockForm({...newRockForm, text: e.target.value})} placeholder="New rock..." autoFocus className="text-sm" />
                                                <Select value={newRockForm.assigneeId || "unassigned"} onValueChange={(v) => setNewRockForm({...newRockForm, assigneeId: v === "unassigned" ? "" : v})}><SelectTrigger className="text-sm"><SelectValue placeholder="Assignee" /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}</SelectContent></Select>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <Select value={newRockForm.quarter} onValueChange={(v) => setNewRockForm({...newRockForm, quarter: v})}><SelectTrigger className="text-sm"><SelectValue placeholder="Quarter" /></SelectTrigger><SelectContent><SelectItem value="Q1">Q1</SelectItem><SelectItem value="Q2">Q2</SelectItem><SelectItem value="Q3">Q3</SelectItem><SelectItem value="Q4">Q4</SelectItem></SelectContent></Select>
                                                    <Select value={newRockForm.year.toString()} onValueChange={(v) => setNewRockForm({...newRockForm, year: parseInt(v)})}><SelectTrigger className="text-sm"><SelectValue placeholder="Year" /></SelectTrigger><SelectContent>{yearOptions.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}</SelectContent></Select>
                                                </div>
                                                <div className="flex items-center space-x-2"><input type="checkbox" checked={newRockForm.priority} onChange={(e) => setNewRockForm({...newRockForm, priority: e.target.checked})} className="h-4 w-4 rounded border-input" /><label className="text-sm text-muted-foreground">High Priority</label></div>
                                                <div className="flex gap-2"><Button size="sm" onClick={() => handleAddRock(priority.id)}><CheckIcon className="h-3 w-3 mr-1" />Add</Button><Button size="sm" variant="ghost" onClick={() => setAddingRockTo(null)}><XIcon className="h-3 w-3 mr-1" />Cancel</Button></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                           </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
