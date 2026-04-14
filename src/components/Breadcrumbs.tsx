"use client";

import { ChevronRightIcon, HomeIcon } from "lucide-react";
import { usePlanYear } from "@/contexts/PlanYearContext";
import { useLabels } from "@/hooks/use-labels";
import { Badge } from "@/components/ui/badge";

interface BreadcrumbsProps {
  currentView: string;
}

const viewSections: Record<string, "plan" | "execute" | "admin"> = {
  "exec-summary": "plan",
  "wizard": "plan",
  "canvas": "plan",
  "foundation": "plan",
  "three-year": "plan",
  "one-year": "plan",
  "priority-management": "plan",
  "swot": "plan",
  "priorities": "execute",
  "metrics": "execute",
  "rocks": "execute",
  "assessments": "execute",
  "just-get-it-done": "execute",
  "personal": "execute",
  "weekly-meeting": "execute",
  "admin": "admin",
  "settings": "admin",
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
  const { getLabel } = useLabels();
  const section = viewSections[currentView] || "plan";
  const label = getLabel(`nav.${currentView}`, currentView);
  const config = { label, section };
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

