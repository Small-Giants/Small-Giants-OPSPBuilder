import { useRef, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  CalendarIcon,
  TrendingUpIcon,
  DollarSignIcon,
  TargetIcon,
  BarChartIcon,
  FlameIcon,
  PlusIcon,
  PencilIcon,
  XIcon,
  CheckIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ZapIcon,
  ActivityIcon
} from "lucide-react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { db } from "@/lib/firebase";
import { doc, collection, onSnapshot, setDoc, updateDoc, addDoc, deleteDoc, query, where, type Unsubscribe } from "firebase/firestore";
import { LEGACY_PLAN_YEAR, usePlanYear } from "@/contexts/PlanYearContext";

export default function OneYear() {
  const { toast } = useToast();
  const { companyId, selectedYear, availableYears } = usePlanYear();
  
  const [oneYearData, setOneYearData] = useState<{
    onePhraseStrategy: string;
    oneYearGoals: {
      revenue: { label: string; value: string; };
      grossProfit: { label: string; value: string; };
      netProfit: { label: string; value: string; };
      cash: { label: string; value: string; };
      nps: { label: string; value: string; };
      enps: { label: string; value: string; };
      bptw: { label: string; value: string; };
      emr: { label: string; value: string; };
      bhag: { label: string; value: string; };
      gainFade: { label: string; value: string; };
      entryExit: { label: string; value: string; };
    };
    criticalNumbers: {
      profitPerX: { label: string; value: string; };
      nps: { label: string; value: string; };
      enps: { label: string; value: string; };
      laborEfficiencyRatio: { label: string; value: string; };
      builderProtectorRatio: { label: string; value: string; };
    };
  }>({
    onePhraseStrategy: "",
    oneYearGoals: {
      revenue: { label: "Revenue", value: "" },
      grossProfit: { label: "Gross Profit", value: "" },
      netProfit: { label: "Net Profit", value: "" },
      cash: { label: "Cash", value: "" },
      nps: { label: "NPS", value: "" },
      enps: { label: "eNPS", value: "" },
      bptw: { label: "BPTW", value: "" },
      emr: { label: "EMR", value: "" },
      bhag: { label: "BHAG", value: "" },
      gainFade: { label: "Gain/Fade", value: "" },
      entryExit: { label: "Entry/Exit", value: "" }
    },
    criticalNumbers: {
      profitPerX: { label: "Profit per X", value: "" },
      nps: { label: "NPS", value: "" },
      enps: { label: "eNPS", value: "" },
      laborEfficiencyRatio: { label: "Labor Efficiency Ratio", value: "" },
      builderProtectorRatio: { label: "Builder Protector Ratio", value: "" }
    }
  });

  const [priorities, setPriorities] = useState<any[]>([]);
  const [rocks, setRocks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  
  const [expandedPriority, setExpandedPriority] = useState<string | null>(null);
  const [addingRockTo, setAddingRockTo] = useState<string | null>(null);
  const [newRockForm, setNewRockForm] = useState({ text: "", assigneeId: "", assigneeName: "", quarter: "Q1", year: selectedYear, priority: false });
  const [editingRock, setEditingRock] = useState<string | null>(null);
  const [editRockForm, setEditRockForm] = useState({ text: "", assigneeId: "", assigneeName: "", quarter: "Q1", year: selectedYear, priority: false });
  const useLegacyMainRef = useRef(false);

  useEffect(() => {
    let unsubYearRoadmap: Unsubscribe | undefined;
    let unsubLegacyRoadmap: Unsubscribe | undefined;
    let unsubPrioritiesYear: Unsubscribe | undefined;
    let unsubPrioritiesLegacy: Unsubscribe | undefined;
    let unsubRocksYear: Unsubscribe | undefined;
    let unsubRocksLegacy: Unsubscribe | undefined;

    // 1) One-year data (year-scoped doc, with legacy fallback for 2025)
    const yearRoadmapRef = doc(db, "companies", companyId, "roadmap", `one-year-${selectedYear}`);
    const legacyMainRef = doc(db, "companies", companyId, "roadmap", "main");

    const applyOneYearFields = (data: any) => {
      setOneYearData((prev) => {
        let parsedGoals = prev.oneYearGoals;
        if (data?.oneYearGoal) {
          try {
            const goalData = typeof data.oneYearGoal === "string" ? JSON.parse(data.oneYearGoal) : data.oneYearGoal;
            parsedGoals = { ...prev.oneYearGoals, ...(goalData || {}) };
          } catch (e) {
            }
        }
        const criticalNumbers = data?.criticalNumbers || {};
        return {
          ...prev,
          onePhraseStrategy: data?.onePhraseStrategy || "",
          oneYearGoals: parsedGoals,
          criticalNumbers: { ...prev.criticalNumbers, ...criticalNumbers },
        };
      });
    };

    unsubYearRoadmap = onSnapshot(
      yearRoadmapRef,
      (snap) => {
        if (snap.exists()) {
          useLegacyMainRef.current = false;
          applyOneYearFields(snap.data());
        } else {
          useLegacyMainRef.current = selectedYear === LEGACY_PLAN_YEAR;
        }
        setLoading(false);
      },
      () => {
        // If the year doc is denied/missing, allow fallback if applicable.
        useLegacyMainRef.current = selectedYear === LEGACY_PLAN_YEAR;
        setLoading(false);
      }
    );

    if (selectedYear === LEGACY_PLAN_YEAR) {
      unsubLegacyRoadmap = onSnapshot(
        legacyMainRef,
        (snap) => {
          if (!useLegacyMainRef.current) return;
          if (snap.exists()) applyOneYearFields(snap.data());
          setLoading(false);
        },
        () => {
          // ignore
        }
      );
    }

    // 2) Priorities (year-scoped)
    const prioritiesById = new Map<string, any>();
    const applyPriorities = () => setPriorities(Array.from(prioritiesById.values()));

    const prioritiesCol = collection(db, "companies", companyId, "priorities");
    const qPrioritiesYear = query(
      prioritiesCol,
      where("type", "==", "priority"),
      where("planYear", "==", selectedYear)
    );
    unsubPrioritiesYear = onSnapshot(qPrioritiesYear, (snapshot) => {
      prioritiesById.clear();
      snapshot.forEach((d) => prioritiesById.set(d.id, { id: d.id, ...d.data() }));
      applyPriorities();
    });

    if (selectedYear === LEGACY_PLAN_YEAR) {
      const qPrioritiesLegacy = query(
        prioritiesCol,
        where("type", "==", "priority"),
        where("planYear", "==", null)
      );
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

    // 3) Rocks (year-scoped)
    const rocksById = new Map<string, any>();
    const applyRocks = () => setRocks(Array.from(rocksById.values()));

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
    
    // 4. Users
    const usersRef = collection(db, 'users');
    const unsubUsers = onSnapshot(usersRef, (snapshot) => {
        const u: any[] = [];
        snapshot.forEach(d => u.push({ id: d.id, ...d.data() }));
        setUsers(u);
    });

    return () => {
      unsubYearRoadmap?.();
      unsubLegacyRoadmap?.();
      unsubPrioritiesYear?.();
      unsubPrioritiesLegacy?.();
      unsubRocksYear?.();
      unsubRocksLegacy?.();
      unsubUsers();
    };
  }, [companyId, selectedYear]);

  // Keep default year aligned when user switches years
  useEffect(() => {
    setNewRockForm((prev) => ({ ...prev, year: selectedYear }));
    setEditRockForm((prev) => ({ ...prev, year: selectedYear }));
  }, [selectedYear]);

  const yearOptions = Array.from(new Set<number>([...availableYears, selectedYear, selectedYear + 1])).sort((a, b) => a - b);

  const handleSave = async (fieldPath: string) => {
    let normalizedPath = fieldPath;
    if (fieldPath.startsWith('oneyeargoals.')) {
      normalizedPath = 'oneYearGoals.' + fieldPath.substring('oneyeargoals.'.length);
    } else if (fieldPath.startsWith('criticalnumbers.')) {
      normalizedPath = 'criticalNumbers.' + fieldPath.substring('criticalnumbers.'.length);
    }
    
    // Optimistic update logic for local state
    let newData: any;
    setOneYearData(prev => {
        // Deep clone
        const nextState = JSON.parse(JSON.stringify(prev));
        
        if (normalizedPath.includes('.')) {
            const pathParts = normalizedPath.split('.');
            let current = nextState;
            for (let i = 0; i < pathParts.length - 1; i++) {
                current = current[pathParts[i]];
            }
            current[pathParts[pathParts.length - 1]] = editValue;
        } else {
            nextState[normalizedPath] = editValue;
        }
        newData = nextState;
        return nextState;
    });

    // Prepare data for Firestore
    const dataToSave: any = {};
    
    if (normalizedPath === 'onePhraseStrategy') {
      dataToSave.onePhraseStrategy = editValue;
    } else if (normalizedPath.startsWith('oneYearGoals.')) {
      // We need to save the whole object for oneYearGoals if we store it as JSON string
      // or simpler if we store as map.
      // The previous code stringified it.
      // Let's store as object in Firestore for better querying/updates, but 
      // if we stick to previous schema logic, oneYearGoal is a string field in Postgres.
      // In Firestore, let's store 'oneYearGoal' as a Map (object) if possible, or stringify to match legacy.
      // Given the code in useEffect parses it, let's stringify it to be safe with existing logic,
      // OR better, let's migrate to storing as Object in Firestore 'roadmap/main' document.
      // I'll store it as an object 'oneYearGoal' in Firestore.
      // But wait, `useEffect` logic: `const goalData = typeof data.oneYearGoal === 'string' ? JSON.parse... : data.oneYearGoal;`
      // So it handles both. I'll save as object.
      dataToSave.oneYearGoal = newData.oneYearGoals; 
    } else if (normalizedPath.startsWith('criticalNumbers.')) {
      dataToSave.criticalNumbers = newData.criticalNumbers;
    }

    try {
      const roadmapRef = doc(db, "companies", companyId, "roadmap", `one-year-${selectedYear}`);
      await setDoc(
        roadmapRef,
        { year: selectedYear, ...dataToSave, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      toast({ title: "Saved", description: "Goals have been saved successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    }
    
    setEditingField(null);
    setEditValue("");
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
    
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !multiline) {
        e.preventDefault();
        handleSave(fieldPath);
      }
    };
    
    if (isEditing) {
      return (
        <div className="flex gap-2 items-start">
          {multiline ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 bg-background border-border text-foreground"
              autoFocus
              rows={3}
            />
          ) : (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-background border-border text-foreground"
              autoFocus
            />
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleSave(fieldPath)}
            className="h-8 w-8 text-green-600 hover:text-green-700"
            data-testid={`button-save-${fieldPath}`}
          >
            <CheckIcon className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleCancel}
            className="h-8 w-8 text-red-600 hover:text-red-700"
            data-testid={`button-cancel-${fieldPath}`}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      );
    }
    
    return (
      <div className="flex gap-2 items-start group">
        <p className={`flex-1 ${multiline ? 'text-sm leading-relaxed' : 'text-lg font-medium'} text-foreground`}>
          {value || "-"}
        </p>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => handleEdit(fieldPath, value)}
          className="h-6 w-6 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          data-testid={`button-edit-${fieldPath}`}
        >
          <PencilIcon className="h-3 w-3" />
        </Button>
      </div>
    );
  };

  const renderMetricGrid = (metrics: any, title: string, columns = 3) => {
    if (!metrics || typeof metrics !== 'object') {
      return <div className="text-center text-muted-foreground">No metrics data available</div>;
    }
    
    const metricEntries = Object.entries(metrics);
    
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${columns} gap-4`}>
        {metricEntries.map(([key, metric]: [string, any]) => {
          if (!metric || typeof metric !== 'object') {
            return null;
          }
          return (
            <div key={key} className="border border-border rounded-lg p-4 bg-muted hover:bg-muted/80 transition-colors">
              <div className="text-center">
                <h4 className="text-foreground text-sm font-medium mb-2">{metric.label || key}</h4>
                {renderEditableField(`${title.toLowerCase().replace(' ', '')}.${key}.value`, metric.value || "")}
              </div>
            </div>
          );
        })}
      </div>
    );
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

  const annualPriorities = priorities.filter((p: any) => p.type === 'priority');
  const prioritiesWithRocks = annualPriorities.map(p => ({
      ...p,
      rocks: rocks.filter(r => r.priorityId === p.id)
  }));

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading One Year Plan...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <div className="flex items-center gap-3 mb-2">
          <CalendarIcon className="w-6 h-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">One Year</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Define your one-year strategy, goals, priorities, and quarterly execution plan
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <ZapIcon className="w-5 h-5" />
              One Phrase Strategy
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderEditableField("onePhraseStrategy", oneYearData.onePhraseStrategy, true)}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <TargetIcon className="w-5 h-5" />
              One Year Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderMetricGrid(oneYearData.oneYearGoals, "oneYearGoals", 3)}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <TrendingUpIcon className="w-5 h-5" />
              Annual Priorities
              <Badge className="ml-auto bg-accent text-accent-foreground border-border">
                {annualPriorities.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {prioritiesWithRocks.length === 0 ? (
                <div className="text-muted-foreground text-sm py-4 text-center">
                  No annual priorities added yet. Add priorities from the Priority Management page.
                </div>
              ) : (
                prioritiesWithRocks.map((priority: any, idx: number) => {
                  const rocksByQuarter = groupRocksByQuarter(priority.rocks || []);
                  const totalRocks = (priority.rocks || []).length;
                  
                  return (
                    <div key={priority.id} className="group border border-border rounded-lg p-3 bg-muted">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-muted-foreground font-medium">{idx + 1}:</span>
                            <h4 className="font-medium text-foreground">{priority.title}</h4>
                            <Badge variant="secondary" className="text-xs">
                              Priority
                            </Badge>
                          </div>
                          {priority.description && (
                            <p className="text-sm text-muted-foreground mb-2">{priority.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {totalRocks > 0 ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedPriority(
                                  expandedPriority === priority.id ? null : priority.id
                                )}
                                className="text-xs p-0 h-auto hover:bg-transparent text-muted-foreground"
                              >
                                {expandedPriority === priority.id ? (
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
                                setAddingRockTo(priority.id);
                                setExpandedPriority(priority.id);
                              }}
                              className="text-xs h-6 px-2 border-dashed border-border text-muted-foreground hover:bg-accent"
                            >
                              <PlusIcon className="h-3 w-3 mr-1" />
                              Add Rock
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {expandedPriority === priority.id && (
                        <div className="mt-4 pl-4 border-l-2 border-border space-y-3">
                          {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((quarter) => {
                            const quarterRocks = rocksByQuarter[quarter] || [];
                            if (quarterRocks.length === 0 && addingRockTo !== priority.id) return null;
                            
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
                                            {rock.assigneeName && (
                                              <span>• {rock.assigneeName}</span>
                                            )}
                                          </div>
                                        </div>
                                        <ActionMenu
                                          onEdit={() => handleEditRock(rock)}
                                          onDelete={() => handleDeleteRock(rock.id)}
                                        />
                                      </>
                                    )}
                                  </div>
                                ))}
                                
                                {addingRockTo === priority.id && quarter === newRockForm.quarter && (
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
                                        <Button size="sm" onClick={() => handleAddRock(priority.id)} className="bg-accent text-accent-foreground">Add</Button>
                                        <Button size="sm" variant="ghost" onClick={() => setAddingRockTo(null)}>Cancel</Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          
                          {addingRockTo !== priority.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setAddingRockTo(priority.id);
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

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <BarChartIcon className="w-5 h-5" />
              Critical Numbers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderMetricGrid(oneYearData.criticalNumbers, "criticalNumbers", 2)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
