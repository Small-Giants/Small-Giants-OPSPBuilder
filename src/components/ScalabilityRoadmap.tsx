import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  RocketIcon,
  TargetIcon,
  TrendingUpIcon,
  CalendarIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  StarIcon,
  ShieldIcon,
  UsersIcon,
  BrainIcon,
  ChevronDown,
  ChevronUp,
  FilterIcon
} from "lucide-react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { db } from "@/lib/firebase";
import { doc, collection, onSnapshot, query, where, type Unsubscribe } from "firebase/firestore";
import { LEGACY_PLAN_YEAR, usePlanYear } from "@/contexts/PlanYearContext";

interface ScalabilityRoadmapProps {
  data?: any;
}

export default function ScalabilityRoadmap({ data }: ScalabilityRoadmapProps) {
  const { companyId, selectedYear } = usePlanYear();
  
  const [roadmapData, setRoadmapData] = useState({
    companyName: "Caliente Construction",
    threeHagDate: "",
    oneYearDate: "",
    
    // Foundation Section
    foundation: {
      corePurpose: "",
      mission: "",
      coreValues: [] as Array<{ id: string; name: string; description: string }>,
      strategicAnchors: [] as Array<{ id: string; text: string }>,
      coreCustomer: "",
      brandPromise: ""
    },
    
    // Three Year Section
    threeYear: {
      bhag: "",
      threeHagStatement: "",
      knownFor: "",
      capabilities: [] as Array<{ id: string; text: string }>,
      strengths: [] as Array<{ id: string; text: string }>,
      weaknesses: [] as Array<{ id: string; text: string }>,
      opportunities: [] as Array<{ id: string; text: string }>,
      threats: [] as Array<{ id: string; text: string }>
    },
    
    // One Year Section
    oneYear: {
      onePhraseStrategy: "",
      criticalNumbers: {
        profitPerX: { label: "Profit per X", value: "" },
        nps: { label: "NPS", value: "" },
        enps: { label: "eNPS", value: "" },
        ler: { label: "Labor Efficiency Ratio", value: "" },
        bpr: { label: "Builder Protector Ratio", value: "" }
      },
      annualPriorities: [] as Array<{ id: string; text: string }>
    },
    
    // One Year Goals
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
    
    // Quarterly Rocks
    quarterlyRocks: {
      capabilities: { Q1: [], Q2: [], Q3: [], Q4: [] },
      priorities: { Q1: [], Q2: [], Q3: [], Q4: [] },
      department: { Q1: [], Q2: [], Q3: [], Q4: [] }
    },
    
    teamMembers: [] as any[]
  });

  const [sectionsExpanded, setSectionsExpanded] = useState({
    foundation: true,
    threeYear: true,
    oneYear: true
  });

  const [quartersExpanded, setQuartersExpanded] = useState({
    Q1: true,
    Q2: true,
    Q3: true,
    Q4: true
  });

  const [rockFilters, setRockFilters] = useState({
    quarter: 'all',
    assignee: 'all',
    status: 'all'
  });

  // Additional state for checklist calculation
  const [checklistData, setChecklistData] = useState<{ averages: any[], overall: any } | null>(null);

  useEffect(() => {
    // 1. Foundation (core purpose, mission, values, etc.)
    const unsubFoundation = onSnapshot(
      doc(db, 'companies', companyId, 'roadmap', 'foundation'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setRoadmapData(prev => ({
            ...prev,
            foundation: {
              corePurpose: data.corePurpose || "",
              mission: data.mission || "",
              brandPromise: data.brandPromise || "",
              coreCustomer: data.coreCustomer || "",
              coreValues: data.coreValues || [],
              strategicAnchors: data.strategicAnchors || []
            }
          }));
        }
      },
      (error) => {
        }
    );

    // 2. Roadmap main (BHAG, 3-year targets, one-year strategy, etc.)
    const unsubRoadmap = onSnapshot(doc(db, 'companies', companyId, 'roadmap', 'main'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Parse JSON fields if they are stored as strings
        let parsedGoals = {};
        if (data.oneYearGoal) {
            try {
                parsedGoals = typeof data.oneYearGoal === 'string' ? JSON.parse(data.oneYearGoal) : data.oneYearGoal;
            } catch(e) {}
        }
        let parsedCriticalNumbers = {};
        if (data.criticalNumbers) {
            try {
                parsedCriticalNumbers = typeof data.criticalNumbers === 'string' ? JSON.parse(data.criticalNumbers) : data.criticalNumbers;
            } catch(e) {}
        }

        setRoadmapData(prev => ({
          ...prev,
          companyName: data.companyName || "Caliente Construction",
          threeHagDate: data.threeHagDate || "",
          oneYearDate: data.oneYearDate || "",
          threeYear: {
            ...prev.threeYear,
            bhag: data.bhag || "",
            threeHagStatement: data.threeHagStatement || "",
            knownFor: data.knownFor || ""
          },
          oneYear: {
            ...prev.oneYear,
            onePhraseStrategy: data.onePhraseStrategy || "",
            criticalNumbers: { ...prev.oneYear.criticalNumbers, ...parsedCriticalNumbers }
          },
          oneYearGoals: { ...prev.oneYearGoals, ...parsedGoals }
        }));
      }
    });

    // 2. Priorities (year-scoped)
    let unsubPrioritiesYear: Unsubscribe | undefined;
    let unsubPrioritiesLegacy: Unsubscribe | undefined;
    const prioritiesById = new Map<string, any>();
    const applyPriorities = () => {
      const items = Array.from(prioritiesById.values());
      // Sort by sortOrder to match Priority Management ordering
      const capabilities = items
        .filter((p) => p.type === "capability")
        .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const annualPriorities = items
        .filter((p) => p.type === "priority")
        .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

      setRawPriorities(items);
      setRoadmapData((prev) => ({
        ...prev,
        threeYear: {
          ...prev.threeYear,
          capabilities: capabilities.map((c) => ({ id: c.id, text: c.title || c.description })),
        },
        oneYear: {
          ...prev.oneYear,
          annualPriorities: annualPriorities.map((p) => ({ id: p.id, text: p.title || p.description })),
        },
      }));
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

    // 3. SWOT (year-scoped, with legacy fallback for 2025)
    let unsubSwotYear: Unsubscribe | undefined;
    let unsubSwotLegacy: Unsubscribe | undefined;
    let useLegacySwot = false;

    const applySwot = (data: any) => {
      const strengths = Array.isArray(data?.strengths) ? data.strengths : [];
      const weaknesses = Array.isArray(data?.weaknesses) ? data.weaknesses : [];
      const opportunities = Array.isArray(data?.opportunities) ? data.opportunities : [];
      const threats = Array.isArray(data?.threats) ? data.threats : [];

      setRoadmapData((prev) => ({
        ...prev,
        threeYear: {
          ...prev.threeYear,
          strengths: strengths.map((text: string, i: number) => ({ id: `s${i}`, text })),
          weaknesses: weaknesses.map((text: string, i: number) => ({ id: `w${i}`, text })),
          opportunities: opportunities.map((text: string, i: number) => ({ id: `o${i}`, text })),
          threats: threats.map((text: string, i: number) => ({ id: `t${i}`, text })),
        },
      }));
    };

    const swotYearRef = doc(db, "companies", companyId, "swot", `analysis-${selectedYear}`);
    const swotLegacyRef = doc(db, "companies", companyId, "swot", "analysis");

    unsubSwotYear = onSnapshot(
      swotYearRef,
      (snap) => {
        if (snap.exists()) {
          useLegacySwot = false;
          applySwot(snap.data());
        } else {
          useLegacySwot = selectedYear === LEGACY_PLAN_YEAR;
          if (selectedYear !== LEGACY_PLAN_YEAR) {
            applySwot({ strengths: [], weaknesses: [], opportunities: [], threats: [] });
          }
        }
      },
      () => {
        useLegacySwot = selectedYear === LEGACY_PLAN_YEAR;
      }
    );

    if (selectedYear === LEGACY_PLAN_YEAR) {
      unsubSwotLegacy = onSnapshot(
        swotLegacyRef,
        (snap) => {
          if (!useLegacySwot) return;
          if (snap.exists()) applySwot(snap.data());
        },
        () => {
          // ignore
        }
      );
    }

    // 4. Rocks (and calculate rollup)
    // Note: Rocks need to be joined with priorities to know type/title
    const rocksById = new Map<string, any>();
    const applyRocks = () => setRawRocks(Array.from(rocksById.values()));

    let unsubRocksYear: Unsubscribe | undefined;
    let unsubRocksLegacy: Unsubscribe | undefined;

    const rocksCol = collection(db, "companies", companyId, "rocks");
    const rocksQuery = query(rocksCol, where("year", "==", selectedYear));
    unsubRocksYear = onSnapshot(rocksQuery, (snapshot) => {
      rocksById.clear();
      snapshot.forEach((d) => rocksById.set(d.id, { id: d.id, ...d.data() }));
      applyRocks();
    });

    if (selectedYear === LEGACY_PLAN_YEAR) {
      const legacyRocksQuery = query(rocksCol, where("year", "==", null));
      unsubRocksLegacy = onSnapshot(
        legacyRocksQuery,
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

    // 5. Agile Checklist
    const unsubChecklist = onSnapshot(collection(db, 'companies', companyId, 'agile-checklist'), (snapshot) => {
       // Calculate averages
       const items: any[] = [];
       snapshot.forEach(doc => items.push(doc.data()));
       // ... calculation logic ...
       const categories = ['leadership', 'talent', 'strategy', 'execution', 'cash', 'customer', 'systems'];
       const averages = categories.map(cat => {
           const catItems = items.filter(i => i.category === cat);
           const totalScore = catItems.reduce((sum, i) => sum + (i.score || 0), 0);
           const avg = catItems.length ? totalScore / (catItems.length * 5) : 0; // Normalized 0-1
           return { category: cat, averageScore: avg };
       });
       
       const totalChecked = items.filter(i => i.score > 0).length; // Assuming score > 0 means checked/rated
       const totalPossible = 35; // Fixed for now or derive
       const overallAvg = items.length ? items.reduce((sum, i) => sum + (i.score || 0), 0) / (items.length * 5) : 0;

       setChecklistData({
           averages,
           overall: {
               totalItemsChecked: totalChecked,
               totalPossibleItems: totalPossible,
               overallAverage: overallAvg,
               totalUsers: 1 // simplified
           }
       });
    });

    // 6. Users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      setRoadmapData(prev => ({ ...prev, teamMembers: items }));
    });

    return () => {
      unsubFoundation();
      unsubRoadmap();
      unsubPrioritiesYear?.();
      unsubPrioritiesLegacy?.();
      unsubSwotYear?.();
      unsubSwotLegacy?.();
      unsubRocksYear?.();
      unsubRocksLegacy?.();
      unsubChecklist();
      unsubUsers();
    };
  }, [companyId, selectedYear]);

  // Override one-year fields from the year-scoped roadmap doc.
  // If the year doc doesn't exist and it's NOT the legacy year, we clear one-year fields
  // so we don't accidentally show the shared 2025 values.
  useEffect(() => {
    let unsub: Unsubscribe | undefined;

    const yearRef = doc(db, "companies", companyId, "roadmap", `one-year-${selectedYear}`);
    unsub = onSnapshot(
      yearRef,
      (snap) => {
        if (!snap.exists()) {
          if (selectedYear !== LEGACY_PLAN_YEAR) {
            setRoadmapData((prev) => {
              const clearedGoals: any = {};
              Object.entries(prev.oneYearGoals).forEach(([k, v]: [string, any]) => {
                clearedGoals[k] = { ...v, value: "" };
              });
              const clearedCritical: any = {};
              Object.entries(prev.oneYear.criticalNumbers).forEach(([k, v]: [string, any]) => {
                clearedCritical[k] = { ...v, value: "" };
              });
              return {
                ...prev,
                oneYear: { ...prev.oneYear, onePhraseStrategy: "", criticalNumbers: clearedCritical },
                oneYearGoals: clearedGoals,
              };
            });
          }
          return;
        }

        const data = snap.data() as any;

        let parsedGoals: any = {};
        if (data.oneYearGoal) {
          try {
            parsedGoals = typeof data.oneYearGoal === "string" ? JSON.parse(data.oneYearGoal) : data.oneYearGoal;
          } catch {
            parsedGoals = {};
          }
        }

        const rawCritical = data.criticalNumbers || {};

        setRoadmapData((prev) => {
          // Merge goals by key, preserving labels
          const nextGoals: any = { ...prev.oneYearGoals };
          Object.entries(parsedGoals || {}).forEach(([k, v]: [string, any]) => {
            if (nextGoals[k]) nextGoals[k] = { ...nextGoals[k], ...(typeof v === "object" ? v : { value: String(v) }) };
          });

          // Merge critical numbers; map OneYear component keys → roadmap keys
          const mappedCritical: any = { ...prev.oneYear.criticalNumbers };
          const assign = (targetKey: string, sourceKey: string) => {
            const src = rawCritical?.[sourceKey];
            if (src === undefined || src === null) return;
            const value = typeof src === "object" ? (src.value ?? "") : String(src);
            if (mappedCritical[targetKey]) mappedCritical[targetKey] = { ...mappedCritical[targetKey], value: String(value) };
          };

          // direct keys
          assign("profitPerX", "profitPerX");
          assign("nps", "nps");
          assign("enps", "enps");
          assign("ler", "ler");
          assign("bpr", "bpr");
          // mapped keys from OneYear page
          assign("ler", "laborEfficiencyRatio");
          assign("bpr", "builderProtectorRatio");

          return {
            ...prev,
            oneYear: {
              ...prev.oneYear,
              onePhraseStrategy: data.onePhraseStrategy || "",
              criticalNumbers: mappedCritical,
            },
            oneYearGoals: nextGoals,
          };
        });
      },
      () => {
        // ignore
      }
    );

    return () => unsub?.();
  }, [companyId, selectedYear]);

  const [rawRocks, setRawRocks] = useState<any[]>([]);
  const [rawPriorities, setRawPriorities] = useState<any[]>([]); // Capture raw priorities for mapping

  // Listen to priorities separately to update rawPriorities for rock mapping
  useEffect(() => {
      // rawPriorities is managed by the year-scoped listener above
      return () => {};
  }, []);

  // Combine Rocks and Priorities to form Quarterly Rocks
  useEffect(() => {
      const quarterlyRocks: any = {
        capabilities: { Q1: [], Q2: [], Q3: [], Q4: [] },
        priorities: { Q1: [], Q2: [], Q3: [], Q4: [] },
        department: { Q1: [], Q2: [], Q3: [], Q4: [] }
      };

      rawRocks.forEach(rock => {
          const priority = rawPriorities.find(p => p.id === rock.priorityId);
          const priorityType = priority?.type || 'priority'; // Default to priority if unknown? Or maybe just skip.
          const priorityTitle = priority?.title || 'Unknown';
          const quarter = rock.quarter || 'Q1';

          const rockData = {
              id: rock.id,
              text: rock.text,
              assignee: rock.assigneeId,
              assigneeName: rock.assigneeName || 'Unassigned',
              capabilityTitle: priorityTitle,
              priorityTitle: priorityTitle
          };

          if (priorityType === 'priority') {
              if (!quarterlyRocks.priorities[quarter]) quarterlyRocks.priorities[quarter] = [];
              quarterlyRocks.priorities[quarter].push(rockData);
          } else if (priorityType === 'capability') {
              if (!quarterlyRocks.capabilities[quarter]) quarterlyRocks.capabilities[quarter] = [];
              quarterlyRocks.capabilities[quarter].push(rockData);
          }
      });

      setRoadmapData(prev => ({ ...prev, quarterlyRocks }));

  }, [rawRocks, rawPriorities]);


  // ... Render functions (renderField, renderList, renderQuarterlyRocks) ...
  // Copying them from original file
  const renderField = (value: string, multiline = false) => {
    return (
      <p className={`${multiline ? 'text-xs' : 'text-sm'} text-foreground`}>{value}</p>
    );
  };

  const renderList = (items: any[], useNumbering?: boolean) => {
    const numberWords = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
    return (
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={item.id || idx} className="flex items-start gap-2 py-1">
            <span className="text-accent text-xs mt-0.5">
              {useNumbering ? `${numberWords[idx] || `${idx + 1}`}:` : '•'}
            </span>
            <span className="flex-1 text-xs text-foreground leading-relaxed">{item.text || item.name}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderQuarterlyRocks = (type: 'capabilities' | 'priorities') => {
    const rocks = roadmapData.quarterlyRocks[type];
    if (!rocks || Object.keys(rocks).length === 0) return null;

    const allRocks: any[] = [];
    (['Q1', 'Q2', 'Q3', 'Q4'] as const).forEach((quarter) => {
      const quarterKey = quarter as keyof typeof rocks;
      const quarterRocks = rocks[quarterKey] || [];
      quarterRocks.forEach((rock: any) => {
        allRocks.push({ ...rock, quarter });
      });
    });

    if (allRocks.length === 0) return null;

    // Apply filters
    const rocksByQuarter: Record<string, any[]> = { Q1: [], Q2: [], Q3: [], Q4: [] };
    allRocks.forEach((rock) => {
      let passesFilter = true;
      if (rockFilters.quarter !== 'all' && rock.quarter !== rockFilters.quarter) passesFilter = false;
      if (rockFilters.assignee !== 'all') {
        const assigneeMatch = rockFilters.assignee === 'unassigned' 
          ? (!rock.assigneeName || rock.assigneeName === 'Unassigned')
          : rock.assignee === rockFilters.assignee;
        if (!assigneeMatch) passesFilter = false;
      }
      if (rockFilters.status !== 'all' && rock.status && rock.status !== rockFilters.status) passesFilter = false;
      
      if (passesFilter) rocksByQuarter[rock.quarter].push(rock);
    });

    const totalFilteredRocks = Object.values(rocksByQuarter).flat().length;
    if (totalFilteredRocks === 0) {
      return (
        <div className="mt-3 p-3 bg-muted rounded border border-border text-center">
          <p className="text-xs text-muted-foreground">No tactics match the current filters</p>
        </div>
      );
    }

    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-xs font-bold text-accent uppercase tracking-wider">Quarterly Tactics</h4>
          <Badge variant="secondary" className="text-[9px]">{totalFilteredRocks}</Badge>
        </div>
        {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((quarter) => {
          const quarterRocks = rocksByQuarter[quarter];
          if (quarterRocks.length === 0) return null;
          return (
            <div key={quarter} className="bg-muted rounded border border-border">
              <button
                onClick={() => setQuartersExpanded({ ...quartersExpanded, [quarter]: !quartersExpanded[quarter] })}
                className="w-full flex items-center justify-between p-2 hover:bg-muted/80 rounded"
              >
                <div className="flex items-center gap-2">
                  {quartersExpanded[quarter] ? <ChevronUp className="w-3 h-3 text-accent" /> : <ChevronDown className="w-3 h-3 text-accent" />}
                  <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5">{quarter}</Badge>
                  <span className="text-xs font-semibold text-foreground">{quarterRocks.length} {quarterRocks.length === 1 ? 'Tactic' : 'Tactics'}</span>
                </div>
              </button>
              {quartersExpanded[quarter] && (
                <div className="px-2 pb-2 space-y-1">
                  {quarterRocks.map((rock: any, idx: number) => (
                    <div key={rock.id || idx} className="flex items-start gap-2 p-2 bg-muted/50 rounded border border-border">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-foreground block">{rock.text}</span>
                        <div className="flex flex-wrap gap-1 items-center mt-1">
                          {rock.capabilityTitle && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">{rock.capabilityTitle}</Badge>}
                          {rock.priorityTitle && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">{rock.priorityTitle}</Badge>}
                          <span className="text-[9px] text-muted-foreground">• Assignee: {rock.assigneeName || 'Unassigned'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">{roadmapData.companyName}</h1>
        <p className="text-sm text-muted-foreground">SCALABILITY ROADMAP</p>
      </div>

      {/* FOUNDATION */}
      <div className="mb-8">
        <div className="flex items-center justify-center gap-4 mb-6 group">
          <Button variant="ghost" size="sm" onClick={() => setSectionsExpanded({ ...sectionsExpanded, foundation: !sectionsExpanded.foundation })}>
            {sectionsExpanded.foundation ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </Button>
          <h2 className="text-xl font-bold text-gradient-brand">FOUNDATION</h2>
          <ActionMenu onEdit={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'foundation' }))} onDelete={() => {}} className="opacity-0 group-hover:opacity-100" />
        </div>
        
        {sectionsExpanded.foundation && (
        <>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <Card className="bg-card border-border">
            <CardHeader className="bg-muted border-b border-border"><CardTitle className="text-sm text-foreground font-semibold">Core Purpose</CardTitle></CardHeader>
            <CardContent className="pt-4">{renderField(roadmapData.foundation.corePurpose, true)}</CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="bg-muted border-b border-border"><CardTitle className="text-sm text-foreground font-semibold">Mission</CardTitle></CardHeader>
            <CardContent className="pt-4">{renderField(roadmapData.foundation.mission, true)}</CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="bg-muted border-b border-border"><CardTitle className="text-sm text-foreground font-semibold">Brand Promise</CardTitle></CardHeader>
            <CardContent className="pt-4">{renderField(roadmapData.foundation.brandPromise)}</CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="bg-muted border-b border-border"><CardTitle className="text-sm text-foreground font-semibold">Core Customer</CardTitle></CardHeader>
            <CardContent className="pt-4">{renderField(roadmapData.foundation.coreCustomer, true)}</CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="bg-muted border-b border-border"><CardTitle className="text-sm text-foreground font-semibold">Strategic Anchors</CardTitle></CardHeader>
            <CardContent className="pt-4">{renderList(roadmapData.foundation.strategicAnchors)}</CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="bg-muted border-b border-border"><CardTitle className="text-sm text-foreground font-semibold">Culture Drivers</CardTitle></CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {roadmapData.foundation.coreValues.map((value) => (
                  <div key={value.id} className="border-l-2 border-accent pl-3 py-1">
                    <div><div className="flex items-center gap-2 mb-1"><span className="text-sm font-bold text-accent">{value.name}</span></div><p className="text-xs text-foreground leading-relaxed">{value.description}</p></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* THREE YEAR */}
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4 mb-4 group">
            <Button variant="ghost" size="sm" onClick={() => setSectionsExpanded({ ...sectionsExpanded, threeYear: !sectionsExpanded.threeYear })}>
              {sectionsExpanded.threeYear ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </Button>
            <h2 className="text-xl font-bold text-gradient-brand">THREE YEAR</h2>
            <ActionMenu onEdit={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'three-year' }))} onDelete={() => {}} className="opacity-0 group-hover:opacity-100" />
          </div>
          
          {sectionsExpanded.threeYear && (
          <>
          <Card className="bg-card border-border"><CardHeader className="bg-muted border-b border-border"><CardTitle className="text-sm text-foreground font-semibold">BHAG</CardTitle></CardHeader><CardContent className="pt-4">{renderField(roadmapData.threeYear.bhag)}</CardContent></Card>
          <Card className="bg-card border-border"><CardHeader className="bg-muted border-b border-border"><CardTitle className="text-sm text-foreground font-semibold">3HAG Statement</CardTitle></CardHeader><CardContent className="pt-4">{renderField(roadmapData.threeYear.threeHagStatement, true)}</CardContent></Card>
          <Card className="bg-card border-border"><CardHeader className="bg-muted border-b border-border"><CardTitle className="text-sm text-foreground font-semibold">Known For</CardTitle></CardHeader><CardContent className="pt-4">{renderField(roadmapData.threeYear.knownFor, true)}</CardContent></Card>
          <Card className="bg-card border-border">
            <CardHeader className="bg-muted border-b border-border"><CardTitle className="text-sm text-foreground font-semibold">Capabilities</CardTitle></CardHeader>
            <CardContent className="pt-4">{renderList(roadmapData.threeYear.capabilities, true)}{renderQuarterlyRocks('capabilities')}</CardContent>
          </Card>
          </>
          )}
        </div>

        {/* ONE YEAR */}
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4 mb-4 group">
            <Button variant="ghost" size="sm" onClick={() => setSectionsExpanded({ ...sectionsExpanded, oneYear: !sectionsExpanded.oneYear })}>
              {sectionsExpanded.oneYear ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </Button>
            <h2 className="text-xl font-bold text-gradient-brand">ONE YEAR</h2>
            <ActionMenu onEdit={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'one-year' }))} onDelete={() => {}} className="opacity-0 group-hover:opacity-100" />
          </div>
          
          {sectionsExpanded.oneYear && (
          <>
          <Card className="bg-card border-border"><CardHeader className="bg-muted border-b border-border"><CardTitle className="text-sm text-foreground font-semibold">One Phrase Strategy</CardTitle></CardHeader><CardContent className="pt-4">{renderField(roadmapData.oneYear.onePhraseStrategy, true)}</CardContent></Card>
          <Card className="bg-card border-border">
            <CardHeader className="bg-muted border-b border-border"><CardTitle className="text-sm text-foreground font-semibold">One Year Goals</CardTitle></CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(roadmapData.oneYearGoals).map(([key, goal]: [string, any]) => (
                  <div key={key} className="bg-muted p-2 rounded-md text-center border border-border">
                    <p className="text-xs text-muted-foreground mb-1">{goal.label}</p>
                    <p className="text-sm font-bold text-foreground">{['revenue', 'grossProfit', 'netProfit', 'cash'].includes(key) && goal.value ? `$${goal.value}` : goal.value || '-'}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="bg-muted border-b border-border"><CardTitle className="text-sm text-foreground font-semibold">Annual Strategic Objectives</CardTitle></CardHeader>
            <CardContent className="pt-4">{renderList(roadmapData.oneYear.annualPriorities, true)}{renderQuarterlyRocks('priorities')}</CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="bg-muted border-b border-border"><CardTitle className="text-sm text-foreground font-semibold">Critical Numbers</CardTitle></CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {Object.entries(roadmapData.oneYear.criticalNumbers).map(([key, metric]: [string, any]) => (
                  <div key={key} className="bg-muted p-2 rounded"><p className="text-xs text-muted-foreground">{metric.label}</p><p className="text-sm font-semibold text-foreground">{metric.value || '-'}</p></div>
                ))}
              </div>
            </CardContent>
          </Card>
          </>
          )}
        </div>
      </div>
      
      {/* SWOT */}
      <Card className="mb-8 bg-card border-border hover:border-accent/40 transition-all cursor-pointer group" onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'swot' }))}>
        <CardHeader className="bg-muted border-b border-border"><CardTitle className="text-lg text-foreground font-semibold flex items-center justify-between">SWOT Analysis<span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">(Click for details)</span></CardTitle></CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2"><div className="flex items-center justify-between"><p className="text-sm font-bold text-green-600 uppercase tracking-wider">Strengths</p></div><div className="bg-muted rounded p-3 min-h-[100px]">{renderList(roadmapData.threeYear.strengths)}</div></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><p className="text-sm font-bold text-yellow-600 uppercase tracking-wider">Weaknesses</p></div><div className="bg-muted rounded p-3 min-h-[100px]">{renderList(roadmapData.threeYear.weaknesses)}</div></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><p className="text-sm font-bold text-blue-600 uppercase tracking-wider">Opportunities</p></div><div className="bg-muted rounded p-3 min-h-[100px]">{renderList(roadmapData.threeYear.opportunities)}</div></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><p className="text-sm font-bold text-amber-600 uppercase tracking-wider">Threats</p></div><div className="bg-muted rounded p-3 min-h-[100px]">{renderList(roadmapData.threeYear.threats)}</div></div>
          </div>
        </CardContent>
      </Card>

      {/* Agile Checklist */}
      {checklistData && (
          <div className="mt-8 mb-8 cursor-pointer group" onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'assessments' }))}>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gradient-brand transition-all opacity-90 group-hover:opacity-100">THE 7 ATTRIBUTES OF AGILE GROWTH CHECKLIST®</h2>
              <p className="text-xs text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">(Click to open your checklist)</p>
            </div>
            <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto">
               <div className="space-y-4">
                  {['leadership', 'talent', 'strategy'].map(cat => {
                      const score = Math.round((checklistData.averages.find(a => a.category === cat)?.averageScore || 0) * 5);
                      return (
                        <div key={cat} className="bg-card border border-border rounded-lg p-4 group-hover:border-accent/30 transition-all">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-foreground font-semibold capitalize">{cat} Score</span>
                                <span className="text-xl font-bold text-accent">{score}</span>
                            </div>
                        </div>
                      );
                  })}
               </div>
               <div className="space-y-4">
                  {['execution', 'cash', 'customer'].map(cat => {
                      const score = Math.round((checklistData.averages.find(a => a.category === cat)?.averageScore || 0) * 5);
                      const label = cat === 'cash' ? 'Profit' : cat;
                      return (
                        <div key={cat} className="bg-card border border-border rounded-lg p-4 group-hover:border-accent/30 transition-all">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-foreground font-semibold capitalize">{label} Score</span>
                                <span className="text-xl font-bold text-accent">{score}</span>
                            </div>
                        </div>
                      );
                  })}
               </div>
               <div className="space-y-4">
                  {['systems'].map(cat => {
                      const score = Math.round((checklistData.averages.find(a => a.category === cat)?.averageScore || 0) * 5);
                      return (
                        <div key={cat} className="bg-card border border-border rounded-lg p-4 group-hover:border-accent/30 transition-all">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-foreground font-semibold capitalize">{cat} Score</span>
                                <span className="text-xl font-bold text-accent">{score}</span>
                            </div>
                        </div>
                      );
                  })}
                  <div className="bg-accent/5 border border-accent/30 rounded-lg p-4 group-hover:border-accent/40 group-hover:bg-accent/10 transition-all">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-foreground font-bold">Team Average</span>
                            <span className="text-2xl font-bold text-accent">{Math.round(checklistData.overall.overallAverage * 100)}%</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{checklistData.overall.totalItemsChecked}/{checklistData.overall.totalPossibleItems} items completed</div>
                    </div>
                  </div>
               </div>
            </div>
          </div>
      )}

      <div className="mt-8 text-center">
        <p className="text-xs text-muted-foreground">Interactive Strategic Planning Tool by Caliente Construction</p>
      </div>
    </div>
  );
}
