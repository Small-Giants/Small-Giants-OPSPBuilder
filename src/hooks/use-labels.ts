"use client";

import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { usePlanYear } from "@/contexts/PlanYearContext";
import { useAuth } from "@/contexts/AuthContext";

const DEFAULT_LABELS: Record<string, string> = {
  "nav.exec-summary": "Executive Summary",
  "nav.wizard": "Planning Wizard",
  "nav.canvas": "Roadmap Canvas",
  "nav.foundation": "Foundation",
  "nav.three-year": "Three Year",
  "nav.one-year": "One Year",
  "nav.priority-management": "Strategic Objectives & Capabilities",
  "nav.swot": "SWOT Analysis",
  "nav.weekly-meeting": "Weekly Meeting",
  "nav.rocks": "My Tactics",
  "nav.my-rocks": "My Tactics",
  "nav.priorities": "Strategic Objective Execution",
  "nav.metrics": "KPI Dashboard",
  "nav.personal-dev": "Personal Development",
  "nav.agile-checklist": "Agile Growth Checklist",
  "nav.settings": "Settings",
  "nav.admin": "Admin Panel",

  "page.foundation.title": "Foundation",
  "page.one-year.title": "One Year",
  "page.three-year.title": "Three Year",
  "page.exec-summary.title": "Executive Summary",
  "page.priority-management.title": "Strategic Objective & Capability Management",
  "page.priorities.title": "Strategic Objective Execution",
  "page.rocks.title": "My Tactics",
  "page.swot.title": "SWOT Analysis",
  "page.weekly-meeting.title": "Weekly Meeting",
  "page.metrics.title": "KPI Dashboard",
  "page.personal-dev.title": "Personal Development",
  "page.agile-checklist.title": "Agile Growth Checklist",
};

export function useLabels() {
  const { companyId } = usePlanYear();
  const { hasRole } = useAuth();
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, "companies", companyId, "settings", "labels");
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          setOverrides(snap.data() as Record<string, string>);
        }
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [companyId]);

  const labels: Record<string, string> = { ...DEFAULT_LABELS, ...overrides };

  const getLabel = useCallback(
    (key: string, fallback?: string): string => {
      return overrides[key] ?? DEFAULT_LABELS[key] ?? fallback ?? key;
    },
    [overrides]
  );

  const updateLabel = useCallback(
    async (key: string, value: string) => {
      if (!hasRole("superadmin")) return;
      const docRef = doc(db, "companies", companyId, "settings", "labels");
      await setDoc(docRef, { [key]: value }, { merge: true });
    },
    [companyId, hasRole]
  );

  const isSuperAdmin = hasRole("superadmin");

  return { labels, getLabel, updateLabel, loading, isSuperAdmin };
}

export { DEFAULT_LABELS };
