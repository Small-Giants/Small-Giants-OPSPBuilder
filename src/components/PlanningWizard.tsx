"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, where, type Unsubscribe } from "firebase/firestore";
import { usePlanYear, LEGACY_PLAN_YEAR } from "@/contexts/PlanYearContext";
import {
  CheckCircle2Icon,
  CircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  BuildingIcon,
  CalendarIcon,
  TargetIcon,
  TrendingUpIcon,
  RocketIcon,
  FlagIcon,
  BarChart3Icon,
  SparklesIcon,
} from "lucide-react";

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  checkFields: string[];
  navigateTo: string;
  tips: string[];
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: "foundation",
    title: "Foundation",
    description: "Define your core purpose, mission, values, and strategic anchors",
    icon: <BuildingIcon className="h-5 w-5" />,
    checkFields: ["corePurpose", "mission", "coreValues", "brandPromise", "coreCustomer"],
    navigateTo: "foundation",
    tips: [
      "Your core purpose answers 'Why do we exist?'",
      "Core values should guide daily decisions",
      "Brand promise is measurable and specific",
    ],
  },
  {
    id: "three-year",
    title: "3-Year Direction",
    description: "Set your BHAG and 3-year strategic picture",
    icon: <RocketIcon className="h-5 w-5" />,
    checkFields: ["bhag", "threeHagStatement", "knownFor"],
    navigateTo: "three-year",
    tips: [
      "BHAG should be audacious but achievable",
      "Think about what you want to be known for",
      "Consider key differentiators from competitors",
    ],
  },
  {
    id: "one-year-strategy",
    title: "1-Year Strategy",
    description: "Define your one phrase strategy and annual goals",
    icon: <TargetIcon className="h-5 w-5" />,
    checkFields: ["onePhraseStrategy", "oneYearGoal"],
    navigateTo: "one-year",
    tips: [
      "One phrase strategy captures your unique approach",
      "Set measurable targets for revenue, profit, and growth",
      "Identify the critical number that drives success",
    ],
  },
  {
    id: "priorities",
    title: "Annual Priorities",
    description: "Set 3-5 annual priorities that will move the needle",
    icon: <FlagIcon className="h-5 w-5" />,
    checkFields: ["priorities"],
    navigateTo: "priority-management",
    tips: [
      "Focus on 3-5 priorities maximum",
      "Each priority should have clear success criteria",
      "Assign an executive champion to each",
    ],
  },
  {
    id: "quarterly",
    title: "Quarterly Rocks",
    description: "Break down priorities into quarterly rocks with owners",
    icon: <CalendarIcon className="h-5 w-5" />,
    checkFields: ["rocks"],
    navigateTo: "one-year",
    tips: [
      "Rocks are 90-day deliverables",
      "Each rock needs a clear owner",
      "Link rocks to annual priorities",
    ],
  },
  {
    id: "kpis",
    title: "Scoreboard",
    description: "Set up KPIs to track weekly progress",
    icon: <BarChart3Icon className="h-5 w-5" />,
    checkFields: ["metrics"],
    navigateTo: "metrics",
    tips: [
      "Choose leading indicators not just lagging",
      "Assign an owner to each KPI",
      "Update weekly before meetings",
    ],
  },
];

interface PlanningWizardProps {
  onNavigate: (view: string) => void;
  onClose?: () => void;
}

