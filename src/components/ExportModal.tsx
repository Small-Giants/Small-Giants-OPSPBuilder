"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { usePlanYear } from "@/contexts/PlanYearContext";
import { db } from "@/lib/firebase";
import { doc, collection, onSnapshot, query, where } from "firebase/firestore";
import {
  FileTextIcon,
  DownloadIcon,
  PrinterIcon,
  CheckCircle2Icon,
  Loader2Icon,
  BuildingIcon,
  TargetIcon,
  CalendarIcon,
  BarChart3Icon,
  TrendingUpIcon,
} from "lucide-react";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExportSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const EXPORT_SECTIONS: ExportSection[] = [
  {
    id: "foundation",
    label: "Foundation",
    icon: <BuildingIcon className="h-4 w-4" />,
    description: "Core purpose, mission, values, and brand promise",
  },
  {
    id: "three-year",
    label: "3-Year Direction",
    icon: <TrendingUpIcon className="h-4 w-4" />,
    description: "BHAG, strategic picture, and key differentiators",
  },
  {
    id: "one-year",
    label: "1-Year Strategy",
    icon: <TargetIcon className="h-4 w-4" />,
    description: "Annual goals, priorities, and critical numbers",
  },
  {
    id: "capabilities",
    label: "Capabilities",
    icon: <TrendingUpIcon className="h-4 w-4" />,
    description: "Key capabilities and their associated rocks",
  },
  {
    id: "quarterly",
    label: "Quarterly Rocks",
    icon: <CalendarIcon className="h-4 w-4" />,
    description: "Current quarter rocks and ownership",
  },
  {
    id: "kpis",
    label: "KPI Scoreboard",
    icon: <BarChart3Icon className="h-4 w-4" />,
    description: "Key metrics, targets, and current performance",
  },
];

function getCurrentQuarter(): string {
  const month = new Date().getMonth();
  if (month <= 2) return "Q1";
  if (month <= 5) return "Q2";
  if (month <= 8) return "Q3";
  return "Q4";
}

