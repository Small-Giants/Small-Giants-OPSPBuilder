"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  type Unsubscribe,
} from "firebase/firestore";
import { LEGACY_PLAN_YEAR, usePlanYear } from "@/contexts/PlanYearContext";
import {
  PlayIcon,
  PauseIcon,
  CheckCircle2Icon,
  CircleIcon,
  PlusIcon,
  TrashIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  CalendarIcon,
  TargetIcon,
  BarChart3Icon,
  AlertTriangleIcon,
  ListTodoIcon,
  LightbulbIcon,
  UsersIcon,
  ClockIcon,
} from "lucide-react";

type MeetingStep = "scoreboard" | "rocks" | "issues" | "decisions" | "todos";

interface Issue {
  id: string;
  text: string;
  resolved: boolean;
  createdAt: string;
}

interface Decision {
  id: string;
  text: string;
  owner?: string;
  createdAt: string;
}

interface Todo {
  id: string;
  text: string;
  owner?: string;
  dueDate?: string;
  completed: boolean;
  createdAt: string;
}

interface Meeting {
  id: string;
  date: string;
  status: "in_progress" | "completed";
  notes?: string;
  issues: Issue[];
  decisions: Decision[];
  todos: Todo[];
  createdAt: string;
}

interface Metric {
  id: string;
  name: string;
  unit: string;
  currentValue: number;
  targetValue: number;
  trend: "up" | "down" | "stable";
  owner?: string;
  lastUpdated?: string;
}

interface Rock {
  id: string;
  text: string;
  status: "not_started" | "ready" | "in_progress" | "complete";
  quarter: string;
  assigneeName?: string;
  progress?: number;
}

function getCurrentQuarter(): string {
  const month = new Date().getMonth();
  if (month <= 2) return "Q1";
  if (month <= 5) return "Q2";
  if (month <= 8) return "Q3";
  return "Q4";
}

const STEPS: { key: MeetingStep; label: string; icon: React.ReactNode }[] = [
  { key: "scoreboard", label: "Scoreboard", icon: <BarChart3Icon className="h-4 w-4" /> },
  { key: "rocks", label: "Rocks Review", icon: <TargetIcon className="h-4 w-4" /> },
  { key: "issues", label: "Issues", icon: <AlertTriangleIcon className="h-4 w-4" /> },
  { key: "decisions", label: "Decisions", icon: <LightbulbIcon className="h-4 w-4" /> },
  { key: "todos", label: "To-Dos", icon: <ListTodoIcon className="h-4 w-4" /> },
];

