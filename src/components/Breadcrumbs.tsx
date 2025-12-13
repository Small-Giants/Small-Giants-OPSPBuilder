"use client";

import { ChevronRightIcon, HomeIcon } from "lucide-react";
import { usePlanYear } from "@/contexts/PlanYearContext";
import { Badge } from "@/components/ui/badge";

interface BreadcrumbsProps {
  currentView: string;
}

// Map view IDs to readable labels and their section
const viewConfig: Record<string, { label: string; section: "plan" | "execute" | "admin" }> = {
  "exec-summary": { label: "Executive Summary", section: "plan" },
  "wizard": { label: "Planning Wizard", section: "plan" },
  "canvas": { label: "Roadmap Canvas", section: "plan" },
  "foundation": { label: "Foundation", section: "plan" },
  "three-year": { label: "Three Year", section: "plan" },
  "one-year": { label: "One Year", section: "plan" },
  "priority-management": { label: "Priorities & Capabilities", section: "plan" },
  "swot": { label: "SWOT Analysis", section: "plan" },
  "priorities": { label: "Priority Execution", section: "execute" },
  "metrics": { label: "KPI Dashboard", section: "execute" },
  "rocks": { label: "My Rocks", section: "execute" },
  "assessments": { label: "Agile Growth Checklist", section: "execute" },
  "just-get-it-done": { label: "Just Get It Done", section: "execute" },
  "personal": { label: "Personal Development", section: "execute" },
  "weekly-meeting": { label: "Weekly Meeting", section: "execute" },
  "admin": { label: "Admin Panel", section: "admin" },
  "settings": { label: "Settings", section: "admin" },
};

function getCurrentQuarter(): string {
  const month = new Date().getMonth();
  if (month <= 2) return "Q1";
  if (month <= 5) return "Q2";
  if (month <= 8) return "Q3";
  return "Q4";
}

export default function Breadcrumbs({ currentView }: BreadcrumbsProps) {
  const { selectedYear } = usePlanYear();
  const config = viewConfig[currentView] || { label: currentView, section: "plan" };
  const currentQuarter = getCurrentQuarter();

  const sectionLabels = {
    plan: "Plan",
    execute: "Execute",
    admin: "Admin",
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <HomeIcon className="h-3.5 w-3.5" />
        <ChevronRightIcon className="h-3 w-3" />
        <span className="font-medium text-muted-foreground/80">
          {sectionLabels[config.section]}
        </span>
        <ChevronRightIcon className="h-3 w-3" />
        <span className="font-medium text-foreground">{config.label}</span>
      </div>
      
      <div className="flex items-center gap-1.5 ml-3">
        <Badge variant="outline" className="text-xs font-normal px-2 py-0.5">
          {selectedYear}
        </Badge>
        {config.section === "execute" && (
          <Badge 
            variant="secondary" 
            className="text-xs font-normal px-2 py-0.5 bg-accent/10 text-accent-foreground"
          >
            {currentQuarter}
          </Badge>
        )}
      </div>
    </div>
  );
}

