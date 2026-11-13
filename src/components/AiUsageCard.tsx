"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveUsers } from "@/hooks/use-active-users";

const DEFAULT_COMPANY_ID = "default-company";
const MONTHS_SHOWN = 12;

interface UsageTotals {
  calls: number;
  costUsd: number;
}

/** companies/{company}/aiUsage/{YYYY-MM}, written by Cloud Functions. */
interface UsageMonth extends UsageTotals {
  month: string;
  inputTokens: number;
  outputTokens: number;
  unpricedCalls: number;
  byUser: Record<string, UsageTotals>;
}

function formatUsd(value: number): string {
  if (value === 0) return "$0.00";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

const formatTokens = (value: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);

/** The current month on Arizona time, matching how functions bucket usage. */
function currentMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Phoenix",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

function previousMonths(latest: string, count: number): string[] {
  const [year, month] = latest.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1 - (count - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

const monthLabel = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

/** Admin-only view of AI calls, tokens, and estimated cost by month. */
export function AiUsageCard() {
  const { hasRole } = useAuth();
  const { users } = useActiveUsers();
  const [months, setMonths] = useState<Record<string, UsageMonth>>({});
  const isAdmin = hasRole("admin");

  useEffect(() => {
    if (!isAdmin) return;
    return onSnapshot(collection(db, "companies", DEFAULT_COMPANY_ID, "aiUsage"), (snap) => {
      const next: Record<string, UsageMonth> = {};
      snap.forEach((d) => {
        const data = d.data();
        next[d.id] = {
          month: d.id,
          calls: data.calls ?? 0,
          costUsd: data.costUsd ?? 0,
          inputTokens: data.inputTokens ?? 0,
          outputTokens: data.outputTokens ?? 0,
          unpricedCalls: data.unpricedCalls ?? 0,
          byUser: data.byUser ?? {},
        };
      });
      setMonths(next);
    });
  }, [isAdmin]);

  const thisMonth = currentMonth();
  const current = months[thisMonth];
  const chart = useMemo(
    () =>
      previousMonths(thisMonth, MONTHS_SHOWN).map((month) => ({
        month: monthLabel(month),
        cost: Number((months[month]?.costUsd ?? 0).toFixed(4)),
        calls: months[month]?.calls ?? 0,
      })),
    [months, thisMonth]
  );
  const allTime = Object.values(months).reduce(
    (sum, m) => ({ calls: sum.calls + m.calls, costUsd: sum.costUsd + m.costUsd }),
    { calls: 0, costUsd: 0 }
  );
  const topUsers = Object.entries(current?.byUser ?? {})
    .map(([uid, totals]) => {
      const user = users.find((u) => u.id === uid);
      return { uid, name: user?.name || user?.email || "Former user", ...totals };
    })
    .sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls)
    .slice(0, 5);

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI usage</CardTitle>
        <CardDescription>
          Tokens and estimated cost of the app&apos;s AI features. Today that is
          writing goal statements from SMART answers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Cost this month" value={formatUsd(current?.costUsd ?? 0)} />
          <Stat
            label="Calls this month"
            value={String(current?.calls ?? 0)}
            hint={current?.calls ? `${formatUsd(current.costUsd / current.calls)} per call` : undefined}
          />
          <Stat
            label="Tokens this month"
            value={formatTokens((current?.inputTokens ?? 0) + (current?.outputTokens ?? 0))}
            hint={`${formatTokens(current?.inputTokens ?? 0)} in · ${formatTokens(current?.outputTokens ?? 0)} out`}
          />
          <Stat label="Cost all time" value={formatUsd(allTime.costUsd)} hint={`${allTime.calls} calls`} />
        </div>

        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatUsd(v)} width={60} />
              <Tooltip
                formatter={(value: number, _name, item) => [
                  `${formatUsd(value)} · ${item.payload.calls} calls`,
                  "Estimated cost",
                ]}
              />
              <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {topUsers.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Top users this month</div>
            <div className="divide-y rounded-md border">
              {topUsers.map((u) => (
                <div key={u.uid} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{u.name}</span>
                  <span className="text-muted-foreground">
                    {u.calls} calls · {formatUsd(u.costUsd)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Estimated from Google&apos;s list price at the time of each call. Tracking
          started Nov 2026; earlier calls are not counted. The actual bill is in
          Google Cloud Billing for the project.
          {current?.unpricedCalls
            ? ` ${current.unpricedCalls} call(s) this month used a model with no price on file and count as $0.`
            : ""}
        </p>
      </CardContent>
    </Card>
  );
}
