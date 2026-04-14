"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { LEGACY_PLAN_YEAR, usePlanYear } from "@/contexts/PlanYearContext";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleIcon,
  ClipboardListIcon,
  TargetIcon,
  TrendingUpIcon,
  InfoIcon,
  UsersIcon,
  CalendarIcon,
  SparklesIcon,
  ZapIcon,
  BarChart3Icon,
  FlagIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type FoundationData = {
  corePurpose?: string;
  mission?: string;
  coreValues?: Array<{ id: string; name: string; description?: string }>;
  strategicAnchors?: Array<{ id: string; text: string }>;
  coreCustomer?: string;
  brandPromise?: string;
};

type RoadmapMainData = {
  bhag?: string;
  threeHagStatement?: string;
  knownFor?: string;
};

type OneYearDocData = {
  onePhraseStrategy?: string;
  oneYearGoal?: any;
  criticalNumbers?: Record<string, { label?: string; value?: string }>;
};

type Priority = {
  id: string;
  title?: string;
  description?: string;
  ownerName?: string;
  dueDate?: string;
};

type Rock = {
  id: string;
  text?: string;
  quarter?: string;
  status?: "not_started" | "ready" | "in_progress" | "complete";
  year?: number | null;
  priority?: boolean;
};

type Metric = {
  id: string;
  name?: string;
  unit?: string;
  currentValue?: number;
  targetValue?: number;
  trend?: "up" | "down" | "stable";
  data?: Array<{ date: string; value: number }>;
  createdAt?: string;
  updatedAt?: string;
};

function isFilled(v: unknown) {
  return typeof v === "string" ? v.trim().length > 0 : Boolean(v);
}

function currentQuarterForYear(year: number): "Q1" | "Q2" | "Q3" | "Q4" {
  const now = new Date();
  const inSelectedYear = now.getFullYear() === year;
  const month = inSelectedYear ? now.getMonth() : 0;
  if (month <= 2) return "Q1";
  if (month <= 5) return "Q2";
  if (month <= 8) return "Q3";
  return "Q4";
}

function getStepStatus(done: boolean) {
  return done ? "done" : "todo";
}

