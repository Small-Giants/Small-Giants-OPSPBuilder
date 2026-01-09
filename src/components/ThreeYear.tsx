import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  TargetIcon,
  RocketIcon,
  StarIcon,
  TrendingUpIcon,
  MapPinIcon,
  PlusIcon,
  XIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronRightIcon
} from "lucide-react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { db } from "@/lib/firebase";
import { doc, collection, onSnapshot, updateDoc, addDoc, deleteDoc, setDoc, query, where, type Unsubscribe } from "firebase/firestore";
import { LEGACY_PLAN_YEAR, usePlanYear } from "@/contexts/PlanYearContext";

export default function ThreeYear() {
  const { toast } = useToast();
  const { companyId, selectedYear, availableYears } = usePlanYear();
  
  const [roadmapData, setRoadmapData] = useState<{
    bhag: string;
    threeHagStatement: string;
    knownFor: string;
  }>({
    bhag: "",
    threeHagStatement: "",
    knownFor: ""
  });
  
  const [capabilities, setCapabilities] = useState<any[]>([]);
  const [rocks, setRocks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  
  const [expandedCapability, setExpandedCapability] = useState<string | null>(null);
  const [addingRockTo, setAddingRockTo] = useState<string | null>(null);
  const [newRockForm, setNewRockForm] = useState({ text: "", assigneeId: "", assigneeName: "", quarter: "Q1", year: selectedYear, priority: false });
  const [editingRock, setEditingRock] = useState<string | null>(null);
  const [editRockForm, setEditRockForm] = useState({ text: "", assigneeId: "", assigneeName: "", quarter: "Q1", year: selectedYear, priority: false });

  useEffect(() => {
    // 1. Roadmap Data
    const roadmapRef = doc(db, 'companies', companyId, 'roadmap', 'main');
    const unsubRoadmap = onSnapshot(roadmapRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setRoadmapData({
          bhag: data.bhag || "",
          threeHagStatement: data.threeHagStatement || "",
          knownFor: data.knownFor || ""
        });
      } else {
        // Initialize if missing (could also be done via a setup script)
      }
      setLoading(false);
    });

    // 2. Capabilities (year-scoped; avoid composite indexes by filtering client-side)
    const prioritiesRef = collection(db, 'companies', companyId, 'priorities');
    const qCaps = query(prioritiesRef, where("type", "==", "capability"));
    const unsubCaps = onSnapshot(qCaps, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((d) => items.push({ id: d.id, ...d.data() }));
      const filtered = items
        .filter((p) => {
          const planYear = typeof p.planYear === "number" ? p.planYear : LEGACY_PLAN_YEAR;
          return planYear === selectedYear;
        })
        .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)); // Sort by sortOrder
      setCapabilities(filtered);
    });
    
    // 3. Users
    const usersRef = collection(db, 'users');
    const unsubUsers = onSnapshot(usersRef, (snapshot) => {
        const u: any[] = [];
        snapshot.forEach(d => u.push({ id: d.id, ...d.data() }));
        setUsers(u);
    });

    return () => {
      unsubRoadmap();
      unsubCaps();
      unsubUsers();
    };
  }, [companyId, selectedYear]);

  // Rocks are year-scoped
  useEffect(() => {
    let unsubYear: Unsubscribe | undefined;
    let unsubLegacy: Unsubscribe | undefined;

    const byId = new Map<string, any>();
    const apply = () => setRocks(Array.from(byId.values()));

    const rocksCol = collection(db, 'companies', companyId, 'rocks');
    const qYear = query(rocksCol, where('year', '==', selectedYear));
    unsubYear = onSnapshot(qYear, (snapshot) => {
      byId.clear();
      snapshot.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
      apply();
    });

    if (selectedYear === LEGACY_PLAN_YEAR) {
      const qLegacy = query(rocksCol, where('year', '==', null));
      unsubLegacy = onSnapshot(
        qLegacy,
        (snapshot) => {
          snapshot.forEach((d) => {
            if (!byId.has(d.id)) byId.set(d.id, { id: d.id, ...d.data() });
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

  // Keep default year aligned when user switches years
  useEffect(() => {
    setNewRockForm((prev) => ({ ...prev, year: selectedYear }));
    setEditRockForm((prev) => ({ ...prev, year: selectedYear }));
  }, [selectedYear]);

  const yearOptions = Array.from(new Set<number>([...availableYears, selectedYear, selectedYear + 1])).sort((a, b) => a - b);

  const handleSave = async (fieldPath: string) => {
    try {
      const roadmapRef = doc(db, 'companies', companyId, 'roadmap', 'main');
      // Use setDoc with merge: true to create document if it doesn't exist
      await setDoc(roadmapRef, { 
        [fieldPath]: editValue,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setRoadmapData(prev => ({ ...prev, [fieldPath]: editValue }));
      setEditingField(null);
      setEditValue("");
      toast({ title: "Success", description: "Saved successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    }
  };

  const handleAddRock = async (capabilityId: string) => {
    if (!newRockForm.text.trim()) {
      toast({ title: "Error", description: "Rock text is required", variant: "destructive" });
      return;
    }
    
    try {
      const assignee = users.find((u: any) => u.id === newRockForm.assigneeId);
      await addDoc(collection(db, 'companies', companyId, 'rocks'), {
        priorityId: capabilityId,
        text: newRockForm.text,
        quarter: newRockForm.quarter,
        year: newRockForm.year,
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
      toast({ title: "Error", description: "Failed to add rock", variant: "destructive" });
    }
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
      toast({ title: "Error", description: "Failed to update rock", variant: "destructive" });
    }
  };
  
  const handleDeleteRock = async (rockId: string) => {
    try {
      await deleteDoc(doc(db, 'companies', companyId, 'rocks', rockId));
      toast({ title: "Success", description: "Rock deleted" });
    } catch (error) {
       toast({ title: "Error", description: "Failed to delete rock", variant: "destructive" });
    }
  };

  const handleEdit = (fieldPath: string, currentValue: string) => {
    setEditingField(fieldPath);
    setEditValue(currentValue);
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValue("");
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

  const handleCancelRockEdit = () => {
    setEditingRock(null);
    setEditRockForm({ text: "", assigneeId: "", assigneeName: "", quarter: "Q1", year: selectedYear, priority: false });
  };

  const renderEditableField = (fieldPath: string, value: string, multiline = false) => {
      const isEditing = editingField === fieldPath;
      
      if (isEditing) {
        return (
          <div className="flex gap-2 items-start">
            {multiline ? (
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 bg-background border-border text-foreground"
                autoFocus
                rows={4}
              />
            ) : (
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 bg-background border-border text-foreground"
                autoFocus
              />
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleSave(fieldPath)}
              className="h-8 w-8 text-green-600 hover:text-green-700"
            >
              <CheckIcon className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCancel}
              className="h-8 w-8 text-red-600 hover:text-red-700"
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </div>
        );
      }
      
      return (
        <div className="flex gap-2 items-start group">
          <p className={`flex-1 ${multiline ? 'text-sm leading-relaxed' : 'text-lg font-medium'} text-foreground`}>{value || "Click to add..."}</p>
          <ActionMenu
            onEdit={() => handleEdit(fieldPath, value)}
            onDelete={() => {}}
            className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
      );
  };

  const capabilitiesWithRocks = capabilities.map(cap => ({
      ...cap,
      rocks: rocks.filter(r => r.priorityId === cap.id)
  }));
  
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

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading Three Year Plan...</div>;
  }

  return (
    <div className="space-y-6">
       <div className="border-b border-border pb-4">
        <div className="flex items-center gap-3 mb-2">
          <TargetIcon className="w-6 h-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">THREE YEAR</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Define your 3-year vision, capabilities, and quarterly execution plan
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
         <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <RocketIcon className="w-5 h-5" />
              BHAG
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderEditableField("bhag", roadmapData.bhag, true)}
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <MapPinIcon className="w-5 h-5" />
              3HAG Statement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderEditableField("threeHagStatement", roadmapData.threeHagStatement, true)}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <StarIcon className="w-5 h-5" />
              Known For
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderEditableField("knownFor", roadmapData.knownFor, true)}
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
            <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <TrendingUpIcon className="w-5 h-5" />
              Capabilities
              <Badge className="ml-auto bg-accent text-accent-foreground border-border">
                {capabilitiesWithRocks.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
              {capabilitiesWithRocks.length === 0 ? (
                <div className="text-muted-foreground text-sm py-4 text-center">
                  No capabilities added yet. Add capabilities from the Priority Management page.
                </div>
              ) : (
                 capabilitiesWithRocks.map((capability: any, idx: number) => {
                  const rocksByQuarter = groupRocksByQuarter(capability.rocks || []);
                  const totalRocks = (capability.rocks || []).length;
                  
                  return (
                    <div key={capability.id} className="group border border-border rounded-lg p-3 bg-muted">
                       <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-muted-foreground font-medium">{idx + 1}:</span>
                            <h4 className="font-medium text-foreground">{capability.title}</h4>
                            <Badge variant="secondary" className="text-xs">
                              Capability
                            </Badge>
                          </div>
                          {capability.description && (
                            <p className="text-sm text-muted-foreground mb-2">{capability.description}</p>
                          )}
                           <div className="flex items-center gap-2 mt-2">
                            {totalRocks > 0 ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedCapability(
                                  expandedCapability === capability.id ? null : capability.id
                                )}
                                className="text-xs p-0 h-auto hover:bg-transparent text-muted-foreground"
                              >
                                {expandedCapability === capability.id ? (
                                  <ChevronDownIcon className="h-4 w-4 mr-1" />
                                ) : (
                                  <ChevronRightIcon className="h-4 w-4 mr-1" />
                                )}
                                <span className="text-muted-foreground">
                                  {totalRocks} rocks
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
                              className="text-xs h-6 px-2 border-dashed border-border text-muted-foreground hover:bg-accent"
                            >
                              <PlusIcon className="h-3 w-3 mr-1" />
                              Add Rock
                            </Button>
                           </div>
                        </div>
                       </div>
                       
                       {expandedCapability === capability.id && (
                        <div className="mt-4 pl-4 border-l-2 border-border space-y-3">
                           {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((quarter) => {
                              const quarterRocks = rocksByQuarter[quarter] || [];
                              if (quarterRocks.length === 0 && addingRockTo !== capability.id) return null;
                              
                              return (
                                <div key={quarter} className="space-y-2">
                                   <div className="flex items-center gap-2">
                                      <Badge className="bg-accent text-accent-foreground text-[10px] px-2 py-0 h-5">
                                        {quarter}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">{quarterRocks.length} {quarterRocks.length === 1 ? 'rock' : 'rocks'}</span>
                                   </div>
                                   
                                   {quarterRocks.map((rock: any) => (
                                       <div key={rock.id} className="flex items-start justify-between gap-2 p-2 rounded bg-background">
                                          {editingRock === rock.id ? (
                                             <div className="flex-1 space-y-2">
                                                <Input value={editRockForm.text} onChange={(e) => setEditRockForm({...editRockForm, text: e.target.value})} placeholder="Rock text" className="bg-background border-border text-foreground text-sm" />
                                                <Select value={editRockForm.assigneeId || "unassigned"} onValueChange={(v) => setEditRockForm({...editRockForm, assigneeId: v === "unassigned" ? "" : v})}>
                                                    <SelectTrigger className="bg-background border-border text-foreground text-sm"><SelectValue placeholder="Assignee" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="unassigned">Unassigned</SelectItem>
                                                        {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <Select value={editRockForm.quarter} onValueChange={(v) => setEditRockForm({...editRockForm, quarter: v})}>
                                                        <SelectTrigger className="bg-background border-border text-foreground text-sm"><SelectValue placeholder="Quarter" /></SelectTrigger>
                                                        <SelectContent><SelectItem value="Q1">Q1</SelectItem><SelectItem value="Q2">Q2</SelectItem><SelectItem value="Q3">Q3</SelectItem><SelectItem value="Q4">Q4</SelectItem></SelectContent>
                                                    </Select>
                                                    <Select value={editRockForm.year.toString()} onValueChange={(v) => setEditRockForm({...editRockForm, year: parseInt(v)})}>
                                                        <SelectTrigger className="bg-background border-border text-foreground text-sm"><SelectValue placeholder="Year" /></SelectTrigger>
                                                        <SelectContent>
                                                          {yearOptions.map((y) => (
                                                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                                          ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <input type="checkbox" checked={editRockForm.priority} onChange={(e) => setEditRockForm({ ...editRockForm, priority: e.target.checked })} className="h-4 w-4 rounded border-input" />
                                                    <label className="text-sm text-muted-foreground">High Priority</label>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button size="sm" onClick={handleSaveRock} className="bg-accent text-accent-foreground">Save</Button>
                                                    <Button size="sm" variant="ghost" onClick={handleCancelRockEdit}>Cancel</Button>
                                                </div>
                                             </div>
                                          ) : (
                                             <>
                                              <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                  {rock.priority && <Badge variant="destructive" className="text-[10px] px-1 py-0">HIGH</Badge>}
                                                  <p className="text-sm text-foreground">{rock.text}</p>
                                                </div>
                                                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                                                    <span>{rock.quarter} {rock.year}</span>
                                                    {rock.assigneeName && <span>• {rock.assigneeName}</span>}
                                                </div>
                                              </div>
                                              <ActionMenu onEdit={() => handleEditRock(rock)} onDelete={() => handleDeleteRock(rock.id)} />
                                             </>
                                          )}
                                       </div>
                                   ))}
                                   
                                   {addingRockTo === capability.id && quarter === newRockForm.quarter && (
                                      <div className="p-2 rounded bg-muted space-y-2 border border-border">
                                         <Input value={newRockForm.text} onChange={(e) => setNewRockForm({...newRockForm, text: e.target.value})} placeholder="New rock..." autoFocus className="bg-background border-border text-foreground text-sm" />
                                          <Select value={newRockForm.assigneeId || "unassigned"} onValueChange={(v) => setNewRockForm({...newRockForm, assigneeId: v === "unassigned" ? "" : v})}>
                                              <SelectTrigger className="bg-background border-border text-foreground text-sm"><SelectValue placeholder="Assignee" /></SelectTrigger>
                                              <SelectContent>
                                                  <SelectItem value="unassigned">Unassigned</SelectItem>
                                                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}
                                              </SelectContent>
                                          </Select>
                                          <div className="flex items-center space-x-2">
                                              <input type="checkbox" checked={newRockForm.priority} onChange={(e) => setNewRockForm({ ...newRockForm, priority: e.target.checked })} className="h-4 w-4 rounded border-input" />
                                              <label className="text-sm text-muted-foreground">High Priority</label>
                                          </div>
                                          <div className="flex gap-2">
                                            <Button size="sm" onClick={() => handleAddRock(capability.id)} className="bg-accent text-accent-foreground">Add</Button>
                                            <Button size="sm" variant="ghost" onClick={() => setAddingRockTo(null)}>Cancel</Button>
                                          </div>
                                      </div>
                                   )}
                                </div>
                              );
                           })}
                           
                           {addingRockTo !== capability.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setAddingRockTo(capability.id);
                                setNewRockForm({ ...newRockForm, quarter: "Q1", year: selectedYear });
                              }}
                              className="w-full text-xs border-dashed border-border text-muted-foreground hover:bg-accent"
                            >
                              <PlusIcon className="h-3 w-3 mr-1" />
                              Add Rock
                            </Button>
                           )}
                        </div>
                       )}
                    </div>
                  );
                 })
              )}
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
