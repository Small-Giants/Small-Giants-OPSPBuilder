"use client";

import { useMemo, useState } from "react";
import { usePlanYear } from "@/contexts/PlanYearContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { Loader2, PlusIcon } from "lucide-react";

// Types for Firestore data
interface PriorityData {
  planYear?: number;
  title?: string;
  description?: string;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

interface MetricData {
  planYear?: number;
  name?: string;
  unit?: string;
  targetValue?: number;
  currentValue?: number;
  data?: unknown[];
  trend?: string;
  createdAt?: string;
}

interface SwotData {
  strengths?: string[];
  weaknesses?: string[];
  opportunities?: string[];
  threats?: string[];
}

export default function YearSwitcher() {
  const { companyId, selectedYear, setSelectedYear, availableYears } = usePlanYear();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [newYear, setNewYear] = useState(String(selectedYear + 1));
  const [carryPriorities, setCarryPriorities] = useState(true);
  const [carryKpis, setCarryKpis] = useState(true);
  const [carrySwot, setCarrySwot] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const yearOptions = useMemo(() => {
    const years = [...availableYears];
    years.sort((a, b) => a - b);
    return years;
  }, [availableYears]);

  const resetWizard = () => {
    setNewYear(String(selectedYear + 1));
    setCarryPriorities(true);
    setCarryKpis(true);
    setCarrySwot(true);
    setIsCreating(false);
  };

  const handleCreateYear = async () => {
    const toYear = Number(newYear);
    if (!Number.isFinite(toYear) || toYear < 2000 || toYear > 3000) {
      toast({
        title: "Invalid year",
        description: "Enter a valid year (e.g. 2026).",
        variant: "destructive",
      });
      return;
    }

    if (yearOptions.includes(toYear)) {
      toast({
        title: "Year already exists",
        description: `${toYear} is already available.`,
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      // 1) Register the year
      const yearRef = doc(db, "companies", companyId, "years", String(toYear));
      await setDoc(
        yearRef,
        {
          year: toYear,
          createdAt: new Date().toISOString(),
          createdFromYear: selectedYear,
        },
        { merge: true }
      );

      // 2) Create year-scoped singleton docs (empty by default)
      const oneYearRef = doc(db, "companies", companyId, "roadmap", `one-year-${toYear}`);
      await setDoc(
        oneYearRef,
        {
          year: toYear,
          onePhraseStrategy: "",
          oneYearGoal: {},
          criticalNumbers: {},
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      const swotRef = doc(db, "companies", companyId, "swot", `analysis-${toYear}`);
      await setDoc(
        swotRef,
        {
          year: toYear,
          strengths: [],
          weaknesses: [],
          opportunities: [],
          threats: [],
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // 3) Carry over selections
      if (carryPriorities) {
        const prioritiesSnap = await getDocs(collection(db, "companies", companyId, "priorities"));
        const toCreate: PriorityData[] = [];
        prioritiesSnap.forEach((d) => {
          const data = d.data() as PriorityData;
          const planYear = typeof data.planYear === "number" ? data.planYear : selectedYear;
          if (planYear !== selectedYear) return;
          const { createdAt, updatedAt, ...rest } = data;
          toCreate.push({
            ...rest,
            planYear: toYear,
            createdAt: new Date().toISOString(),
          });
        });

        for (const item of toCreate) {
          await addDoc(collection(db, "companies", companyId, "priorities"), item);
        }
      }

      if (carryKpis) {
        const metricsSnap = await getDocs(collection(db, "companies", companyId, "metrics"));
        const toCreate: MetricData[] = [];
        metricsSnap.forEach((d) => {
          const data = d.data() as MetricData;
          const planYear = typeof data.planYear === "number" ? data.planYear : selectedYear;
          if (planYear !== selectedYear) return;
          toCreate.push({
            name: data.name ?? "",
            unit: data.unit ?? "",
            targetValue: Number(data.targetValue ?? 0),
            currentValue: 0,
            data: [],
            trend: "stable",
            planYear: toYear,
            createdAt: new Date().toISOString(),
          });
        });

        for (const item of toCreate) {
          await addDoc(collection(db, "companies", companyId, "metrics"), item);
        }
      }

      if (carrySwot) {
        const fromRef = doc(db, "companies", companyId, "swot", `analysis-${selectedYear}`);
        const legacyRef = doc(db, "companies", companyId, "swot", "analysis");

        const fromSnap = await getDoc(fromRef);
        const legacySnap = fromSnap.exists() ? null : await getDoc(legacyRef);
        const source = (fromSnap.exists() ? fromSnap.data() : legacySnap?.data()) as SwotData | undefined;

        if (source) {
          await setDoc(
            swotRef,
            {
              year: toYear,
              strengths: source.strengths ?? [],
              weaknesses: source.weaknesses ?? [],
              opportunities: source.opportunities ?? [],
              threats: source.threats ?? [],
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      }

      await setSelectedYear(toYear);
      toast({
        title: "Year created",
        description: `Switched to ${toYear}.`,
      });
      setOpen(false);
      resetWizard();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please try again.";
      toast({
        title: "Failed to create year",
        description: message,
        variant: "destructive",
      });
      setIsCreating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={String(selectedYear)}
        onValueChange={(v) => setSelectedYear(Number(v))}
      >
        <SelectTrigger className="h-8 w-[120px]">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          {yearOptions.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y} Plan
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="sm"
        className="h-8"
        onClick={() => {
          resetWizard();
          setOpen(true);
        }}
        data-testid="button-create-new-year"
      >
        <PlusIcon className="h-4 w-4 mr-2" />
        New Year
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Year</DialogTitle>
            <DialogDescription>
              Create a new plan year and optionally carry forward selected sections.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Year
              </label>
              <Input
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                placeholder="e.g., 2026"
                disabled={isCreating}
              />
            </div>

            <div className="rounded-md border border-border p-3 bg-muted/30">
              <div className="text-sm font-medium text-foreground">Carry over</div>
              <div className="text-xs text-muted-foreground mt-1">
                Foundation + 3-Year are shared across years and always available.
              </div>

              <div className="mt-3 space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={carryPriorities}
                    onCheckedChange={(v) => setCarryPriorities(Boolean(v))}
                    disabled={isCreating}
                  />
                  Annual priorities & capabilities list
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={carryKpis}
                    onCheckedChange={(v) => setCarryKpis(Boolean(v))}
                    disabled={isCreating}
                  />
                  KPI definitions (name/unit/targets; resets history)
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={carrySwot}
                    onCheckedChange={(v) => setCarrySwot(Boolean(v))}
                    disabled={isCreating}
                  />
                  SWOT
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  resetWizard();
                }}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateYear} disabled={isCreating}>
                {isCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}



