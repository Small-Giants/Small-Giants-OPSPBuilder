"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, collection, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePlanYear } from "@/contexts/PlanYearContext";
import { useAuth } from "@/contexts/AuthContext";
import { refreshClickUpMembers, syncClickUp, testClickUpConnection } from "@/lib/callables";
import { AlertCircle, CheckCircle2, Loader2, PlugZap, RefreshCw, Users } from "lucide-react";
import { AiUsageCard } from "@/components/AiUsageCard";
import { ClickUpLocationSetting } from "@/components/ClickUpLocationSetting";
import { GoalStatementPromptSetting } from "@/components/GoalStatementPromptSetting";

/** Mirror of ClickUpSettings in functions/src/clickup/settings.ts. */
interface ClickUpConfig {
  enabled: boolean;
  recapMarkers: string[];
  recapAuthor: string;
  agentMention: string;
  updatedAt?: string;
  updatedBy?: string;
}

const DEFAULT_CONFIG: ClickUpConfig = {
  enabled: false,
  recapMarkers: ["OPSP Rock Plan", "OPSP Monthly Recap"],
  recapAuthor: "",
  agentMention: "OPSP Updater",
};

interface SyncLog {
  id: string;
  finishedAt: string;
  triggeredBy: string;
  trigger?: "manual" | "scheduled";
  status: "success" | "partial" | "error";
  goalsExamined: number;
  goalsUpdated: number;
  recapsApplied?: number;
  recapsPending?: number;
  errors: { goalId: string; message: string }[];
}

