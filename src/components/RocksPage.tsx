import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  TargetIcon,
  CheckCircleIcon,
  CircleIcon,
  PlusIcon,
  XIcon,
  CheckIcon,
  PencilIcon,
  TrashIcon,
  CalendarIcon,
  LayoutGridIcon,
  KanbanSquareIcon,
  GripVerticalIcon,
  ListIcon,
  Grid3X3Icon,
  EyeIcon,
  Loader2
} from "lucide-react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, where, type Unsubscribe } from "firebase/firestore";
import { LEGACY_PLAN_YEAR, usePlanYear } from "@/contexts/PlanYearContext";

interface Rock {
  id: string;
  text: string;
  status: 'not_started' | 'ready' | 'in_progress' | 'complete';
  quarter: string;
  category: string;
  progress: number;
  executiveSponsor?: string;
  responsible?: string;
  accountable?: string;
  startDate?: string;
  projectManagement?: boolean;
  bloomGrowthVisibility?: boolean;
  visionStatement?: string;
  assigneeId?: string;
  assigneeName?: string;
  year?: number;
  companyId?: string;
}

interface RocksPageProps {
  currentUserId?: string;
  currentUserName?: string;
}

export default function RocksPage({ currentUserId = '1', currentUserName = 'Current User' }: RocksPageProps) {
  const { toast } = useToast();
  const { companyId, selectedYear } = usePlanYear();
  
  const [myRocks, setMyRocks] = useState<Rock[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'quarter' | 'status'>('status');
  const [displayMode, setDisplayMode] = useState<'list' | 'grid' | 'kanban'>('list');
  const [editingRock, setEditingRock] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Rock>>({});
  const [addingRock, setAddingRock] = useState(false);
  const [newRockForm, setNewRockForm] = useState({
    text: "",
    quarter: "Q1",
    category: "capabilities",
    executiveSponsor: "",
    responsible: "",
    accountable: "",
    startDate: "",
    projectManagement: false,
    bloomGrowthVisibility: false,
    visionStatement: ""
  });
  const [draggedRock, setDraggedRock] = useState<Rock | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  useEffect(() => {
    let unsubYear: Unsubscribe | undefined;
    let unsubLegacy: Unsubscribe | undefined;

    const byId = new Map<string, Rock>();
    const apply = () => {
      setMyRocks(Array.from(byId.values()));
      setLoading(false);
    };

    const rocksCol = collection(db, "companies", companyId, "rocks");
    const qYear = query(rocksCol, where("year", "==", selectedYear));

    unsubYear = onSnapshot(
      qYear,
      (snapshot) => {
        byId.clear();
        snapshot.forEach((d) => byId.set(d.id, { id: d.id, ...(d.data() as any) }));
        apply();
      },
      (error) => {
        console.error("Error fetching rocks:", error);
        setLoading(false);
      }
    );

    // Legacy support: include docs missing `year` only for 2025.
    if (selectedYear === LEGACY_PLAN_YEAR) {
      const qLegacy = query(rocksCol, where("year", "==", null));
      unsubLegacy = onSnapshot(
        qLegacy,
        (snapshot) => {
          snapshot.forEach((d) => {
            if (!byId.has(d.id)) byId.set(d.id, { id: d.id, ...(d.data() as any) });
          });
          apply();
        },
        () => {
          // ignore
        }
      );
    }

    return () => {
      unsubYear?.();
      unsubLegacy?.();
    };
  }, [companyId, selectedYear]);

  // Fetch users for assignee dropdown
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const fetchedUsers: any[] = [];
      snapshot.forEach((doc) => {
        fetchedUsers.push({ id: doc.id, ...doc.data() });
      });
      setUsers(fetchedUsers);
    }, (error) => {
      console.error("Error fetching users:", error);
    });
    return () => unsubscribe();
  }, []);

  const handleAddRock = async () => {
    if (!newRockForm.text.trim()) return;
    
    try {
      const rocksRef = collection(db, 'companies', companyId, 'rocks');
      await addDoc(rocksRef, {
        ...newRockForm,
        companyId,
        status: 'not_started',
        progress: 0,
        year: selectedYear,
        assigneeId: currentUserId,
        assigneeName: currentUserName
      });
      
      setAddingRock(false);
      setNewRockForm({
        text: "", quarter: "Q1", category: "capabilities", executiveSponsor: "",
        responsible: "", accountable: "", startDate: "", projectManagement: false,
        bloomGrowthVisibility: false, visionStatement: ""
      });
      toast({ title: "Success", description: "Rock created successfully" });
    } catch (error) {
      console.error("Error adding rock:", error);
      toast({ title: "Error", description: "Failed to create rock", variant: "destructive" });
    }
  };

  const handleEditRock = (rock: Rock) => {
    setEditingRock(rock.id);
    setEditForm({ ...rock });
  };

  const handleSaveEdit = async (rockId: string) => {
    try {
      const rockRef = doc(db, 'companies', companyId, 'rocks', rockId);
      await updateDoc(rockRef, editForm);
      setEditingRock(null);
      toast({ title: "Success", description: "Rock updated successfully" });
    } catch (error) {
      console.error("Error updating rock:", error);
      toast({ title: "Error", description: "Failed to update rock", variant: "destructive" });
    }
  };

  const handleDeleteRock = async (rockId: string) => {
    try {
      const rockRef = doc(db, 'companies', companyId, 'rocks', rockId);
      await deleteDoc(rockRef);
      toast({ title: "Success", description: "Rock deleted successfully" });
    } catch (error) {
      console.error("Error deleting rock:", error);
      toast({ title: "Error", description: "Failed to delete rock", variant: "destructive" });
    }
  };

  const handleDragStart = (e: React.DragEvent, rock: Rock) => {
    setDraggedRock(rock);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, column: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(column);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus?: Rock['status'], targetQuarter?: string) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedRock) return;

    const updates: any = {};
    
    if (targetStatus) {
      updates.status = targetStatus;
      if (targetStatus === 'complete') {
        updates.progress = 100;
      }
    }
    
    if (targetQuarter) {
      updates.quarter = targetQuarter;
    }
    
    if (Object.keys(updates).length > 0) {
      try {
        const rockRef = doc(db, 'companies', companyId, 'rocks', draggedRock.id);
        await updateDoc(rockRef, updates);
      } catch (error) {
        console.error("Error moving rock:", error);
        toast({ title: "Error", description: "Failed to move rock", variant: "destructive" });
      }
    }
    
    setDraggedRock(null);
  };

  const getCategoryColor = (category: string) => {
    switch(category) {
      case 'capabilities': return 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700';
      case 'priorities': return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700';
      case 'department': return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700';
      default: return 'bg-muted text-foreground border-border';
    }
  };

  const getStatusColor = (status: Rock['status']) => {
    switch(status) {
      case 'not_started': return 'border-muted-foreground/30';
      case 'ready': return 'border-yellow-500/50';
      case 'in_progress': return 'border-blue-500/50';
      case 'complete': return 'border-green-500/50';
      default: return 'border-border';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderRockCard = (rock: Rock, isDraggable: boolean = true) => {
    const isGridMode = displayMode === 'grid';
    const isKanbanMode = displayMode === 'kanban';
    
    return (
      <div
        key={rock.id}
        draggable={isDraggable && editingRock !== rock.id}
        onDragStart={(e) => handleDragStart(e, rock)}
        className={`group bg-card rounded-md border ${getStatusColor(rock.status)} hover:border-primary/50 transition-all ${
          isKanbanMode ? 'cursor-move' : ''
        } ${
          isGridMode ? 'p-4' : 'p-3'
        }`}
      >
        <div className={`flex ${isGridMode ? 'flex-col' : 'items-start'} gap-2`}>
          {isDraggable && isKanbanMode && (
            <GripVerticalIcon className="h-4 w-4 text-muted-foreground mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
          <div className="flex-1">
            <div className={`flex items-center gap-2 ${isGridMode ? 'mb-2' : 'mb-1'}`}>
              <Badge className={`${getCategoryColor(rock.category)} ${isGridMode ? 'text-xs' : ''}`}>
                {rock.category}
              </Badge>
              <span className="text-xs text-muted-foreground">{rock.quarter}</span>
            </div>
          {editingRock === rock.id ? (
            <div className="space-y-2">
              <Input
                value={editForm.text || ""}
                onChange={(e) => setEditForm({ ...editForm, text: e.target.value })}
                placeholder="Rock description..."
                className="h-7 text-sm"
                autoFocus
                data-testid={`input-edit-rock-text-${rock.id}`}
              />
              <Textarea
                value={editForm.visionStatement || ""}
                onChange={(e) => setEditForm({ ...editForm, visionStatement: e.target.value })}
                placeholder="Rock description..."
                className="min-h-[60px] text-xs"
                data-testid={`input-edit-rock-vision-${rock.id}`}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={editForm.executiveSponsor || ""}
                  onChange={(e) => setEditForm({ ...editForm, executiveSponsor: e.target.value })}
                  placeholder="Executive Sponsor"
                  className="h-7 text-xs"
                  data-testid={`input-edit-rock-sponsor-${rock.id}`}
                />
                <Input
                  value={editForm.responsible || ""}
                  onChange={(e) => setEditForm({ ...editForm, responsible: e.target.value })}
                  placeholder="Responsible"
                  className="h-7 text-xs"
                  data-testid={`input-edit-rock-responsible-${rock.id}`}
                />
                <Input
                  value={editForm.accountable || ""}
                  onChange={(e) => setEditForm({ ...editForm, accountable: e.target.value })}
                  placeholder="Accountable"
                  className="h-7 text-xs"
                  data-testid={`input-edit-rock-accountable-${rock.id}`}
                />
                <Input
                  type="date"
                  value={editForm.startDate || ""}
                  onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                  className="h-7 text-xs"
                  data-testid={`input-edit-rock-date-${rock.id}`}
                />
              </div>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 text-muted-foreground">
                  <Checkbox
                    checked={editForm.projectManagement || false}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, projectManagement: checked as boolean })}
                    data-testid={`checkbox-edit-rock-pm-${rock.id}`}
                  />
                  <span>Project Management</span>
                </label>
                <label className="flex items-center gap-1.5 text-muted-foreground">
                  <Checkbox
                    checked={editForm.bloomGrowthVisibility || false}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, bloomGrowthVisibility: checked as boolean })}
                    data-testid={`checkbox-edit-rock-bloom-${rock.id}`}
                  />
                  <span>BloomGrowth Visibility</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Progress:</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={editForm.progress || 0}
                  onChange={(e) => setEditForm({ ...editForm, progress: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                  className="h-6 w-20 text-xs"
                  data-testid={`input-edit-rock-progress-${rock.id}`}
                />
                <span className="text-xs text-muted-foreground">%</span>
                <div className="flex gap-1 ml-auto">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleSaveEdit(rock.id)}
                    className="h-6 w-6 text-green-600"
                    data-testid={`button-save-rock-${rock.id}`}
                  >
                    <CheckIcon className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditingRock(null)}
                    className="h-6 w-6 text-destructive"
                    data-testid={`button-cancel-rock-${rock.id}`}
                  >
                    <XIcon className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className={`${isGridMode ? 'text-sm' : 'text-xs'} text-foreground ${rock.status === 'complete' ? 'line-through opacity-60' : ''} ${
                isGridMode ? 'line-clamp-3' : 'line-clamp-2'
              }`}>
                {rock.text}
              </p>
              {rock.assigneeName && (
                <p className="text-xs text-muted-foreground mt-1">
                  • {rock.assigneeName}
                </p>
              )}
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Progress</span>
                  <span className="text-xs text-primary">{rock.progress}%</span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${rock.status === 'complete' ? 'bg-green-500' : 'bg-primary'}`}
                    style={{ width: `${rock.progress}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
        {editingRock !== rock.id && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
            <ActionMenu
              onEdit={() => handleEditRock(rock)}
              onDelete={() => handleDeleteRock(rock.id)}
              testId={`action-menu-rock-${rock.id}`}
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
            />
          </div>
        )}
      </div>
    </div>
    );
  };

  const renderStatusView = () => {
    const statuses: { key: Rock['status']; label: string; color: string }[] = [
      { key: 'not_started', label: 'Backlog', color: 'bg-muted' },
      { key: 'ready', label: 'Ready', color: 'bg-yellow-50 dark:bg-yellow-950/20' },
      { key: 'in_progress', label: 'In Progress', color: 'bg-blue-50 dark:bg-blue-950/20' },
      { key: 'complete', label: 'Complete', color: 'bg-green-50 dark:bg-green-950/20' }
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {statuses.map(status => {
          const rocks = myRocks.filter(r => r.status === status.key);
          
          return (
            <div
              key={status.key}
              className={`${status.color} rounded-lg border ${dragOverColumn === status.key ? 'border-primary' : 'border-border'} transition-colors`}
              onDragOver={(e) => handleDragOver(e, status.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, status.key)}
            >
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{status.label}</h3>
                  <Badge variant="secondary">
                    {rocks.length}
                  </Badge>
                </div>
              </div>
              <div className={`p-4 ${displayMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'space-y-3'} min-h-[200px]`}>
                {rocks.length > 0 ? (
                  rocks.map(rock => renderRockCard(rock))
                ) : (
                  <p className="text-xs text-muted-foreground italic text-center py-8">
                    Drop rocks here
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderQuarterView = () => {
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {quarters.map(quarter => {
          const rocks = myRocks.filter(r => r.quarter === quarter);
          
          return (
            <div
              key={quarter}
              className={`bg-muted/30 rounded-lg border ${dragOverColumn === quarter ? 'border-primary' : 'border-border'} transition-colors`}
              onDragOver={(e) => handleDragOver(e, quarter)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, undefined, quarter)}
            >
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {quarter}
                  </h3>
                  <Badge variant="secondary">
                    {rocks.length}
                  </Badge>
                </div>
              </div>
              <div className={`p-4 ${displayMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'space-y-3'} min-h-[200px]`}>
                {rocks.length > 0 ? (
                  rocks.map(rock => renderRockCard(rock))
                ) : (
                  <p className="text-xs text-muted-foreground italic text-center py-8">
                    Drop rocks here
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TargetIcon className="h-6 w-6" />
            My Rocks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track and manage your quarterly rocks and priorities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-md p-1">
            <Button
              size="sm"
              variant={viewMode === 'status' ? 'default' : 'ghost'}
              onClick={() => setViewMode('status')}
              className="text-xs"
              data-testid="button-view-status"
            >
              <KanbanSquareIcon className="h-3 w-3 mr-1" />
              Status
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'quarter' ? 'default' : 'ghost'}
              onClick={() => setViewMode('quarter')}
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
              variant={displayMode === 'list' ? 'default' : 'ghost'}
              onClick={() => setDisplayMode('list')}
              className="text-xs"
              data-testid="button-display-list"
            >
              <ListIcon className="h-3 w-3 mr-1" />
              List
            </Button>
            <Button
              size="sm"
              variant={displayMode === 'grid' ? 'default' : 'ghost'}
              onClick={() => setDisplayMode('grid')}
              className="text-xs"
              data-testid="button-display-grid"
            >
              <Grid3X3Icon className="h-3 w-3 mr-1" />
              Grid
            </Button>
            <Button
              size="sm"
              variant={displayMode === 'kanban' ? 'default' : 'ghost'}
              onClick={() => setDisplayMode('kanban')}
              className="text-xs"
              data-testid="button-display-kanban"
            >
              <EyeIcon className="h-3 w-3 mr-1" />
              Kanban
            </Button>
          </div>
          <Button
            onClick={() => setAddingRock(true)}
            data-testid="button-add-rock"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Rock
          </Button>
        </div>
      </div>

      {addingRock && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-sm">Add New Rock</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <Input
              value={newRockForm.text}
              onChange={(e) => setNewRockForm({ ...newRockForm, text: e.target.value })}
              placeholder="Describe your rock..."
              autoFocus
              data-testid="input-new-rock-text"
            />
            <Textarea
              value={newRockForm.visionStatement}
              onChange={(e) => setNewRockForm({ ...newRockForm, visionStatement: e.target.value })}
              placeholder="Vision statement or detailed description..."
              className="min-h-[60px]"
              data-testid="input-new-rock-vision"
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Quarter</label>
                <select
                  value={newRockForm.quarter}
                  onChange={(e) => setNewRockForm({ ...newRockForm, quarter: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
                  data-testid="select-new-rock-quarter"
                >
                  <option value="Q1">Q1</option>
                  <option value="Q2">Q2</option>
                  <option value="Q3">Q3</option>
                  <option value="Q4">Q4</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                <select
                  value={newRockForm.category}
                  onChange={(e) => setNewRockForm({ ...newRockForm, category: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
                  data-testid="select-new-rock-category"
                >
                  <option value="capabilities">Capabilities</option>
                  <option value="priorities">Priorities</option>
                  <option value="department">Department</option>
                </select>
              </div>
              <Input
                value={newRockForm.executiveSponsor}
                onChange={(e) => setNewRockForm({ ...newRockForm, executiveSponsor: e.target.value })}
                placeholder="Executive Sponsor"
                className="text-sm"
                data-testid="input-new-rock-sponsor"
              />
              <Input
                value={newRockForm.responsible}
                onChange={(e) => setNewRockForm({ ...newRockForm, responsible: e.target.value })}
                placeholder="Responsible"
                className="text-sm"
                data-testid="input-new-rock-responsible"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Input
                value={newRockForm.accountable}
                onChange={(e) => setNewRockForm({ ...newRockForm, accountable: e.target.value })}
                placeholder="Accountable"
                className="text-sm"
                data-testid="input-new-rock-accountable"
              />
              <Input
                type="date"
                value={newRockForm.startDate}
                onChange={(e) => setNewRockForm({ ...newRockForm, startDate: e.target.value })}
                className="text-sm"
                data-testid="input-new-rock-date"
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={newRockForm.projectManagement}
                  onCheckedChange={(checked) => setNewRockForm({ ...newRockForm, projectManagement: checked as boolean })}
                  data-testid="checkbox-new-rock-pm"
                />
                Project Management
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={newRockForm.bloomGrowthVisibility}
                  onCheckedChange={(checked) => setNewRockForm({ ...newRockForm, bloomGrowthVisibility: checked as boolean })}
                  data-testid="checkbox-new-rock-bloom"
                />
                BloomGrowth Visibility
              </label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddRock} data-testid="button-save-new-rock">
                <CheckIcon className="h-4 w-4 mr-2" />
                Save Rock
              </Button>
              <Button variant="outline" onClick={() => setAddingRock(false)} data-testid="button-cancel-new-rock">
                <XIcon className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === 'status' ? renderStatusView() : renderQuarterView()}
    </div>
  );
}
