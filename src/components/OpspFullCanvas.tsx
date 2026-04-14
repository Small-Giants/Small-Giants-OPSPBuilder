import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarIcon, 
  TargetIcon, 
  TrendingUpIcon, 
  UsersIcon, 
  StarIcon, 
  AlertCircleIcon,
  ActivityIcon,
  BookOpenIcon,
  RocketIcon,
  ShieldIcon,
  CheckCircleIcon,
  HeartIcon
} from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, collection, onSnapshot, query, where } from "firebase/firestore";
import { LEGACY_PLAN_YEAR, usePlanYear } from "@/contexts/PlanYearContext";

interface OpspFullCanvasProps {
  data?: any;
}

interface FoundationData {
  corePurpose?: string;
  mission?: string;
  coreValues?: Array<{ id: string; name: string; description?: string }>;
  strategicAnchors?: Array<{ id: string; text: string }>;
  coreCustomer?: string;
  brandPromise?: string;
  corePurposeTitle?: string;
  missionTitle?: string;
  brandPromiseTitle?: string;
  coreCustomerTitle?: string;
  coreValuesTitle?: string;
  strategicAnchorsTitle?: string;
}

export default function OpspFullCanvas({ data }: OpspFullCanvasProps) {
  const { selectedYear, companyId } = usePlanYear();
  
  const [foundationData, setFoundationData] = useState<FoundationData | null>(null);
  const [roadmapData, setRoadmapData] = useState<any>(null);
  const [rocks, setRocks] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Foundation (core purpose, mission, values, etc.)
    const unsubFoundation = onSnapshot(
      doc(db, 'companies', companyId, 'roadmap', 'foundation'),
      (docSnap) => {
        if (docSnap.exists()) {
          setFoundationData(docSnap.data() as FoundationData);
        } else {
          setFoundationData(null);
        }
      },
      (error) => {
        setFoundationData(null);
      }
    );

    // 2. Roadmap main (BHAG, 3-year targets, etc.)
    const unsubRoadmap = onSnapshot(
      doc(db, 'companies', companyId, 'roadmap', 'main'),
      (docSnap) => {
        if (docSnap.exists()) {
          setRoadmapData(docSnap.data());
        }
        setLoading(false);
      }
    );

    // 3. Rocks
    const rocksQuery = query(
      collection(db, 'companies', companyId, 'rocks'),
      where('year', '==', selectedYear)
    );
    const unsubRocks = onSnapshot(rocksQuery, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      setRocks(items);
    });

    // 4. Priorities (to map rocks)
    const unsubPriorities = onSnapshot(collection(db, 'companies', companyId, 'priorities'), (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      const filtered = items
        .filter((p) => {
          const planYear = typeof p.planYear === "number" ? p.planYear : LEGACY_PLAN_YEAR;
          return planYear === selectedYear;
        })
        .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      setPriorities(filtered);
    });

    return () => {
      unsubFoundation();
      unsubRoadmap();
      unsubRocks();
      unsubPriorities();
    };
  }, [selectedYear, companyId]);

  // Group rocks by quarter and filter by priority type
  const quarterlyRocks: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', Array<{ id: string; text: string; assignee: string; priorityTitle: string }>> = {
    Q1: [],
    Q2: [],
    Q3: [],
    Q4: []
  };

  rocks.forEach(rock => {
      const priority = priorities.find(p => p.id === rock.priorityId);
      const quarter = rock.quarter as 'Q1' | 'Q2' | 'Q3' | 'Q4';
      
      if (priority && priority.type === 'priority' && quarterlyRocks[quarter]) {
          quarterlyRocks[quarter].push({
              id: rock.id,
              text: rock.text,
              assignee: rock.assigneeName || 'Unassigned',
              priorityTitle: priority.title || 'Unknown'
          });
      }
  });

  const roadmap = roadmapData || {};
  const foundation = foundationData || {};
  
  // Map fetched data to display structure
  // Foundation data comes from roadmap/foundation document
  // Roadmap data (BHAG, targets) comes from roadmap/main document
  const displayData = {
    companyName: roadmap.companyName || "Caliente Construction",
    planYear: String(selectedYear),
    bhag: {
      years: "10-30",
      description: roadmap.bhag || ""
    },
    // Foundation data - from roadmap/foundation
    coreValues: (foundation.coreValues || []).map((cv: any) => cv.name),
    corePurpose: foundation.corePurpose || "",
    mission: foundation.mission || "",
    brandPromise: foundation.brandPromise || "",
    coreCustomer: foundation.coreCustomer || "",
    strategicAnchors: foundation.strategicAnchors || [],
    // Titles from foundation
    corePurposeTitle: foundation.corePurposeTitle || "Core Purpose",
    missionTitle: foundation.missionTitle || "Mission",
    brandPromiseTitle: foundation.brandPromiseTitle || "Brand Promise",
    coreCustomerTitle: foundation.coreCustomerTitle || "Core Customer",
    coreValuesTitle: foundation.coreValuesTitle || "Culture Drivers",
    strategicAnchorsTitle: foundation.strategicAnchorsTitle || "Strategic Anchors",
    // Note: brandPromises list not in schema, using placeholder if not found
    brandPromises: [
      "24/7 Support Guarantee",
      "99.9% Uptime SLA",
      "30-Day Money Back"
    ],
    xFactor: roadmap.xFactor || "",
    targets3to5: {
      revenue: "$50M ARR",
      profit: "20% EBITDA",
      cashDays: "45 days",
      other: "500+ Enterprise Customers"
    },
    targets1Year: {
      revenue: "$15M ARR",
      profit: "10% EBITDA", 
      cashDays: "60 days",
      other: "150 Enterprise Customers"
    },
    quarterlyTheme: {
      name: "Operation Scale",
      criticalNumbers: [
        { name: "Customer Acquisition", target: "50 new", actual: "42" },
        { name: "Churn Rate", target: "<2%", actual: "1.8%" },
        { name: "NPS Score", target: ">70", actual: "68" }
      ],
      // Rocks are mapped below in render
    },
    coreProcesses: [
      { name: "Sales Process", documented: true, followed: 85 },
      { name: "Onboarding", documented: true, followed: 92 },
      { name: "Product Development", documented: false, followed: 70 },
      { name: "Customer Success", documented: true, followed: 88 }
    ],
    accountabilityChart: [
      { role: "CEO", name: "Jane Smith", kpi: "Revenue Growth" },
      { role: "CTO", name: "Bob Johnson", kpi: "Product Delivery" },
      { role: "CFO", name: "Alice Chen", kpi: "Cash Flow" },
      { role: "VP Sales", name: "Tom Wilson", kpi: "New ARR" }
    ],
    swot: {
      strengths: ["Strong tech team", "Patent portfolio", "Customer loyalty"],
      weaknesses: ["Limited marketing", "Geographic concentration"],
      opportunities: ["AI market growth", "Partnership potential"],
      threats: ["New competitors", "Economic uncertainty"]
    },
    ler: {
      grossProfit: 500000,
      laborCost: 200000,
      ratio: 2.5
    },
    powerOfOne: {
      price: { current: 100, impact1pct: 10000 },
      volume: { current: 1000, impact1pct: 10000 },
      cogs: { current: 60, impact1pct: -6000 },
      overhead: { current: 300000, impact1pct: -3000 }
    },
    sevenAttributes: [
      { name: "Leadership Team", score: 4 },
      { name: "Scalable Model", score: 3 },
      { name: "Market Dynamics", score: 5 },
      { name: "X-Factor/Moat", score: 4 },
      { name: "Financial Performance", score: 3 },
      { name: "Customer Validation", score: 4 },
      { name: "Systems & Processes", score: 2 }
    ],
    fiveDysfunctions: [
      { name: "Trust", score: 7 },
      { name: "Conflict", score: 6 },
      { name: "Commitment", score: 8 },
      { name: "Accountability", score: 6 },
      { name: "Results", score: 7 }
    ]
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'on-track': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'at-risk': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getScoreColor = (score: number, max: number = 5) => {
    const percent = (score / max) * 100;
    if (percent >= 80) return 'bg-emerald-500';
    if (percent >= 60) return 'bg-blue-500';
    if (percent >= 40) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="w-full space-y-6 p-6 bg-background">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          One-Page Strategic Plan (OPSP)
        </h1>
        <div className="flex items-center justify-center gap-4">
          <Badge variant="secondary">
            {displayData.companyName}
          </Badge>
          <Badge variant="outline">
            {displayData.planYear} Plan
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <RocketIcon className="w-5 h-5" />
              {displayData.corePurposeTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayData.corePurpose ? (
              <p className="text-sm text-foreground">{displayData.corePurpose}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Not yet defined. Add in Foundation.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <TargetIcon className="w-5 h-5" />
              {displayData.missionTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayData.mission ? (
              <p className="text-sm text-foreground">{displayData.mission}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Not yet defined. Add in Foundation.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <ShieldIcon className="w-5 h-5" />
              {displayData.brandPromiseTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayData.brandPromise ? (
              <p className="text-sm text-foreground">{displayData.brandPromise}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Not yet defined. Add in Foundation.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <HeartIcon className="w-5 h-5" />
              {displayData.coreValuesTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayData.coreValues.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {displayData.coreValues.map((value: string, idx: number) => (
                  <Badge key={idx} variant="secondary">
                    {value}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No culture drivers yet. Add in Foundation.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <TargetIcon className="w-5 h-5" />
              {displayData.strategicAnchorsTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayData.strategicAnchors.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {displayData.strategicAnchors.map((anchor: { id: string; text: string }) => (
                  <Badge key={anchor.id} variant="outline">
                    {anchor.text}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No strategic anchors yet. Add in Foundation.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <RocketIcon className="w-5 h-5" />
              BHAG ({displayData.bhag.years} Years)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayData.bhag.description ? (
              <p className="text-sm text-foreground">{displayData.bhag.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Not yet defined. Add in 3-Year page.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-sm">Brand Promises</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {displayData.brandPromises.map((promise, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-primary mt-0.5" />
                  <span className="text-xs text-foreground">{promise}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-sm">X-Factor</CardTitle>
          </CardHeader>
          <CardContent>
            {displayData.xFactor ? (
              <p className="text-xs text-foreground">{displayData.xFactor}</p>
            ) : (
              <p className="text-xs text-muted-foreground italic">Not yet defined.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-sm">{displayData.coreCustomerTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            {displayData.coreCustomer ? (
              <p className="text-xs text-foreground">{displayData.coreCustomer}</p>
            ) : (
              <p className="text-xs text-muted-foreground italic">Not yet defined. Add in Foundation.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <TargetIcon className="w-5 h-5" />
              3-5 Year Targets
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {Object.entries(displayData.targets3to5).map(([key, value]) => (
                <div key={key}>
                    <p className="text-xs text-muted-foreground capitalize">{key}</p>
                    <p className="text-sm font-semibold text-foreground">{value}</p>
                </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              1 Year Goals
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {Object.entries(displayData.targets1Year).map(([key, value]) => (
                <div key={key}>
                    <p className="text-xs text-muted-foreground capitalize">{key}</p>
                    <p className="text-sm font-semibold text-foreground">{value}</p>
                </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">
            Quarterly Theme: {displayData.quarterlyTheme.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Critical Numbers</h4>
              <div className="space-y-2">
                {displayData.quarterlyTheme.criticalNumbers.map((metric, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-xs text-foreground">{metric.name}</span>
                    <div className="flex gap-2">
                      <span className="text-xs text-muted-foreground">Target: {metric.target}</span>
                      <span className="text-xs text-muted-foreground">|</span>
                      <span className="text-xs text-emerald-600">Actual: {metric.actual}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Quarterly Tactics</h4>
              <div className="space-y-2">
                {Object.values(quarterlyRocks).flat().length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No priority tactics defined</p>
                ) : (
                  Object.values(quarterlyRocks).flat().slice(0, 5).map((rock: any) => (
                    <div key={rock.id} className="flex justify-between items-center p-2 bg-muted rounded">
                      <div className="flex-1">
                        <p className="text-xs text-foreground">{rock.text}</p>
                        <p className="text-xs text-muted-foreground">Owner: {rock.assignee}</p>
                      </div>
                      <Badge variant="secondary">
                        Strategic Objective
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-sm">Core Processes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {displayData.coreProcesses.map((process, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                <span className="text-xs text-foreground">{process.name}</span>
                <div className="flex items-center gap-3">
                  <Badge className={process.documented ? 
                    "bg-emerald-100 text-emerald-700 border-emerald-200" : 
                    "bg-rose-100 text-rose-700 border-rose-200"
                  }>
                    {process.documented ? "Documented" : "Not Documented"}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{process.followed}%</span>
                    <div className="w-20 h-2 bg-muted-foreground/20 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${getScoreColor(process.followed, 100)}`}
                        style={{ width: `${process.followed}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-sm">Accountability Chart</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {displayData.accountabilityChart.map((person, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                <div>
                  <p className="text-xs font-semibold text-foreground">{person.role}</p>
                  <p className="text-xs text-muted-foreground">{person.name}</p>
                </div>
                <Badge variant="outline">
                  {person.kpi}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground text-sm">SWOT Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <h5 className="text-xs font-semibold text-emerald-600 mb-2">Strengths</h5>
              <ul className="space-y-1">
                {displayData.swot.strengths.map((item, idx) => (
                  <li key={idx} className="text-xs text-foreground">• {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h5 className="text-xs font-semibold text-rose-600 mb-2">Weaknesses</h5>
              <ul className="space-y-1">
                {displayData.swot.weaknesses.map((item, idx) => (
                  <li key={idx} className="text-xs text-foreground">• {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h5 className="text-xs font-semibold text-blue-600 mb-2">Opportunities</h5>
              <ul className="space-y-1">
                {displayData.swot.opportunities.map((item, idx) => (
                  <li key={idx} className="text-xs text-foreground">• {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h5 className="text-xs font-semibold text-amber-600 mb-2">Threats</h5>
              <ul className="space-y-1">
                {displayData.swot.threats.map((item, idx) => (
                  <li key={idx} className="text-xs text-foreground">• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <ActivityIcon className="w-4 h-4" />
              Labor Efficiency Ratio (LER)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Gross Profit</p>
                <p className="text-lg font-bold text-foreground">${(displayData.ler.grossProfit/1000).toFixed(0)}K</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Labor Cost</p>
                <p className="text-lg font-bold text-foreground">${(displayData.ler.laborCost/1000).toFixed(0)}K</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">LER</p>
                <p className={`text-lg font-bold ${
                  displayData.ler.ratio >= 3 ? 'text-emerald-600' :
                  displayData.ler.ratio >= 2 ? 'text-amber-600' : 'text-rose-600'
                }`}>{displayData.ler.ratio}x</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-sm">Power of One (1% Impact)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(displayData.powerOfOne).map(([key, value]: [string, any]) => (
                <div key={key} className="flex justify-between p-1 bg-muted rounded">
                  <span className="text-xs text-foreground capitalize">{key}</span>
                  <span className={`text-xs font-semibold ${
                    value.impact1pct > 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    ${Math.abs(value.impact1pct / 1000).toFixed(0)}K
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-sm">7 Attributes of Agile Growth®</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {displayData.sevenAttributes.map((attr: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-xs text-foreground">{attr.name}</span>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(i => (
                      <div 
                        key={i} 
                        className={`w-2 h-2 rounded-full ${
                          i <= attr.score ? getScoreColor(attr.score) : 'bg-muted-foreground/20'
                        }`} 
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{attr.score}/5</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-sm">5 Dysfunctions of a Team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {displayData.fiveDysfunctions.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-xs text-foreground">{item.name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-muted-foreground/20 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${getScoreColor(item.score, 10)}`}
                      style={{ width: `${item.score * 10}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{item.score}/10</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg border border-border">
        <p className="text-xs text-muted-foreground text-center">
          One-Page Strategic Plan (OPSP) - 7 Attributes of Agile Growth® Framework
        </p>
        <p className="text-xs text-muted-foreground/60 text-center mt-1">
          This is a comprehensive rollup view of all strategic planning components
        </p>
      </div>
    </div>
  );
}