export default function ExecutiveSummary({
  onNavigate,
}: {
  onNavigate: (itemId: string) => void;
}) {
  const { toast } = useToast();
  const { companyId, selectedYear } = usePlanYear();

  const [foundation, setFoundation] = useState<FoundationData | null>(null);
  const [roadmapMain, setRoadmapMain] = useState<RoadmapMainData | null>(null);
  const [oneYear, setOneYear] = useState<OneYearDocData | null>(null);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [rocks, setRocks] = useState<Rock[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);

  useEffect(() => {
    let unsubFoundation: Unsubscribe | undefined;
    let unsubMain: Unsubscribe | undefined;
    let unsubOneYear: Unsubscribe | undefined;
    let unsubOneYearLegacy: Unsubscribe | undefined;
    let unsubPrioritiesYear: Unsubscribe | undefined;
    let unsubPrioritiesLegacy: Unsubscribe | undefined;
    let unsubRocksYear: Unsubscribe | undefined;
    let unsubRocksLegacy: Unsubscribe | undefined;
    let unsubMetricsYear: Unsubscribe | undefined;
    let unsubMetricsLegacy: Unsubscribe | undefined;

    // Foundation
    unsubFoundation = onSnapshot(
      doc(db, "companies", companyId, "roadmap", "foundation"),
      (snap) => setFoundation(snap.exists() ? (snap.data() as any) : null),
      (err) => {
        setFoundation(null);
      }
    );

    // 3-year (stored in roadmap/main)
    unsubMain = onSnapshot(
      doc(db, "companies", companyId, "roadmap", "main"),
      (snap) => setRoadmapMain(snap.exists() ? (snap.data() as any) : null),
      (err) => {
        setRoadmapMain(null);
      }
    );

    // 1-year (year-scoped with legacy fallback)
    const oneYearRef = doc(db, "companies", companyId, "roadmap", `one-year-${selectedYear}`);
    const legacyMainRef = doc(db, "companies", companyId, "roadmap", "main");
    let shouldUseLegacy = false;

    const applyOneYear = (data: any) => {
      setOneYear({
        onePhraseStrategy: data?.onePhraseStrategy || "",
        oneYearGoal: data?.oneYearGoal,
        criticalNumbers: data?.criticalNumbers || {},
      });
    };

    unsubOneYear = onSnapshot(
      oneYearRef,
      (snap) => {
        if (snap.exists()) {
          shouldUseLegacy = false;
          applyOneYear(snap.data());
        } else {
          shouldUseLegacy = selectedYear === LEGACY_PLAN_YEAR;
          if (!shouldUseLegacy) setOneYear(null);
        }
      },
      (err) => {
        shouldUseLegacy = selectedYear === LEGACY_PLAN_YEAR;
        if (!shouldUseLegacy) setOneYear(null);
      }
    );

    if (selectedYear === LEGACY_PLAN_YEAR) {
      unsubOneYearLegacy = onSnapshot(
        legacyMainRef,
        (snap) => {
          if (!shouldUseLegacy) return;
          if (snap.exists()) applyOneYear(snap.data());
        },
        () => {
          // ignore
        }
      );
    }

    // Priorities (year + legacy for 2025)
    const prioritiesById = new Map<string, Priority>();
    const applyPriorities = () => {
      const sorted = Array.from(prioritiesById.values())
        .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      setPriorities(sorted);
    };
    const prioritiesCol = collection(db, "companies", companyId, "priorities");
    const qPrioritiesYear = query(
      prioritiesCol,
      where("type", "==", "priority"),
      where("planYear", "==", selectedYear)
    );

    unsubPrioritiesYear = onSnapshot(qPrioritiesYear, (snap) => {
      prioritiesById.clear();
      snap.forEach((d) => prioritiesById.set(d.id, { id: d.id, ...(d.data() as any) }));
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
        (snap) => {
          snap.forEach((d) => {
            if (!prioritiesById.has(d.id)) prioritiesById.set(d.id, { id: d.id, ...(d.data() as any) });
          });
          applyPriorities();
        },
        () => {
          // ignore
        }
      );
    }

    // Rocks (year + legacy for 2025)
    const rocksById = new Map<string, Rock>();
    const applyRocks = () => setRocks(Array.from(rocksById.values()));
    const rocksCol = collection(db, "companies", companyId, "rocks");
    const qRocksYear = query(rocksCol, where("year", "==", selectedYear));

    unsubRocksYear = onSnapshot(qRocksYear, (snap) => {
      rocksById.clear();
      snap.forEach((d) => rocksById.set(d.id, { id: d.id, ...(d.data() as any) }));
      applyRocks();
    });

    if (selectedYear === LEGACY_PLAN_YEAR) {
      const qRocksLegacy = query(rocksCol, where("year", "==", null));
      unsubRocksLegacy = onSnapshot(
        qRocksLegacy,
        (snap) => {
          snap.forEach((d) => {
            if (!rocksById.has(d.id)) rocksById.set(d.id, { id: d.id, ...(d.data() as any) });
          });
          applyRocks();
        },
        () => {
          // ignore
        }
      );
    }

    // Metrics (year + legacy for 2025)
    const metricsById = new Map<string, Metric>();
    const applyMetrics = () => setMetrics(Array.from(metricsById.values()));
    const metricsCol = collection(db, "companies", companyId, "metrics");
    const qMetricsYear = query(metricsCol, where("planYear", "==", selectedYear));

    unsubMetricsYear = onSnapshot(qMetricsYear, (snap) => {
      metricsById.clear();
      snap.forEach((d) => metricsById.set(d.id, { id: d.id, ...(d.data() as any) }));
      applyMetrics();
    });

    if (selectedYear === LEGACY_PLAN_YEAR) {
      const qMetricsLegacy = query(metricsCol, where("planYear", "==", null));
      unsubMetricsLegacy = onSnapshot(
        qMetricsLegacy,
        (snap) => {
          snap.forEach((d) => {
            if (!metricsById.has(d.id)) metricsById.set(d.id, { id: d.id, ...(d.data() as any) });
          });
          applyMetrics();
        },
        () => {
          // ignore
        }
      );
    }

    return () => {
      unsubFoundation?.();
      unsubMain?.();
      unsubOneYear?.();
      unsubOneYearLegacy?.();
      unsubPrioritiesYear?.();
      unsubPrioritiesLegacy?.();
      unsubRocksYear?.();
      unsubRocksLegacy?.();
      unsubMetricsYear?.();
      unsubMetricsLegacy?.();
    };
  }, [companyId, selectedYear]);

  const currentQuarter = useMemo(() => currentQuarterForYear(selectedYear), [selectedYear]);
  const quarterRocks = useMemo(
    () => rocks.filter((r) => (r.quarter || "Q1") === currentQuarter),
    [rocks, currentQuarter]
  );
  const quarterComplete = useMemo(
    () => quarterRocks.filter((r) => r.status === "complete").length,
    [quarterRocks]
  );
  const quarterProgress = useMemo(() => {
    if (quarterRocks.length === 0) return 0;
    return Math.round((quarterComplete / quarterRocks.length) * 100);
  }, [quarterRocks.length, quarterComplete]);

  const exec = useMemo(() => {
    const coreCustomer = foundation?.coreCustomer || "";
    const brandPromise = foundation?.brandPromise || "";
    const onePhraseStrategy = oneYear?.onePhraseStrategy || "";
    const bhag = (roadmapMain?.bhag || "") as string;

    return {
      coreCustomer,
      brandPromise,
      onePhraseStrategy,
      bhag,
      prioritiesTop: priorities.slice(0, 5),
      kpiCount: metrics.length,
    };
  }, [foundation, oneYear, roadmapMain, priorities, metrics.length]);

  const completion = useMemo(() => {
    const foundationDone =
      isFilled(foundation?.corePurpose) &&
      isFilled(foundation?.mission) &&
      isFilled(foundation?.coreCustomer) &&
      isFilled(foundation?.brandPromise) &&
      (foundation?.coreValues?.length || 0) > 0;

    const strategyDone = isFilled(oneYear?.onePhraseStrategy) && isFilled(roadmapMain?.bhag);

    const targetsDone = (() => {
      const goals = oneYear?.oneYearGoal;
      const hasSomeGoal =
        goals && typeof goals === "object" && Object.values(goals).some((g: any) => isFilled(g?.value));
      const hasSomeCritical =
        oneYear?.criticalNumbers && Object.values(oneYear.criticalNumbers).some((c) => isFilled(c?.value));
      return Boolean(hasSomeGoal || hasSomeCritical);
    })();

    const annualPlanPct = Math.round(
      ((Number(foundationDone) + Number(strategyDone) + Number(targetsDone)) / 3) * 100
    );

    const quarterlyDone = quarterRocks.length > 0;
    const weeklyDone = metrics.length > 0;

    const stepAnnual = { done: annualPlanPct >= 67, pct: annualPlanPct };
    const stepQuarter = { done: quarterlyDone, pct: quarterlyDone ? 100 : 0 };
    const stepWeekly = { done: weeklyDone, pct: weeklyDone ? 100 : 0 };

    return { stepAnnual, stepQuarter, stepWeekly };
  }, [foundation, oneYear, roadmapMain, quarterRocks.length, metrics.length]);

  const copySummary = async () => {
    const lines = [
      `Executive Summary (${selectedYear})`,
      "",
      `BHAG: ${exec.bhag || "-"}`,
      `One Phrase Strategy: ${exec.onePhraseStrategy || "-"}`,
      `Core Customer: ${exec.coreCustomer || "-"}`,
      `Brand Promise: ${exec.brandPromise || "-"}`,
      "",
      `Annual Priorities (${exec.prioritiesTop.length} shown):`,
      ...exec.prioritiesTop.map((p, idx) => `${idx + 1}. ${p.title || "-"}`),
      "",
      `This Quarter (${currentQuarter}) rocks: ${quarterRocks.length} total, ${quarterComplete} complete (${quarterProgress}%)`,
      `KPIs: ${exec.kpiCount}`,
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast({ title: "Copied", description: "Executive summary copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Couldn't copy to clipboard.", variant: "destructive" });
    }
  };

  const Step = ({
    title,
    description,
    status,
    percent,
    ctaLabel,
    onClick,
  }: {
    title: string;
    description: string;
    status: "done" | "todo";
    percent: number;
    ctaLabel: string;
    onClick: () => void;
  }) => (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {status === "done" ? (
              <CheckCircle2Icon className="h-4 w-4 text-green-600" />
            ) : (
              <CircleIcon className="h-4 w-4 text-muted-foreground" />
            )}
            <div className="font-medium text-foreground">{title}</div>
            <Badge
              variant="secondary"
              className={cn(
                "text-[11px]",
                status === "done" && "bg-green-500/10 text-green-700 dark:text-green-400"
              )}
            >
              {status === "done" ? "Complete" : "Incomplete"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onClick}>
          {ctaLabel}
          <ArrowRightIcon className="h-4 w-4 ml-2" />
        </Button>
      </div>
      <Progress value={Math.max(0, Math.min(100, percent))} />
    </div>
  );

  // Get critical number for display
  const criticalNumber = useMemo(() => {
    if (!oneYear?.criticalNumbers) return null;
    const cn = oneYear.criticalNumbers;
    // Find the first non-empty critical number
    for (const [key, val] of Object.entries(cn)) {
      if (val?.value) return { label: val.label || key, value: val.value };
    }
    return null;
  }, [oneYear]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-brand-burgundy-crimson p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 opacity-10">
          <SparklesIcon className="w-full h-full" />
        </div>
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge className="bg-white/20 text-white border-white/30 mb-3">{selectedYear} Strategic Plan</Badge>
              <h2 className="text-2xl font-bold">Executive Summary</h2>
              <p className="text-white/80 mt-1">
                Your 60-second view of strategy, execution, and scoreboard
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={copySummary} className="bg-white/20 text-white hover:bg-white/30 border-white/30">
                <ClipboardListIcon className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button onClick={() => onNavigate("canvas")} className="bg-white text-primary hover:bg-white/90">
                <TargetIcon className="h-4 w-4 mr-2" />
                Open Canvas
              </Button>
            </div>
          </div>
          
          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-xs text-white/70 mb-1">Annual Priorities</div>
              <div className="text-2xl font-bold">{priorities.length}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-xs text-white/70 mb-1">{currentQuarter} Rocks</div>
              <div className="text-2xl font-bold">{quarterRocks.length}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-xs text-white/70 mb-1">KPIs Tracked</div>
              <div className="text-2xl font-bold">{metrics.length}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-xs text-white/70 mb-1">Quarter Progress</div>
              <div className="text-2xl font-bold">{quarterProgress}%</div>
            </div>
          </div>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-3">
            <span>Start here</span>
            <Badge variant="outline">{selectedYear} Plan</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Step
            title="Build Annual Plan"
            description="Foundation → 3-Year direction → 1-Year strategy & targets."
            status={getStepStatus(completion.stepAnnual.done)}
            percent={completion.stepAnnual.pct}
            ctaLabel="Go to plan"
            onClick={() => onNavigate("foundation")}
          />
          <Separator />
          <Step
            title="Set Quarterly Plan"
            description={`Add rocks for ${currentQuarter} and assign owners.`}
            status={getStepStatus(completion.stepQuarter.done)}
            percent={completion.stepQuarter.pct}
            ctaLabel="Go to 1-Year"
            onClick={() => onNavigate("one-year")}
          />
          <Separator />
          <Step
            title="Run Weekly Cadence"
            description="Keep KPIs up to date and review progress weekly."
            status={getStepStatus(completion.stepWeekly.done)}
            percent={completion.stepWeekly.pct}
            ctaLabel="Go to KPIs"
            onClick={() => onNavigate("metrics")}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span>Annual plan highlights</span>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("one-year")}>
                Edit
                <ArrowRightIcon className="h-4 w-4 ml-2" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  BHAG
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InfoIcon className="h-3 w-3 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-medium">Big Hairy Audacious Goal</p>
                      <p className="text-xs mt-1">A long-term goal (10-25 years) that is ambitious, exciting, and almost seems impossible but is achievable with focused effort.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className={cn("mt-1 text-sm text-foreground", !exec.bhag && "italic text-muted-foreground")}>
                  {exec.bhag || "Add your BHAG (3-Year page)"}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  One Phrase Strategy
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InfoIcon className="h-3 w-3 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-medium">Your Strategic Differentiator</p>
                      <p className="text-xs mt-1">A single phrase that captures how you uniquely serve your core customer better than anyone else.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div
                  className={cn(
                    "mt-1 text-sm text-foreground",
                    !exec.onePhraseStrategy && "italic text-muted-foreground"
                  )}
                >
                  {exec.onePhraseStrategy || "Add your One Phrase Strategy (1-Year page)"}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  Core Customer
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InfoIcon className="h-3 w-3 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-medium">Your Ideal Customer</p>
                      <p className="text-xs mt-1">The specific type of customer who gets the most value from your offering and whom you can serve profitably.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div
                  className={cn(
                    "mt-1 text-sm text-foreground",
                    !exec.coreCustomer && "italic text-muted-foreground"
                  )}
                >
                  {exec.coreCustomer || "Define your core customer (Foundation)"}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  Brand Promise
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InfoIcon className="h-3 w-3 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-medium">Your Guarantee to Customers</p>
                      <p className="text-xs mt-1">The measurable commitment you make to every customer about their experience with your company.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div
                  className={cn(
                    "mt-1 text-sm text-foreground",
                    !exec.brandPromise && "italic text-muted-foreground"
                  )}
                >
                  {exec.brandPromise || "Define your brand promise (Foundation)"}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium text-foreground">Top annual priorities</div>
                <Badge variant="secondary">{priorities.length}</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {exec.prioritiesTop.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic">
                    No annual priorities yet. Add them in Priority Management.
                  </div>
                ) : (
                  exec.prioritiesTop.map((p, idx) => (
                    <div key={p.id} className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-0.5">
                        {idx + 1}
                      </Badge>
                      <div className="min-w-0">
                        <div className="text-sm text-foreground">{p.title || "-"}</div>
                        {p.description && (
                          <div className="text-xs text-muted-foreground line-clamp-2">{p.description}</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onNavigate("priority-management")}>
                  Manage priorities
                  <ArrowRightIcon className="h-4 w-4 ml-2" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onNavigate("one-year")}>
                  Link to rocks
                  <ArrowRightIcon className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span>This quarter</span>
              <Badge variant="outline">{currentQuarter}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Critical Number Highlight */}
            {criticalNumber && (
              <div className="rounded-lg bg-gradient-brand-crimson-warm p-4 text-white">
                <div className="flex items-center gap-2 text-xs text-white/80 mb-1">
                  <ZapIcon className="h-3 w-3" />
                  Critical Number
                </div>
                <div className="text-2xl font-bold">{criticalNumber.value}</div>
                <div className="text-sm text-white/80">{criticalNumber.label}</div>
              </div>
            )}
            
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-foreground">Rocks status</div>
                <Badge variant="secondary">{quarterRocks.length}</Badge>
              </div>
              <div className="mt-2">
                <Progress value={quarterProgress} />
                <div className="mt-2 text-xs text-muted-foreground">
                  {quarterComplete} complete • {quarterProgress}%
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {quarterRocks.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex items-start gap-2">
                    <div
                      className={cn(
                        "mt-1 h-2 w-2 rounded-full",
                        r.status === "complete" ? "bg-green-500" : "bg-muted-foreground/40"
                      )}
                    />
                    <div
                      className={cn(
                        "text-xs text-foreground line-clamp-2",
                        r.status === "complete" && "opacity-70 line-through"
                      )}
                    >
                      {r.text || "-"}
                    </div>
                  </div>
                ))}
                {quarterRocks.length === 0 && (
                  <div className="text-xs text-muted-foreground italic">
                    No rocks yet for {currentQuarter}. Add rocks under your priorities/capabilities.
                  </div>
                )}
              </div>
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={() => onNavigate("rocks")} className="w-full">
                  View rocks
                  <ArrowRightIcon className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-foreground flex items-center gap-2">
                  <BarChart3Icon className="h-4 w-4" />
                  Scoreboard (KPIs)
                </div>
                <Badge variant="secondary">{metrics.length}</Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Keep KPIs current so weekly meetings are fast and focused.
              </div>
              <div className="mt-3">
                <Button size="sm" className="w-full" onClick={() => onNavigate("metrics")}>
                  Open KPI dashboard
                  <ArrowRightIcon className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Meeting Quick Action */}
      <Card className="bg-gradient-brand-burgundy-crimson text-white border-0">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-white/20 p-3">
                <UsersIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Run Your Weekly Meeting</h3>
                <p className="text-white/80 text-sm">
                  Review scoreboard, discuss rocks, capture issues, and assign action items.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => onNavigate("weekly-meeting")}
              className="bg-white text-primary hover:bg-white/90"
            >
              <CalendarIcon className="h-4 w-4 mr-2" />
              Start Meeting
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