export default function IntegrationSettings() {
  const { toast } = useToast();
  const { companyId, selectedYear } = usePlanYear();
  const { hasRole } = useAuth();

  const [config, setConfig] = useState<ClickUpConfig>(DEFAULT_CONFIG);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastWarnings, setLastWarnings] = useState<string[]>([]);
  const [markersText, setMarkersText] = useState(DEFAULT_CONFIG.recapMarkers.join(", "));

  const isAdmin = hasRole("admin");

  useEffect(() => {
    const unsubConfig = onSnapshot(
      doc(db, "companies", companyId, "integrations", "clickup"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<ClickUpConfig> & { recapMarker?: string };
          const recapMarkers = data.recapMarkers?.length
            ? data.recapMarkers
            : data.recapMarker
              ? [data.recapMarker]
              : DEFAULT_CONFIG.recapMarkers;
          setConfig({ ...DEFAULT_CONFIG, ...data, recapMarkers });
          setMarkersText(recapMarkers.join(", "));
        }
      }
    );

    const unsubLogs = onSnapshot(
      query(
        collection(db, "companies", companyId, "syncLogs"),
        orderBy("finishedAt", "desc"),
        limit(10)
      ),
      (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SyncLog))
    );

    return () => {
      unsubConfig();
      unsubLogs();
    };
  }, [companyId]);

  const save = async (next: ClickUpConfig) => {
    setSaving(true);
    try {
      await setDoc(
        doc(db, "companies", companyId, "integrations", "clickup"),
        { ...next, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      setConfig(next);
      toast({ title: "Saved", description: "ClickUp settings updated." });
    } catch (error: any) {
      toast({
        title: "Could not save",
        description: error?.message ?? "Unknown error.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    try {
      const result = await testClickUpConnection();
      toast({
        title: "ClickUp connected",
        description: `Authenticated as ${result.connectedAs}.`,
      });
    } catch (error: any) {
      toast({
        title: "Connection failed",
        description: error?.message ?? "Unknown error.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const runSync = async () => {
    setSyncing(true);
    try {
      const result = await syncClickUp({ planYear: selectedYear });
      const rocks =
        result.rocksCreated + result.rocksUpdated > 0
          ? ` Rocks: ${result.rocksCreated} added, ${result.rocksUpdated} updated.`
          : "";
      const detail = `${result.goalsExamined} linked goal(s): ${result.recapsApplied} recap(s) applied, ${result.recapsPending} waiting for approval.${rocks}`;
      toast({
        title: result.status === "success" ? "Sync complete" : "Sync finished with problems",
        description:
          result.errors.length > 0
            ? `${detail} ${result.errors.length} failed: ${result.errors[0].message}`
            : detail,
        variant: result.status === "error" ? "destructive" : undefined,
      });
      setLastWarnings(result.warnings);
    } catch (error: any) {
      toast({
        title: "Sync failed",
        description: error?.message ?? "Unknown error.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const runRefreshPeople = async () => {
    setRefreshing(true);
    try {
      const result = await refreshClickUpMembers();
      toast({
        title: "People synced",
        description: `${result.members} ClickUp member(s); ${result.created} added as new people, ${result.alreadyHadAccount} already had an account.`,
      });
    } catch (error: any) {
      toast({
        title: "Could not refresh people",
        description: error?.message ?? "Unknown error.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const saveMarkers = () => {
    const recapMarkers = markersText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (recapMarkers.length === 0) {
      setMarkersText(config.recapMarkers.join(", "));
      return;
    }
    if (recapMarkers.join("|") === config.recapMarkers.join("|")) return;
    save({ ...config, recapMarkers });
  };

  if (!isAdmin) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Admin only</CardTitle>
          <CardDescription>
            Integration settings are managed by an administrator.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <PlugZap className="w-6 h-6" />
          Integrations
        </h2>
        <p className="text-muted-foreground text-sm">
          ClickUp tracks the day-to-day work. Saving a department goal creates
          its ClickUp task. The ClickUp agent posts a rock plan on the task, then
          a recap each month, or answers in a comment thread when someone
          @mentions it. Once the goal&apos;s Accountable person approves a
          recap (by replying &quot;Approved&quot; in ClickUp or in the app), the
          next sync applies it. Syncs run automatically on the first Friday of
          each month unless an admin already synced that month.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">ClickUp</CardTitle>
              <CardDescription>
                The API token lives in Secret Manager, not here. Set it with{" "}
                <code className="text-xs">firebase functions:secrets:set CLICKUP_API_TOKEN</code>.
              </CardDescription>
            </div>
            <Switch
              checked={config.enabled}
              disabled={saving}
              onCheckedChange={(enabled) => save({ ...config, enabled })}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="recap-marker">Recap headings</Label>
              <Input
                id="recap-marker"
                value={markersText}
                onChange={(e) => setMarkersText(e.target.value)}
                onBlur={saveMarkers}
              />
              <p className="text-xs text-muted-foreground">
                Comma separated. The agent opens each rock plan or monthly recap
                with one of these lines; other comments are ignored.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recap-author">Agent name (optional)</Label>
              <Input
                id="recap-author"
                value={config.recapAuthor}
                placeholder="Any author"
                onChange={(e) => setConfig({ ...config, recapAuthor: e.target.value })}
                onBlur={() => save(config)}
              />
              <p className="text-xs text-muted-foreground">
                Only accept recaps whose author name contains this, so a person
                pasting the heading is ignored.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-mention">Agent @mention</Label>
              <Input
                id="agent-mention"
                value={config.agentMention}
                placeholder="Any comment with replies"
                onChange={(e) => setConfig({ ...config, agentMention: e.target.value })}
                onBlur={() => save(config)}
              />
              <p className="text-xs text-muted-foreground">
                When a task has no recap comment from the last month, the sync
                also reads the replies under recent comments that @mention this
                name, where the agent answers.
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            New department goals are created in the ClickUp goal location below,
            set by a superadmin. Its tasks need a People field for each RACI
            role, such as &quot;A (Accountable)&quot;, &quot;R (Responsible)&quot;,
            &quot;C (Consulting)&quot;, and &quot;I (Inform)&quot;.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" onClick={runTest} disabled={testing}>
              {testing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <PlugZap className="w-4 h-4 mr-2" />
              )}
              Test connection
            </Button>
            <Button variant="outline" onClick={runRefreshPeople} disabled={refreshing}>
              {refreshing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Users className="w-4 h-4 mr-2" />
              )}
              Sync people from ClickUp
            </Button>
            <Button onClick={runSync} disabled={syncing || !config.enabled}>
              {syncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Pull {selectedYear} recaps from ClickUp
            </Button>
          </div>

          {lastWarnings.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-1">
              <p className="text-xs font-medium">From the last sync</p>
              {lastWarnings.map((warning) => (
                <p key={warning} className="text-xs text-muted-foreground">
                  {warning}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ClickUpLocationSetting />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent syncs</CardTitle>
          <CardDescription>The last ten runs, newest first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No syncs have run yet.
            </p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-lg border border-border p-3"
              >
                {log.status === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      log.status === "error" ? "text-destructive" : "text-amber-600"
                    }`}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm">
                      {new Date(log.finishedAt).toLocaleString()}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {log.goalsUpdated}/{log.goalsExamined} updated
                    </Badge>
                    {log.recapsApplied != null && (
                      <Badge variant="outline" className="text-[10px]">
                        {log.recapsApplied} applied
                      </Badge>
                    )}
                    {(log.recapsPending ?? 0) > 0 && (
                      <Badge variant="outline" className="text-[10px] text-amber-700">
                        {log.recapsPending} awaiting approval
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {log.trigger === "scheduled" ? "Scheduled" : log.triggeredBy}
                    </span>
                  </div>
                  {log.errors?.length > 0 && (
                    <p className="text-xs text-destructive mt-1">
                      {log.errors[0].message}
                      {log.errors.length > 1 && ` (+${log.errors.length - 1} more)`}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <GoalStatementPromptSetting />

      <AiUsageCard />
    </div>
  );
}