export default function PlanningWizard({ onNavigate, onClose }: PlanningWizardProps) {
  const { companyId, selectedYear } = usePlanYear();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completionStatus, setCompletionStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // Fetch completion status from various documents
  useEffect(() => {
    const unsubs: Unsubscribe[] = [];

    // Foundation
    unsubs.push(
      onSnapshot(
        doc(db, "companies", companyId, "roadmap", "foundation"),
        (snap) => {
          const data = snap.data() || {};
          const hasCorePurpose = Boolean(data.corePurpose?.trim());
          const hasMission = Boolean(data.mission?.trim());
          const hasCoreValues = Array.isArray(data.coreValues) && data.coreValues.length > 0;
          const hasBrandPromise = Boolean(data.brandPromise?.trim());
          const hasCoreCustomer = Boolean(data.coreCustomer?.trim());
          
          setCompletionStatus((prev) => ({
            ...prev,
            foundation: hasCorePurpose && hasMission && hasCoreValues && hasBrandPromise && hasCoreCustomer,
            foundationPartial: hasCorePurpose || hasMission || hasCoreValues || hasBrandPromise || hasCoreCustomer,
          }));
        }
      )
    );

    // 3-Year (main roadmap)
    unsubs.push(
      onSnapshot(
        doc(db, "companies", companyId, "roadmap", "main"),
        (snap) => {
          const data = snap.data() || {};
          const hasBhag = Boolean(data.bhag?.trim());
          const hasThreeHag = Boolean(data.threeHagStatement?.trim());
          
          setCompletionStatus((prev) => ({
            ...prev,
            "three-year": hasBhag && hasThreeHag,
            "three-yearPartial": hasBhag || hasThreeHag,
          }));
        }
      )
    );

    // 1-Year
    unsubs.push(
      onSnapshot(
        doc(db, "companies", companyId, "roadmap", `one-year-${selectedYear}`),
        (snap) => {
          const data = snap.data() || {};
          const hasStrategy = Boolean(data.onePhraseStrategy?.trim());
          const hasGoals = data.oneYearGoal && typeof data.oneYearGoal === "object";
          
          setCompletionStatus((prev) => ({
            ...prev,
            "one-year-strategy": hasStrategy && hasGoals,
            "one-year-strategyPartial": hasStrategy || hasGoals,
          }));
        }
      )
    );

    // Priorities (year-scoped)
    const prioritiesCol = collection(db, "companies", companyId, "priorities");
    const qPrioritiesYear = query(prioritiesCol, where("planYear", "==", selectedYear), where("type", "==", "priority"));
    unsubs.push(
      onSnapshot(qPrioritiesYear, (snap) => {
        const hasPriorities = snap.size > 0;
        setCompletionStatus((prev) => ({
          ...prev,
          priorities: snap.size >= 3, // At least 3 priorities recommended
          prioritiesPartial: hasPriorities,
        }));
      })
    );

    // Legacy priorities for 2025
    if (selectedYear === LEGACY_PLAN_YEAR) {
      const qPrioritiesLegacy = query(prioritiesCol, where("planYear", "==", null), where("type", "==", "priority"));
      unsubs.push(
        onSnapshot(qPrioritiesLegacy, (snap) => {
          if (snap.size > 0) {
            setCompletionStatus((prev) => ({
              ...prev,
              priorities: prev.priorities || snap.size >= 3,
              prioritiesPartial: prev.prioritiesPartial || snap.size > 0,
            }));
          }
        })
      );
    }

    // Rocks (year-scoped)
    const rocksCol = collection(db, "companies", companyId, "rocks");
    const qRocksYear = query(rocksCol, where("year", "==", selectedYear));
    unsubs.push(
      onSnapshot(qRocksYear, (snap) => {
        const hasRocks = snap.size > 0;
        setCompletionStatus((prev) => ({
          ...prev,
          quarterly: snap.size >= 5, // At least 5 rocks recommended
          quarterlyPartial: hasRocks,
        }));
      })
    );

    // Legacy rocks for 2025
    if (selectedYear === LEGACY_PLAN_YEAR) {
      const qRocksLegacy = query(rocksCol, where("year", "==", null));
      unsubs.push(
        onSnapshot(qRocksLegacy, (snap) => {
          if (snap.size > 0) {
            setCompletionStatus((prev) => ({
              ...prev,
              quarterly: prev.quarterly || snap.size >= 5,
              quarterlyPartial: prev.quarterlyPartial || snap.size > 0,
            }));
          }
        })
      );
    }

    // KPIs (year-scoped)
    const metricsCol = collection(db, "companies", companyId, "metrics");
    const qMetricsYear = query(metricsCol, where("planYear", "==", selectedYear));
    unsubs.push(
      onSnapshot(qMetricsYear, (snap) => {
        setCompletionStatus((prev) => ({
          ...prev,
          kpis: snap.size >= 5, // At least 5 KPIs recommended
          kpisPartial: snap.size > 0,
        }));
        setLoading(false);
      })
    );

    // Legacy metrics for 2025
    if (selectedYear === LEGACY_PLAN_YEAR) {
      const qMetricsLegacy = query(metricsCol, where("planYear", "==", null));
      unsubs.push(
        onSnapshot(qMetricsLegacy, (snap) => {
          if (snap.size > 0) {
            setCompletionStatus((prev) => ({
              ...prev,
              kpis: prev.kpis || snap.size >= 5,
              kpisPartial: prev.kpisPartial || snap.size > 0,
            }));
          }
        })
      );
    }

    return () => unsubs.forEach((u) => u());
  }, [companyId, selectedYear]);

  const currentStep = WIZARD_STEPS[currentStepIndex];
  
  const overallProgress = useMemo(() => {
    const completed = WIZARD_STEPS.filter((step) => completionStatus[step.id]).length;
    return Math.round((completed / WIZARD_STEPS.length) * 100);
  }, [completionStatus]);

  const goNext = () => {
    if (currentStepIndex < WIZARD_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleStartStep = () => {
    onNavigate(currentStep.navigateTo);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <SparklesIcon className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SparklesIcon className="h-6 w-6 text-accent" />
            Planning Wizard
          </h1>
          <p className="text-muted-foreground">
            Build your {selectedYear} strategic plan step by step
          </p>
        </div>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Exit Wizard
          </Button>
        )}
      </div>

      {/* Overall Progress */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <Badge variant={overallProgress === 100 ? "default" : "secondary"}>
              {overallProgress}% complete
            </Badge>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </CardContent>
      </Card>

      {/* Step Navigation */}
      <div className="flex items-center justify-center gap-2">
        {WIZARD_STEPS.map((step, index) => {
          const isComplete = completionStatus[step.id];
          const isCurrent = index === currentStepIndex;
          const isPartial = completionStatus[`${step.id}Partial`];
          
          return (
            <button
              key={step.id}
              onClick={() => setCurrentStepIndex(index)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : isComplete
                  ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400"
                  : isPartial
                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {isComplete ? (
                <CheckCircle2Icon className="h-3 w-3" />
              ) : (
                <span className="w-3 h-3 rounded-full border flex items-center justify-center text-[10px]">
                  {index + 1}
                </span>
              )}
              <span className="hidden sm:inline">{step.title}</span>
            </button>
          );
        })}
      </div>

      {/* Current Step Card */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-3 ${completionStatus[currentStep.id] ? "bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-400" : "bg-primary/10 text-primary"}`}>
                {currentStep.icon}
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Step {currentStepIndex + 1}: {currentStep.title}
                  {completionStatus[currentStep.id] && (
                    <Badge variant="default" className="bg-green-500">
                      Complete
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-1">{currentStep.description}</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tips */}
          <div className="rounded-lg bg-muted/50 p-4">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <TrendingUpIcon className="h-4 w-4 text-accent" />
              Tips for this step
            </h4>
            <ul className="space-y-1">
              {currentStep.tips.map((tip, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-accent">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          {/* Action Button */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={goPrev} disabled={currentStepIndex === 0}>
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Previous
            </Button>
            
            <Button onClick={handleStartStep} size="lg">
              {completionStatus[currentStep.id] ? "Review" : "Start"} {currentStep.title}
              <ArrowRightIcon className="h-4 w-4 ml-2" />
            </Button>
            
            <Button variant="outline" onClick={goNext} disabled={currentStepIndex === WIZARD_STEPS.length - 1}>
              Next
              <ArrowRightIcon className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links to All Steps */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Planning Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {WIZARD_STEPS.map((step, index) => {
              const isComplete = completionStatus[step.id];
              
              return (
                <button
                  key={step.id}
                  onClick={() => {
                    setCurrentStepIndex(index);
                    handleStartStep();
                  }}
                  className={`p-3 rounded-lg border text-left transition-colors hover:bg-muted/50 ${
                    isComplete ? "border-green-500/30" : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {isComplete ? (
                      <CheckCircle2Icon className="h-4 w-4 text-green-600" />
                    ) : (
                      <CircleIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">{step.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{step.description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

