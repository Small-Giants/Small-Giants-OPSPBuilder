"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";

type PlanYearContextValue = {
  companyId: string;
  selectedYear: number;
  setSelectedYear: (year: number) => Promise<void>;
  availableYears: number[];
  loading: boolean;
};

const PlanYearContext = createContext<PlanYearContextValue | undefined>(undefined);

const DEFAULT_COMPANY_ID = "caliente";
// Used to treat legacy data (no planYear field) as belonging to this year.
// Firestore queries with `where('planYear','==',null)` match missing fields as well.
export const LEGACY_PLAN_YEAR = 2025;
const LOCAL_STORAGE_KEY = "sg-opsp-activeYear";

function getInitialYear(): number {
  if (typeof window === "undefined") return new Date().getFullYear();
  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed >= 2000 && parsed <= 3000) return parsed;
  return new Date().getFullYear();
}

export function PlanYearProvider({
  children,
  companyId = DEFAULT_COMPANY_ID,
}: {
  children: React.ReactNode;
  companyId?: string;
}) {
  const [selectedYear, setSelectedYearState] = useState<number>(getInitialYear);
  const [availableYears, setAvailableYears] = useState<number[]>(() => [getInitialYear()]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubSettings: Unsubscribe | undefined;
    let unsubYears: Unsubscribe | undefined;

    // 1) Team-wide active year (company settings)
    const settingsRef = doc(db, "companies", companyId, "settings", "main");
    unsubSettings = onSnapshot(
      settingsRef,
      (snap) => {
        const data = snap.data() as { activeYear?: number } | undefined;
        const y = data?.activeYear;
        if (typeof y === "number" && Number.isFinite(y)) {
          setSelectedYearState(y);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(LOCAL_STORAGE_KEY, String(y));
          }
        }
        setLoading(false);
      },
      () => {
        // Fall back to local state; still render.
        setLoading(false);
      }
    );

    // 2) Known years list
    const yearsRef = collection(db, "companies", companyId, "years");
    unsubYears = onSnapshot(
      yearsRef,
      (snap) => {
        const years: number[] = [];
        snap.forEach((d) => {
          const id = d.id;
          const maybeYear = Number(id);
          if (Number.isFinite(maybeYear)) years.push(maybeYear);
        });
        years.sort((a, b) => a - b);
        setAvailableYears(years);
      },
      () => {
        // If years collection is missing/denied, keep fallback list.
      }
    );

    return () => {
      unsubSettings?.();
      unsubYears?.();
    };
  }, [companyId]);

  const mergedAvailableYears = useMemo(() => {
    const set = new Set<number>(availableYears);
    set.add(selectedYear);
    const arr = Array.from(set);
    arr.sort((a, b) => a - b);
    return arr;
  }, [availableYears, selectedYear]);

  const setSelectedYear = async (year: number) => {
    setSelectedYearState(year);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, String(year));
    }
    const settingsRef = doc(db, "companies", companyId, "settings", "main");
    await setDoc(settingsRef, { activeYear: year, updatedAt: new Date().toISOString() }, { merge: true });
  };

  const value: PlanYearContextValue = {
    companyId,
    selectedYear,
    setSelectedYear,
    availableYears: mergedAvailableYears,
    loading,
  };

  return <PlanYearContext.Provider value={value}>{children}</PlanYearContext.Provider>;
}

export function usePlanYear() {
  const ctx = useContext(PlanYearContext);
  if (!ctx) throw new Error("usePlanYear must be used within a PlanYearProvider");
  return ctx;
}