export default function ExportModal({ open, onOpenChange }: ExportModalProps) {
  const { toast } = useToast();
  const { companyId, selectedYear } = usePlanYear();
  const [selectedSections, setSelectedSections] = useState<string[]>(
    EXPORT_SECTIONS.map((s) => s.id)
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Data states
  const [foundationData, setFoundationData] = useState<any>(null);
  const [roadmapData, setRoadmapData] = useState<any>(null);
  const [oneYearData, setOneYearData] = useState<any>(null);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [rocks, setRocks] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);

  const currentQuarter = useMemo(() => getCurrentQuarter(), []);

  // Fetch all data when modal opens
  useEffect(() => {
    if (!open) return;

    // Foundation
    const unsubFoundation = onSnapshot(
      doc(db, "companies", companyId, "roadmap", "foundation"),
      (snap) => setFoundationData(snap.exists() ? snap.data() : null)
    );

    // 3-year (main roadmap)
    const unsubMain = onSnapshot(
      doc(db, "companies", companyId, "roadmap", "main"),
      (snap) => setRoadmapData(snap.exists() ? snap.data() : null)
    );

    // 1-year
    const unsubOneYear = onSnapshot(
      doc(db, "companies", companyId, "roadmap", `one-year-${selectedYear}`),
      (snap) => setOneYearData(snap.exists() ? snap.data() : null)
    );

    // Priorities (both priorities and capabilities)
    const prioritiesCol = collection(db, "companies", companyId, "priorities");
    const qPriorities = query(prioritiesCol, where("planYear", "==", selectedYear));
    const unsubPriorities = onSnapshot(qPriorities, (snap) => {
      const items: any[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      setPriorities(items);
    });
    
    // Also fetch priorities without planYear for backwards compatibility
    const qPrioritiesLegacy = query(prioritiesCol, where("planYear", "==", null));
    const unsubPrioritiesLegacy = onSnapshot(qPrioritiesLegacy, (snap) => {
      const items: any[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      setPriorities(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newItems = items.filter(i => !existingIds.has(i.id));
        return [...prev, ...newItems];
      });
    });

    // Rocks
    const rocksCol = collection(db, "companies", companyId, "rocks");
    const qRocks = query(rocksCol, where("year", "==", selectedYear));
    const unsubRocks = onSnapshot(qRocks, (snap) => {
      const items: any[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      setRocks(items);
    });

    // Metrics
    const metricsCol = collection(db, "companies", companyId, "metrics");
    const qMetrics = query(metricsCol, where("planYear", "==", selectedYear));
    const unsubMetrics = onSnapshot(qMetrics, (snap) => {
      const items: any[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      setMetrics(items);
    });

    return () => {
      unsubFoundation();
      unsubMain();
      unsubOneYear();
      unsubPriorities();
      unsubPrioritiesLegacy();
      unsubRocks();
      unsubMetrics();
    };
  }, [open, companyId, selectedYear]);

  const toggleSection = (sectionId: string) => {
    setSelectedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const quarterRocks = useMemo(
    () => rocks.filter((r) => (r.quarter || "Q1") === currentQuarter),
    [rocks, currentQuarter]
  );

  const generatePDFContent = () => {
    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Strategic Roadmap - ${selectedYear}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Roboto+Slab:wght@400;500;600;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'DM Sans', sans-serif;
      color: #4A5D62;
      line-height: 1.5;
      background: #fff;
    }
    
    .page {
      width: 100%;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px;
      page-break-after: always;
    }
    
    .page:last-child {
      page-break-after: avoid;
    }
    
    .header {
      background: linear-gradient(45deg, #319899, #35D3CC);
      color: white;
      padding: 30px 40px;
      border-radius: 12px;
      margin-bottom: 30px;
    }
    
    .header h1 {
      font-family: 'Roboto Slab', serif;
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    
    .header .subtitle {
      font-size: 14px;
      opacity: 0.9;
    }
    
    .header .meta {
      margin-top: 16px;
      display: flex;
      gap: 20px;
      font-size: 13px;
    }
    
    .header .meta span {
      background: rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 4px;
    }
    
    .section {
      margin-bottom: 30px;
    }
    
    .section-title {
      font-family: 'Roboto Slab', serif;
      font-size: 18px;
      font-weight: 600;
      color: #319899;
      border-bottom: 2px solid #35D3CC;
      padding-bottom: 8px;
      margin-bottom: 16px;
    }
    
    .card {
      background: #f8fafb;
      border: 1px solid #e5e9eb;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }
    
    .card-title {
      font-size: 13px;
      font-weight: 600;
      color: #727272;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    
    .card-content {
      font-size: 15px;
      color: #4A5D62;
    }
    
    .card-content.empty {
      color: #999;
      font-style: italic;
    }
    
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    
    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
    }
    
    .value-card {
      background: #fff;
      border-left: 4px solid #35D3CC;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .value-card h4 {
      font-size: 14px;
      font-weight: 600;
      color: #4A5D62;
      margin-bottom: 4px;
    }
    
    .value-card p {
      font-size: 13px;
      color: #727272;
    }
    
    .priority-item {
      background: #fff;
      border: 1px solid #e5e9eb;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 8px;
    }
    
    .priority-item .number {
      display: inline-block;
      width: 24px;
      height: 24px;
      background: #319899;
      color: #fff;
      text-align: center;
      line-height: 24px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      margin-right: 12px;
    }
    
    .priority-item .title {
      font-weight: 600;
      color: #4A5D62;
    }
    
    .priority-item .description {
      font-size: 13px;
      color: #727272;
      margin-top: 4px;
      margin-left: 36px;
    }
    
    .rock-item {
      display: flex;
      align-items: flex-start;
      padding: 8px 0;
      border-bottom: 1px solid #e5e9eb;
    }
    
    .rock-item:last-child {
      border-bottom: none;
    }
    
    .rock-status {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 12px;
      margin-top: 5px;
      flex-shrink: 0;
    }
    
    .rock-status.complete { background: #22c55e; }
    .rock-status.in-progress { background: #3b82f6; }
    .rock-status.not-started { background: #94a3b8; }
    
    .rock-text {
      flex: 1;
    }
    
    .rock-text .text {
      font-size: 14px;
      color: #4A5D62;
    }
    
    .rock-text .meta {
      font-size: 12px;
      color: #727272;
      margin-top: 2px;
    }
    
    .kpi-card {
      background: #fff;
      border: 1px solid #e5e9eb;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    
    .kpi-name {
      font-size: 13px;
      font-weight: 600;
      color: #727272;
      margin-bottom: 8px;
    }
    
    .kpi-value {
      font-size: 24px;
      font-weight: 700;
      color: #319899;
    }
    
    .kpi-unit {
      font-size: 14px;
      color: #727272;
    }
    
    .kpi-target {
      font-size: 12px;
      color: #999;
      margin-top: 4px;
    }
    
    .kpi-status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      margin-top: 8px;
    }
    
    .kpi-status.green { background: #dcfce7; color: #16a34a; }
    .kpi-status.yellow { background: #fef9c3; color: #ca8a04; }
    .kpi-status.red { background: #fee2e2; color: #dc2626; }
    
    .footer {
      text-align: center;
      padding: 20px;
      color: #999;
      font-size: 12px;
      border-top: 1px solid #e5e9eb;
      margin-top: 40px;
    }
    
    .footer .logo {
      color: #319899;
      font-weight: 600;
    }
    
    @media print {
      .page {
        padding: 20px;
        max-width: 100%;
      }
      
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>7 Attributes of Agile Growth Roadmap</h1>
      <div class="subtitle">Strategic Planning & Execution Framework</div>
      <div class="meta">
        <span>${selectedYear} Annual Plan</span>
        <span>${currentQuarter} Execution</span>
        <span>Generated: ${today}</span>
      </div>
    </div>
`;

    // Foundation Section
    if (selectedSections.includes("foundation") && foundationData) {
      content += `
    <div class="section">
      <div class="section-title">Foundation</div>
      <div class="grid-2">
        <div class="card">
          <div class="card-title">Core Purpose</div>
          <div class="card-content ${!foundationData.corePurpose ? "empty" : ""}">
            ${foundationData.corePurpose || "Not defined"}
          </div>
        </div>
        <div class="card">
          <div class="card-title">Mission</div>
          <div class="card-content ${!foundationData.mission ? "empty" : ""}">
            ${foundationData.mission || "Not defined"}
          </div>
        </div>
        <div class="card">
          <div class="card-title">Core Customer</div>
          <div class="card-content ${!foundationData.coreCustomer ? "empty" : ""}">
            ${foundationData.coreCustomer || "Not defined"}
          </div>
        </div>
        <div class="card">
          <div class="card-title">Brand Promise</div>
          <div class="card-content ${!foundationData.brandPromise ? "empty" : ""}">
            ${foundationData.brandPromise || "Not defined"}
          </div>
        </div>
      </div>
      
      ${
        foundationData.coreValues?.length > 0
          ? `
      <div class="section-title" style="margin-top: 20px;">Core Values</div>
      <div class="grid-2">
        ${foundationData.coreValues
          .map(
            (v: any) => `
          <div class="value-card">
            <h4>${v.name || "-"}</h4>
            <p>${v.description || ""}</p>
          </div>
        `
          )
          .join("")}
      </div>
      `
          : ""
      }
    </div>
`;
    }

    // 3-Year Section
    if (selectedSections.includes("three-year") && roadmapData) {
      content += `
    <div class="section">
      <div class="section-title">3-Year Strategic Direction</div>
      <div class="card">
        <div class="card-title">BHAG (Big Hairy Audacious Goal)</div>
        <div class="card-content ${!roadmapData.bhag ? "empty" : ""}">
          ${roadmapData.bhag || "Not defined"}
        </div>
      </div>
      <div class="card">
        <div class="card-title">3-Year Strategic Picture</div>
        <div class="card-content ${!roadmapData.threeHagStatement ? "empty" : ""}">
          ${roadmapData.threeHagStatement || "Not defined"}
        </div>
      </div>
      ${
        roadmapData.knownFor
          ? `
      <div class="card">
        <div class="card-title">What We Want to Be Known For</div>
        <div class="card-content">${roadmapData.knownFor}</div>
      </div>
      `
          : ""
      }
    </div>
`;
    }

    // 1-Year Section
    if (selectedSections.includes("one-year") && (oneYearData || priorities.length > 0)) {
      const annualPriorities = priorities.filter((p) => p.type === "priority");

      content += `
    <div class="section">
      <div class="section-title">${selectedYear} Annual Plan</div>
      
      ${
        oneYearData?.onePhraseStrategy
          ? `
      <div class="card">
        <div class="card-title">One Phrase Strategy</div>
        <div class="card-content">${oneYearData.onePhraseStrategy}</div>
      </div>
      `
          : ""
      }
      
      ${
        annualPriorities.length > 0
          ? `
      <div style="margin-top: 16px;">
        <div class="card-title">Annual Priorities</div>
        ${annualPriorities
          .map(
            (p: any, idx: number) => `
          <div class="priority-item">
            <span class="number">${idx + 1}</span>
            <span class="title">${p.title || "-"}</span>
            ${p.description ? `<div class="description">${p.description}</div>` : ""}
          </div>
        `
          )
          .join("")}
      </div>
      `
          : ""
      }
      
      ${
        oneYearData?.criticalNumbers
          ? `
      <div style="margin-top: 20px;">
        <div class="card-title">Critical Numbers</div>
        <div class="grid-3">
          ${Object.entries(oneYearData.criticalNumbers)
            .filter(([_, v]: [string, any]) => v?.value)
            .map(
              ([key, v]: [string, any]) => `
            <div class="card" style="text-align: center;">
              <div class="card-title">${v.label || key}</div>
              <div class="card-content" style="font-size: 18px; font-weight: 600;">${v.value}</div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
      `
          : ""
      }
    </div>
`;
    }

    // Capabilities Section
    if (selectedSections.includes("capabilities")) {
      const capabilities = priorities.filter((p) => p.type === "capability");
      if (capabilities.length > 0) {
        content += `
    <div class="section">
      <div class="section-title">Key Capabilities</div>
      ${capabilities
        .map(
          (c: any, idx: number) => {
            const capabilityRocks = rocks.filter((r: any) => r.priorityId === c.id);
            return `
        <div class="card" style="margin-bottom: 16px;">
          <div class="card-title" style="display: flex; align-items: center; gap: 8px;">
            <span style="background: #319899; color: white; width: 20px; height: 20px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px;">${idx + 1}</span>
            ${c.title || "-"}
          </div>
          <div class="card-content">${c.description || ""}</div>
          ${c.executiveChampion ? `<div style="font-size: 12px; color: #727272; margin-top: 8px;">Champion: ${c.executiveChampion}</div>` : ""}
          ${capabilityRocks.length > 0 ? `
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e9eb;">
            <div style="font-size: 11px; color: #727272; margin-bottom: 8px;">Associated Rocks (${capabilityRocks.length})</div>
            ${capabilityRocks.slice(0, 5).map((r: any) => `
              <div style="font-size: 13px; padding: 4px 0; display: flex; align-items: flex-start; gap: 8px;">
                <span style="width: 6px; height: 6px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; background: ${r.status === 'complete' ? '#22c55e' : r.status === 'in_progress' ? '#3b82f6' : '#94a3b8'};"></span>
                <span>${r.text || "-"}</span>
              </div>
            `).join("")}
          </div>
          ` : ""}
        </div>
      `;
          }
        )
        .join("")}
    </div>
`;
      }
    }

    // Quarterly Rocks Section
    if (selectedSections.includes("quarterly") && quarterRocks.length > 0) {
      content += `
  </div>
  <div class="page">
    <div class="section">
      <div class="section-title">${currentQuarter} ${selectedYear} Rocks</div>
      <div class="card">
        ${quarterRocks
          .map((rock: any) => {
            const statusClass =
              rock.status === "complete"
                ? "complete"
                : rock.status === "in_progress"
                ? "in-progress"
                : "not-started";
            return `
          <div class="rock-item">
            <div class="rock-status ${statusClass}"></div>
            <div class="rock-text">
              <div class="text">${rock.text || "-"}</div>
              <div class="meta">
                ${rock.assigneeName ? `Owner: ${rock.assigneeName}` : "Unassigned"}
                ${rock.status ? ` • ${rock.status.replace("_", " ")}` : ""}
              </div>
            </div>
          </div>
        `;
          })
          .join("")}
      </div>
      <div style="margin-top: 12px; text-align: right; font-size: 13px; color: #727272;">
        ${quarterRocks.filter((r: any) => r.status === "complete").length} of ${
        quarterRocks.length
      } complete (${Math.round(
        (quarterRocks.filter((r: any) => r.status === "complete").length / quarterRocks.length) *
          100
      )}%)
      </div>
    </div>
`;
    }

    // KPIs Section
    if (selectedSections.includes("kpis") && metrics.length > 0) {
      content += `
    <div class="section">
      <div class="section-title">KPI Scoreboard</div>
      <div class="grid-3">
        ${metrics
          .map((m: any) => {
            const pct = m.targetValue > 0 ? (m.currentValue / m.targetValue) * 100 : 0;
            const statusClass = pct >= 100 ? "green" : pct >= 75 ? "yellow" : "red";
            return `
          <div class="kpi-card">
            <div class="kpi-name">${m.name || "-"}</div>
            <div class="kpi-value">${(m.currentValue || 0).toLocaleString()}</div>
            <div class="kpi-unit">${m.unit || ""}</div>
            <div class="kpi-target">Target: ${(m.targetValue || 0).toLocaleString()}</div>
            <div class="kpi-status ${statusClass}">${Math.round(pct)}% of target</div>
          </div>
        `;
          })
          .join("")}
      </div>
    </div>
`;
    }

    // Footer
    content += `
    <div class="footer">
      <div class="logo">Small Giants</div>
      <div>7 Attributes of Agile Growth Framework</div>
    </div>
  </div>
</body>
</html>
`;

    return content;
  };

  const handleExport = async () => {
    if (selectedSections.length === 0) {
      toast({
        title: "No sections selected",
        description: "Please select at least one section to export.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setProgress(10);

    try {
      // Generate HTML content
      const htmlContent = generatePDFContent();
      setProgress(50);

      // Create a new window/tab with the content for printing
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setProgress(80);

        // Wait for content to load then trigger print
        setTimeout(() => {
          printWindow.print();
          setProgress(100);

          toast({
            title: "Export ready",
            description: "Your strategic roadmap is ready to print or save as PDF.",
          });

          setTimeout(() => {
            setIsGenerating(false);
            setProgress(0);
          }, 500);
        }, 500);
      } else {
        throw new Error("Could not open print window. Please allow popups.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate export. Please try again.";
      toast({
        title: "Export failed",
        description: message.includes("popup") 
          ? "Popup was blocked. Please allow popups for this site, or use 'Download HTML' instead."
          : message,
        variant: "destructive",
      });
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const handleDownloadHTML = () => {
    const htmlContent = generatePDFContent();
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Strategic-Roadmap-${selectedYear}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: "HTML file downloaded. Open it in a browser and print to PDF.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5" />
            Export Strategic Roadmap
          </DialogTitle>
          <DialogDescription>
            Generate a branded PDF of your {selectedYear} strategic plan and execution pack.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Section Selection */}
          <div className="space-y-3">
            <div className="text-sm font-medium">Select sections to include:</div>
            {EXPORT_SECTIONS.map((section) => (
              <div
                key={section.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  id={section.id}
                  checked={selectedSections.includes(section.id)}
                  onCheckedChange={() => toggleSection(section.id)}
                />
                <label htmlFor={section.id} className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    {section.icon}
                    <span className="font-medium text-sm">{section.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{section.description}</p>
                </label>
              </div>
            ))}
          </div>

          <Separator />

          {/* Quick Actions */}
          <div className="flex items-center justify-between text-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedSections(EXPORT_SECTIONS.map((s) => s.id))}
            >
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedSections([])}>
              Clear All
            </Button>
          </div>

          {/* Progress */}
          {isGenerating && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="h-4 w-4 animate-spin" />
                Generating export...
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button onClick={handleExport} disabled={isGenerating || selectedSections.length === 0}>
            {isGenerating ? (
              <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <PrinterIcon className="h-4 w-4 mr-2" />
            )}
            Print / Save as PDF
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadHTML}
            disabled={isGenerating || selectedSections.length === 0}
          >
            <DownloadIcon className="h-4 w-4 mr-2" />
            Download HTML
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