export default function WeeklyMeeting() {
  const { toast } = useToast();
  const { companyId, selectedYear } = usePlanYear();

  const [currentStep, setCurrentStep] = useState<MeetingStep>("scoreboard");
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [rocks, setRocks] = useState<Rock[]>([]);
  const [loading, setLoading] = useState(true);

  // Local state for the current meeting session
  const [issues, setIssues] = useState<Issue[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newIssue, setNewIssue] = useState("");
  const [newDecision, setNewDecision] = useState("");
  const [newDecisionOwner, setNewDecisionOwner] = useState("");
  const [newTodo, setNewTodo] = useState("");
  const [newTodoOwner, setNewTodoOwner] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");

  const currentQuarter = useMemo(() => getCurrentQuarter(), []);

  // Fetch metrics
  useEffect(() => {
    let unsubYear: Unsubscribe | undefined;
    let unsubLegacy: Unsubscribe | undefined;

    const byId = new Map<string, Metric>();
    const apply = () => setMetrics(Array.from(byId.values()));

    const metricsRef = collection(db, "companies", companyId, "metrics");
    const qYear = query(metricsRef, where("planYear", "==", selectedYear));

    unsubYear = onSnapshot(qYear, (snapshot) => {
      byId.clear();
      snapshot.forEach((d) => byId.set(d.id, { id: d.id, ...(d.data() as any) }));
      apply();
    });

    if (selectedYear === LEGACY_PLAN_YEAR) {
      const qLegacy = query(metricsRef, where("planYear", "==", null));
      unsubLegacy = onSnapshot(qLegacy, (snapshot) => {
        snapshot.forEach((d) => {
          if (!byId.has(d.id)) byId.set(d.id, { id: d.id, ...(d.data() as any) });
        });
        apply();
      });
    }

    return () => {
      unsubYear?.();
      unsubLegacy?.();
    };
  }, [companyId, selectedYear]);

  // Fetch rocks
  useEffect(() => {
    let unsubYear: Unsubscribe | undefined;
    let unsubLegacy: Unsubscribe | undefined;

    const byId = new Map<string, Rock>();
    const apply = () => {
      setRocks(Array.from(byId.values()));
      setLoading(false);
    };

    const rocksCol = collection(db, "companies", companyId, "rocks");
    const qYear = query(rocksCol, where("year", "==", selectedYear));

    unsubYear = onSnapshot(qYear, (snapshot) => {
      byId.clear();
      snapshot.forEach((d) => byId.set(d.id, { id: d.id, ...(d.data() as any) }));
      apply();
    });

    if (selectedYear === LEGACY_PLAN_YEAR) {
      const qLegacy = query(rocksCol, where("year", "==", null));
      unsubLegacy = onSnapshot(qLegacy, (snapshot) => {
        snapshot.forEach((d) => {
          if (!byId.has(d.id)) byId.set(d.id, { id: d.id, ...(d.data() as any) });
        });
        apply();
      });
    }

    return () => {
      unsubYear?.();
      unsubLegacy?.();
    };
  }, [companyId, selectedYear]);

  // Fetch active meeting or most recent
  useEffect(() => {
    const meetingsRef = collection(db, "companies", companyId, "meetings");
    const qActive = query(
      meetingsRef,
      where("status", "==", "in_progress"),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const unsub = onSnapshot(qActive, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data() as any;
        setActiveMeeting({ id: doc.id, ...data });
        setIssues(data.issues || []);
        setDecisions(data.decisions || []);
        setTodos(data.todos || []);
        setMeetingNotes(data.notes || "");
      } else {
        setActiveMeeting(null);
        setIssues([]);
        setDecisions([]);
        setTodos([]);
        setMeetingNotes("");
      }
    });

    return () => unsub();
  }, [companyId]);

  const quarterRocks = useMemo(
    () => rocks.filter((r) => (r.quarter || "Q1") === currentQuarter),
    [rocks, currentQuarter]
  );

  const rocksComplete = useMemo(
    () => quarterRocks.filter((r) => r.status === "complete").length,
    [quarterRocks]
  );

  const rocksProgress = useMemo(() => {
    if (quarterRocks.length === 0) return 0;
    return Math.round((rocksComplete / quarterRocks.length) * 100);
  }, [quarterRocks.length, rocksComplete]);

  const startMeeting = async () => {
    try {
      const meetingsRef = collection(db, "companies", companyId, "meetings");
      const newMeeting = {
        date: new Date().toISOString().split("T")[0],
        status: "in_progress",
        issues: [],
        decisions: [],
        todos: [],
        notes: "",
        createdAt: new Date().toISOString(),
        year: selectedYear,
      };
      await addDoc(meetingsRef, newMeeting);
      toast({ title: "Meeting started", description: "Your weekly meeting has begun." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to start meeting", variant: "destructive" });
    }
  };

  const endMeeting = async () => {
    if (!activeMeeting) return;
    try {
      const meetingRef = doc(db, "companies", companyId, "meetings", activeMeeting.id);
      await updateDoc(meetingRef, {
        status: "completed",
        issues,
        decisions,
        todos,
        notes: meetingNotes,
        completedAt: new Date().toISOString(),
      });
      toast({ title: "Meeting ended", description: "Meeting notes have been saved." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to end meeting", variant: "destructive" });
    }
  };

  const saveMeetingState = async () => {
    if (!activeMeeting) return;
    try {
      const meetingRef = doc(db, "companies", companyId, "meetings", activeMeeting.id);
      await updateDoc(meetingRef, {
        issues,
        decisions,
        todos,
        notes: meetingNotes,
      });
    } catch (error) {
      }
  };

  // Auto-save meeting state
  useEffect(() => {
    if (!activeMeeting) return;
    const timer = setTimeout(() => saveMeetingState(), 2000);
    return () => clearTimeout(timer);
  }, [issues, decisions, todos, meetingNotes, activeMeeting]);

  const addIssue = () => {
    if (!newIssue.trim()) return;
    setIssues((prev) => [
      ...prev,
      { id: Date.now().toString(), text: newIssue, resolved: false, createdAt: new Date().toISOString() },
    ]);
    setNewIssue("");
  };

  const toggleIssue = (id: string) => {
    setIssues((prev) =>
      prev.map((issue) => (issue.id === id ? { ...issue, resolved: !issue.resolved } : issue))
    );
  };

  const removeIssue = (id: string) => {
    setIssues((prev) => prev.filter((issue) => issue.id !== id));
  };

  const addDecision = () => {
    if (!newDecision.trim()) return;
    setDecisions((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        text: newDecision,
        owner: newDecisionOwner || undefined,
        createdAt: new Date().toISOString(),
      },
    ]);
    setNewDecision("");
    setNewDecisionOwner("");
  };

  const removeDecision = (id: string) => {
    setDecisions((prev) => prev.filter((d) => d.id !== id));
  };

  const addTodo = () => {
    if (!newTodo.trim()) return;
    setTodos((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        text: newTodo,
        owner: newTodoOwner || undefined,
        completed: false,
        createdAt: new Date().toISOString(),
      },
    ]);
    setNewTodo("");
    setNewTodoOwner("");
  };

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo))
    );
  };

  const removeTodo = (id: string) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  };

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);

  const goNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentStepIndex + 1].key);
    }
  };

  const goPrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(STEPS[currentStepIndex - 1].key);
    }
  };

  const getMetricStatus = (metric: Metric) => {
    const pct = metric.targetValue > 0 ? (metric.currentValue / metric.targetValue) * 100 : 0;
    if (pct >= 100) return "green";
    if (pct >= 75) return "yellow";
    return "red";
  };

  const renderScoreboard = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">KPI Scoreboard</h3>
        <Badge variant="outline">{metrics.length} metrics</Badge>
      </div>

      {metrics.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <BarChart3Icon className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No KPIs configured yet.</p>
          <p className="text-sm">Add KPIs from the dashboard to track in meetings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric) => {
            const status = getMetricStatus(metric);
            const statusColors = {
              green: "border-l-green-500 bg-green-50/50 dark:bg-green-950/20",
              yellow: "border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20",
              red: "border-l-red-500 bg-red-50/50 dark:bg-red-950/20",
            };

            return (
              <div
                key={metric.id}
                className={`p-4 rounded-lg border-l-4 ${statusColors[status]} border border-border`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{metric.name}</p>
                    {metric.owner && (
                      <p className="text-xs text-muted-foreground">Owner: {metric.owner}</p>
                    )}
                  </div>
                  <Badge
                    variant={status === "green" ? "default" : status === "yellow" ? "secondary" : "destructive"}
                    className="text-xs"
                  >
                    {status.toUpperCase()}
                  </Badge>
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold">
                    {metric.currentValue.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">{metric.unit}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    / {metric.targetValue.toLocaleString()} target
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderRocks = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{currentQuarter} Rocks Review</h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {rocksComplete}/{quarterRocks.length} complete
          </Badge>
          <Badge variant="secondary">{rocksProgress}%</Badge>
        </div>
      </div>

      <Progress value={rocksProgress} className="h-2" />

      {quarterRocks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <TargetIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No rocks for {currentQuarter}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {quarterRocks.map((rock) => (
            <div
              key={rock.id}
              className={`p-3 rounded-lg border ${
                rock.status === "complete"
                  ? "border-green-500/30 bg-green-50/50 dark:bg-green-950/20"
                  : rock.status === "in_progress"
                  ? "border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-border"
              }`}
            >
              <div className="flex items-start gap-3">
                {rock.status === "complete" ? (
                  <CheckCircle2Icon className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <CircleIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`text-sm ${rock.status === "complete" ? "line-through opacity-60" : ""}`}>
                    {rock.text}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {rock.assigneeName && (
                      <span className="text-xs text-muted-foreground">
                        <UsersIcon className="h-3 w-3 inline mr-1" />
                        {rock.assigneeName}
                      </span>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {rock.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderIssues = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Issues to Discuss</h3>
        <Badge variant="outline">
          {issues.filter((i) => !i.resolved).length} open
        </Badge>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Add a new issue..."
          value={newIssue}
          onChange={(e) => setNewIssue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addIssue()}
        />
        <Button onClick={addIssue} disabled={!newIssue.trim()}>
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {issues.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangleIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No issues raised yet.</p>
          </div>
        ) : (
          issues.map((issue) => (
            <div
              key={issue.id}
              className={`p-3 rounded-lg border flex items-start gap-3 ${
                issue.resolved ? "opacity-60 border-green-500/30" : "border-border"
              }`}
            >
              <Checkbox
                checked={issue.resolved}
                onCheckedChange={() => toggleIssue(issue.id)}
              />
              <p className={`flex-1 text-sm ${issue.resolved ? "line-through" : ""}`}>
                {issue.text}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => removeIssue(issue.id)}
              >
                <TrashIcon className="h-3 w-3" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderDecisions = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Decisions Made</h3>
        <Badge variant="outline">{decisions.length} decisions</Badge>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Add a decision..."
          value={newDecision}
          onChange={(e) => setNewDecision(e.target.value)}
          className="flex-1"
        />
        <Input
          placeholder="Owner"
          value={newDecisionOwner}
          onChange={(e) => setNewDecisionOwner(e.target.value)}
          className="w-32"
        />
        <Button onClick={addDecision} disabled={!newDecision.trim()}>
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {decisions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <LightbulbIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No decisions recorded yet.</p>
          </div>
        ) : (
          decisions.map((decision) => (
            <div key={decision.id} className="p-3 rounded-lg border border-border flex items-start gap-3">
              <LightbulbIcon className="h-4 w-4 text-yellow-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm">{decision.text}</p>
                {decision.owner && (
                  <p className="text-xs text-muted-foreground mt-1">Owner: {decision.owner}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => removeDecision(decision.id)}
              >
                <TrashIcon className="h-3 w-3" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderTodos = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Action Items</h3>
        <Badge variant="outline">
          {todos.filter((t) => !t.completed).length} pending
        </Badge>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Add an action item..."
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          className="flex-1"
        />
        <Input
          placeholder="Owner"
          value={newTodoOwner}
          onChange={(e) => setNewTodoOwner(e.target.value)}
          className="w-32"
        />
        <Button onClick={addTodo} disabled={!newTodo.trim()}>
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {todos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ListTodoIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No action items yet.</p>
          </div>
        ) : (
          todos.map((todo) => (
            <div
              key={todo.id}
              className={`p-3 rounded-lg border flex items-start gap-3 ${
                todo.completed ? "opacity-60 border-green-500/30" : "border-border"
              }`}
            >
              <Checkbox
                checked={todo.completed}
                onCheckedChange={() => toggleTodo(todo.id)}
              />
              <div className="flex-1">
                <p className={`text-sm ${todo.completed ? "line-through" : ""}`}>{todo.text}</p>
                {todo.owner && (
                  <p className="text-xs text-muted-foreground">Owner: {todo.owner}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => removeTodo(todo.id)}
              >
                <TrashIcon className="h-3 w-3" />
              </Button>
            </div>
          ))
        )}
      </div>

      <Separator />

      <div>
        <label className="text-sm font-medium mb-2 block">Meeting Notes</label>
        <Textarea
          placeholder="Additional notes from this meeting..."
          value={meetingNotes}
          onChange={(e) => setMeetingNotes(e.target.value)}
          rows={4}
        />
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case "scoreboard":
        return renderScoreboard();
      case "rocks":
        return renderRocks();
      case "issues":
        return renderIssues();
      case "decisions":
        return renderDecisions();
      case "todos":
        return renderTodos();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="h-6 w-6" />
            Weekly Meeting
          </h1>
          <p className="text-muted-foreground">
            Review scoreboard, discuss issues, make decisions, and assign action items.
          </p>
        </div>

        {activeMeeting ? (
          <div className="flex items-center gap-2">
            <Badge variant="default" className="animate-pulse">
              <ClockIcon className="h-3 w-3 mr-1" />
              Meeting in Progress
            </Badge>
            <Button variant="destructive" size="sm" onClick={endMeeting}>
              <PauseIcon className="h-4 w-4 mr-1" />
              End Meeting
            </Button>
          </div>
        ) : (
          <Button onClick={startMeeting}>
            <PlayIcon className="h-4 w-4 mr-2" />
            Start Meeting
          </Button>
        )}
      </div>

      {activeMeeting && (
        <>
          {/* Step Navigation */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                {STEPS.map((step, index) => (
                  <button
                    key={step.key}
                    onClick={() => setCurrentStep(step.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      currentStep === step.key
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {step.icon}
                    <span className="text-sm font-medium">{step.label}</span>
                    {index < STEPS.length - 1 && (
                      <ChevronRightIcon className="h-4 w-4 ml-2 text-muted-foreground/50" />
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Step Content */}
          <Card>
            <CardContent className="pt-6">{renderStepContent()}</CardContent>
          </Card>

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={goPrev} disabled={currentStepIndex === 0}>
              <ChevronLeftIcon className="h-4 w-4 mr-1" />
              Previous
            </Button>
            {currentStepIndex === STEPS.length - 1 ? (
              <Button onClick={endMeeting}>
                Complete Meeting
                <CheckCircle2Icon className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={goNext}>
                Next
                <ChevronRightIcon className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </>
      )}

      {!activeMeeting && (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">No Active Meeting</h3>
            <p className="text-muted-foreground mb-6">
              Start a weekly meeting to review your scoreboard, discuss issues, and track action items.
            </p>
            <Button size="lg" onClick={startMeeting}>
              <PlayIcon className="h-5 w-5 mr-2" />
              Start Weekly Meeting
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
