import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserIcon, CheckIcon, XIcon, FlameIcon, ChevronRightIcon, ChevronDownIcon, Loader2 } from "lucide-react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { useAuth } from "@/contexts/AuthContext";
import { LEGACY_PLAN_YEAR, usePlanYear } from "@/contexts/PlanYearContext";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, updateDoc, query, where, type Unsubscribe } from "firebase/firestore";

interface Rock {
  id: string;
  text: string;
  status: 'not_started' | 'ready' | 'in_progress' | 'complete';
  quarter: string;
  year: number;
  priority: boolean;
  assigneeId?: string;
  assigneeName?: string;
  title?: string; // legacy support
}

export default function IndividualRocks() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { companyId, selectedYear, availableYears } = usePlanYear();
  
  const [rocks, setRocks] = useState<Rock[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State for editing
  const [editingRock, setEditingRock] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Rock>>({});
  
  // State for quarter expansion
  const [expandedQuarters, setExpandedQuarters] = useState<{ [key: string]: boolean }>({
    Q1: true, Q2: true, Q3: true, Q4: true
  });

  useEffect(() => {
    if (!user) return;

    let unsubYear: Unsubscribe | undefined;
    let unsubLegacy: Unsubscribe | undefined;

    const byId = new Map<string, Rock>();
    const apply = () => {
      setRocks(Array.from(byId.values()));
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
  }, [companyId, user, selectedYear]);

  const yearOptions = Array.from(new Set<number>([...availableYears, selectedYear, selectedYear + 1])).sort((a, b) => a - b);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const u: any[] = [];
      snapshot.forEach(d => u.push({ id: d.id, ...d.data() }));
      setUsers(u);
    });
    return () => unsubscribe();
  }, []);

  const handleEditRock = (rock: Rock) => {
    setEditingRock(rock.id);
    setEditForm({
      text: rock.text || rock.title || "",
      quarter: rock.quarter || "Q1",
      year: rock.year || selectedYear,
      priority: rock.priority || false,
      assigneeId: rock.assigneeId || user?.uid || ""
    });
  };

  const handleSaveRock = async () => {
    if (!editingRock) return;
    
    try {
      const assignee = users.find((u: any) => u.id === editForm.assigneeId);
      const rockRef = doc(db, 'companies', companyId, 'rocks', editingRock);
      
      await updateDoc(rockRef, {
        text: editForm.text,
        quarter: editForm.quarter,
        year: editForm.year,
        assigneeId: editForm.assigneeId,
        assigneeName: assignee?.name || null,
        priority: editForm.priority
      });
      
      setEditingRock(null);
      toast({ title: "Success", description: "Rock updated successfully" });
    } catch (error) {
      console.error("Error updating rock:", error);
      toast({ title: "Error", description: "Failed to update rock", variant: "destructive" });
    }
  };

  const handleCancelEdit = () => {
    setEditingRock(null);
    setEditForm({});
  };

  const toggleQuarter = (quarter: string) => {
    setExpandedQuarters(prev => ({
      ...prev,
      [quarter]: !prev[quarter]
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const myRocks = rocks.filter(rock => rock.assigneeId === user?.uid);

  const rocksByQuarter = myRocks.reduce((acc: any, rock) => {
    const quarter = rock.quarter || 'Q1';
    if (!acc[quarter]) acc[quarter] = [];
    acc[quarter].push(rock);
    return acc;
  }, {});

  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-foreground">
            <UserIcon className="w-6 h-6" />
            My Rocks - {user?.name || user?.email || 'Current User'}
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            Total rocks assigned to you: {myRocks.length}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {quarters.map(quarter => {
            const quarterRocks = rocksByQuarter[quarter] || [];
            if (quarterRocks.length === 0) return null;
            
            return (
              <div key={quarter} className="border border-border rounded-lg bg-muted">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => toggleQuarter(quarter)}
                >
                  <div className="flex items-center gap-3">
                    <FlameIcon className="w-5 h-5 text-accent" />
                    <span className="font-semibold text-lg text-foreground">{quarter}</span>
                    <Badge variant="secondary">
                      {quarterRocks.length} rock{quarterRocks.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  {expandedQuarters[quarter] ? (
                    <ChevronDownIcon className="w-5 h-5 text-accent" />
                  ) : (
                    <ChevronRightIcon className="w-5 h-5 text-accent" />
                  )}
                </div>
                
                {expandedQuarters[quarter] && (
                  <div className="p-4 pt-0 space-y-3">
                    {quarterRocks.map((rock: Rock) => (
                      <div key={rock.id} className="bg-card rounded-lg p-4 border border-border">
                        {editingRock === rock.id ? (
                          <div className="space-y-3">
                            <Input
                              value={editForm.text || ""}
                              onChange={(e) => setEditForm({ ...editForm, text: e.target.value })}
                              placeholder="Rock description"
                            />
                            
                            <div className="grid grid-cols-2 gap-3">
                              <Select
                                value={editForm.quarter}
                                onValueChange={(value) => setEditForm({ ...editForm, quarter: value })}
                              >
                                <SelectTrigger>
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
                                value={editForm.year?.toString()}
                                onValueChange={(value) => setEditForm({ ...editForm, year: parseInt(value) })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent>
                                  {yearOptions.map((y) => (
                                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <Select
                              value={editForm.assigneeId || "unassigned"}
                              onValueChange={(value) => setEditForm({ ...editForm, assigneeId: value === "unassigned" ? "" : value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Reassign to" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {users.map((u: any) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.name || u.email}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={editForm.priority || false}
                                onChange={(e) => setEditForm({ ...editForm, priority: e.target.checked })}
                                className="h-4 w-4 rounded border-input"
                              />
                              <label className="text-sm text-muted-foreground">High Priority</label>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleSaveRock}>
                                <CheckIcon className="h-4 w-4 mr-1" />
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                                <XIcon className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {rock.priority && (
                                  <Badge variant="destructive" className="text-xs">
                                    HIGH PRIORITY
                                  </Badge>
                                )}
                                <h4 className="text-foreground font-medium">{rock.text || rock.title}</h4>
                              </div>
                            </div>
                            <ActionMenu
                              onEdit={() => handleEditRock(rock)}
                              onDelete={() => {}}
                              testId={`action-menu-rock-${rock.id}`}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          
          {myRocks.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-lg">No rocks assigned to you yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
