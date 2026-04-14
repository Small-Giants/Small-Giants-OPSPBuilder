import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EditableTitle } from "@/components/ui/editable-title";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, UserIcon, LinkIcon, PlusIcon, EditIcon, SaveIcon, XIcon, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, where, type Unsubscribe } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { LEGACY_PLAN_YEAR, usePlanYear } from "@/contexts/PlanYearContext";

interface Priority {
  id: string;
  title: string;
  description: string;
  owner: string;
  dueDate: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'blocked';
  progress: number;
  evidence: string;
  subPriorities: SubPriority[];
  rocks?: Rock[];
  type?: 'priority' | 'capability';
}

interface Rock {
  id: string;
  text: string;
  quarter: string;
  status: 'backlog' | 'ready' | 'in_progress' | 'complete';
  progress: number;
  assignee?: string;
  assigneeName?: string;
}

interface SubPriority {
  id: string;
  title: string;
  completed: boolean;
}

interface PriorityTrackerProps {
  priorities?: Priority[]; // Kept for backward compatibility if needed, but internal state preferred
  onPriorityUpdate?: (priority: Priority) => void;
  onAddPriority?: (priority: Omit<Priority, 'id'>) => void;
  isCapabilityView?: boolean;
}

export default function PriorityTracker({ isCapabilityView = false }: PriorityTrackerProps) {
  const { toast } = useToast();
  const { companyId, selectedYear } = usePlanYear();
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPriority, setNewPriority] = useState<Omit<Priority, 'id'>>({
    title: "",
    description: "",
    owner: "",
    dueDate: "",
    status: 'not-started',
    progress: 0,
    evidence: "",
    subPriorities: [],
    type: isCapabilityView ? 'capability' : 'priority'
  });

  useEffect(() => {
    const prioritiesRef = collection(db, 'companies', companyId, 'priorities');
    const qByType = query(
      prioritiesRef,
      where("type", "==", isCapabilityView ? 'capability' : 'priority')
    );

    const unsubscribe = onSnapshot(
      qByType,
      (snapshot) => {
        const items: Priority[] = [];
        snapshot.forEach((d) => items.push({ id: d.id, ...(d.data() as any) }));
        const filtered = items
          .filter((p: any) => {
            const planYear = typeof p.planYear === "number" ? p.planYear : LEGACY_PLAN_YEAR;
            return planYear === selectedYear;
          })
          .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        setPriorities(filtered);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId, isCapabilityView, selectedYear]);

  const getStatusColor = (status: Priority['status']) => {
    const colors = {
      'not-started': 'bg-gray-500',
      'in-progress': 'bg-blue-500',
      'completed': 'bg-green-500',
      'blocked': 'bg-red-500'
    };
    return colors[status];
  };

  const getStatusLabel = (status: Priority['status']) => {
    const labels = {
      'not-started': 'Not Started',
      'in-progress': 'In Progress',
      'completed': 'Completed',
      'blocked': 'Blocked'
    };
    return labels[status];
  };

  const handleAddPriority = async () => {
    if (!newPriority.title.trim()) return;
    
    try {
      const prioritiesRef = collection(db, 'companies', companyId, 'priorities');
      await addDoc(prioritiesRef, {
        ...newPriority,
        type: isCapabilityView ? 'capability' : 'priority',
        planYear: selectedYear,
        createdAt: new Date().toISOString()
      });
      
      setNewPriority({
        title: "",
        description: "",
        owner: "",
        dueDate: "",
        status: 'not-started',
        progress: 0,
        evidence: "",
        subPriorities: [],
        type: isCapabilityView ? 'capability' : 'priority'
      });
      setShowAddForm(false);
      toast({ title: "Success", description: "Item added successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to add item", variant: "destructive" });
    }
  };

  const handleUpdatePriority = async (priority: Priority) => {
    try {
      const priorityRef = doc(db, 'companies', companyId, 'priorities', priority.id);
      const { id, ...data } = priority;
      await updateDoc(priorityRef, data);
    } catch (error) {
      toast({ title: "Error", description: "Failed to update item", variant: "destructive" });
    }
  };

  const updateSubPriority = (priority: Priority, subId: string, completed: boolean) => {
    const updatedSubPriorities = priority.subPriorities.map(sub =>
      sub.id === subId ? { ...sub, completed } : sub
    );
    const completedCount = updatedSubPriorities.filter(sub => sub.completed).length;
    const newProgress = updatedSubPriorities.length > 0 
      ? Math.round((completedCount / updatedSubPriorities.length) * 100)
      : priority.progress;

    handleUpdatePriority({
      ...priority,
      subPriorities: updatedSubPriorities,
      progress: newProgress
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <EditableTitle
            labelKey="page.priorities.title"
            fallback={isCapabilityView ? 'Capability Management' : 'Strategic Objective Execution'}
            as="h2"
            className="text-2xl font-bold text-foreground"
          />
          <p className="text-muted-foreground">
            {isCapabilityView 
              ? 'Track progress on your strategic capabilities' 
              : 'Track progress on your annual strategic objectives'}
          </p>
        </div>
        <Button 
          onClick={() => setShowAddForm(true)}
          data-testid="button-add-priority"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          Add {isCapabilityView ? 'Capability' : 'Strategic Objective'}
        </Button>
      </div>

      {showAddForm && (
        <Card className="border-2 border-dashed border-border">
          <CardHeader>
            <CardTitle>Add New {isCapabilityView ? 'Capability' : 'Strategic Objective'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder={`${isCapabilityView ? 'Capability' : 'Strategic Objective'} title`}
              value={newPriority.title}
              onChange={(e) => setNewPriority(prev => ({ ...prev, title: e.target.value }))}
              data-testid="input-new-priority-title"
            />
            <Textarea
              placeholder="Description"
              value={newPriority.description}
              onChange={(e) => setNewPriority(prev => ({ ...prev, description: e.target.value }))}
              data-testid="textarea-new-priority-description"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                placeholder="Owner"
                value={newPriority.owner}
                onChange={(e) => setNewPriority(prev => ({ ...prev, owner: e.target.value }))}
                data-testid="input-new-priority-owner"
              />
              <Input
                type="date"
                value={newPriority.dueDate}
                onChange={(e) => setNewPriority(prev => ({ ...prev, dueDate: e.target.value }))}
                data-testid="input-new-priority-date"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddPriority} data-testid="button-save-new-priority">
                Save {isCapabilityView ? 'Capability' : 'Strategic Objective'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowAddForm(false)}
                data-testid="button-cancel-new-priority"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {priorities.map((priority) => (
          <Card key={priority.id} className="hover-elevate" data-testid={`card-priority-${priority.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-2">{priority.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{priority.description}</p>
                </div>
                <Badge 
                  className={`${getStatusColor(priority.status)} text-white ml-2`}
                  data-testid={`badge-status-${priority.id}`}
                >
                  {getStatusLabel(priority.status)}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Progress {priority.rocks && priority.rocks.length > 0 ? '(from tactics)' : ''}</span>
                  <span className="font-medium">
                    {priority.rocks && priority.rocks.length > 0 
                      ? Math.round((priority.rocks.filter(r => r.status === 'complete').length / priority.rocks.length) * 100)
                      : priority.progress}%
                  </span>
                </div>
                <Progress 
                  value={priority.rocks && priority.rocks.length > 0 
                    ? Math.round((priority.rocks.filter(r => r.status === 'complete').length / priority.rocks.length) * 100)
                    : priority.progress} 
                  className="h-2" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-muted-foreground" />
                  <span>{priority.owner || 'Unassigned'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  <span>{priority.dueDate || 'No due date'}</span>
                </div>
              </div>

              {priority.rocks && priority.rocks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Associated Tactics:</h4>
                  <div className="space-y-1">
                    {priority.rocks.map((rock) => (
                      <div key={rock.id} className="flex items-center justify-between text-xs bg-muted p-2 rounded">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            rock.status === 'complete' ? 'bg-green-500' :
                            rock.status === 'in_progress' ? 'bg-blue-500' :
                            rock.status === 'ready' ? 'bg-yellow-500' : 'bg-gray-400'
                          }`} />
                          <span className={rock.status === 'complete' ? 'line-through' : ''}>
                            {rock.text}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-primary">{rock.quarter}</span>
                          {rock.assigneeName && (
                            <span className="text-muted-foreground">({rock.assigneeName})</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {priority.subPriorities.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Sub-objectives:</h4>
                  {priority.subPriorities.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={sub.completed}
                        onChange={(e) => updateSubPriority(priority, sub.id, e.target.checked)}
                        className="rounded"
                        data-testid={`checkbox-sub-${sub.id}`}
                      />
                      <span className={`text-sm ${sub.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {sub.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {priority.evidence && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <LinkIcon className="w-4 h-4" />
                    Evidence
                  </div>
                  <p className="text-sm text-muted-foreground">{priority.evidence}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t">
                <Select
                  value={priority.status}
                  onValueChange={(value: Priority['status']) =>
                    handleUpdatePriority({ ...priority, status: value })
                  }
                >
                  <SelectTrigger className="flex-1" data-testid={`select-status-${priority.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not-started">Not Started</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
