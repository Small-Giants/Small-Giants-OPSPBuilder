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
import { syncClickUp, testClickUpConnection } from "@/lib/callables";
import { AlertCircle, CheckCircle2, Loader2, PlugZap, RefreshCw } from "lucide-react";

interface ClickUpConfig {
  enabled: boolean;
  quarterFieldName: string;
  progressFieldName: string;
  completeStatuses: string[];
  updatedAt?: string;
  updatedBy?: string;
}

const DEFAULT_CONFIG: ClickUpConfig = {
  enabled: false,
  quarterFieldName: "Quarter",
  progressFieldName: "Actual",
  completeStatuses: ["complete", "closed", "done"],
};

interface SyncLog {
  id: string;
  finishedAt: string;
  triggeredBy: string;
  status: "success" | "partial" | "error";
  goalsExamined: number;
  goalsUpdated: number;
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

  const isAdmin = hasRole("admin");

  useEffect(() => {
    const unsubConfig = onSnapshot(
      doc(db, "companies", companyId, "integrations", "clickup"),
      (snap) => {
        if (snap.exists()) {
          setConfig({ ...DEFAULT_CONFIG, ...(snap.data() as Partial<ClickUpConfig>) });
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
      const detail = `${result.goalsUpdated} of ${result.goalsExamined} goal(s) updated.`;
      toast({
        title: result.status === "success" ? "Sync complete" : "Sync finished with problems",
        description:
          result.errors.length > 0
            ? `${detail} ${result.errors.length} failed: ${result.errors[0].message}`
            : detail,
        variant: result.status === "error" ? "destructive" : undefined,
      });
      result.warnings.forEach((warning) =>
        toast({ title: "Heads up", description: warning })
      );
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
          ClickUp tracks the day-to-day work. This pulls task progress back into
          the goals so the OPSP stays the record of what was committed.
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
              <Label htmlFor="quarter-field">Quarter field</Label>
              <Input
                id="quarter-field"
                value={config.quarterFieldName}
                onChange={(e) => setConfig({ ...config, quarterFieldName: e.target.value })}
                onBlur={() => save(config)}
              />
              <p className="text-xs text-muted-foreground">
                ClickUp custom field naming the quarter. Falls back to the task
                due date when it is empty.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="progress-field">Value field</Label>
              <Input
                id="progress-field"
                value={config.progressFieldName}
                onChange={(e) => setConfig({ ...config, progressFieldName: e.target.value })}
                onBlur={() => save(config)}
              />
              <p className="text-xs text-muted-foreground">
                Numeric custom field read into the quarter actual for
                quantitative goals.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="complete-statuses">Statuses that mean done</Label>
            <Input
              id="complete-statuses"
              value={config.completeStatuses.join(", ")}
              onChange={(e) =>
                setConfig({
                  ...config,
                  completeStatuses: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
              onBlur={() => save(config)}
            />
            <p className="text-xs text-muted-foreground">
              Comma separated. ClickUp&apos;s own closed columns always count,
              regardless of what is listed here.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={runTest} disabled={testing}>
              {testing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <PlugZap className="w-4 h-4 mr-2" />
              )}
              Test connection
            </Button>
            <Button onClick={runSync} disabled={syncing || !config.enabled}>
              {syncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync {selectedYear} goals now
            </Button>
          </div>
        </CardContent>
      </Card>

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
                    <span className="text-xs text-muted-foreground">
                      {log.triggeredBy}
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
    </div>
  );
}
