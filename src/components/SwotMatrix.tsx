import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, XIcon, GripVerticalIcon } from "lucide-react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc, type Unsubscribe } from "firebase/firestore";
import { LEGACY_PLAN_YEAR, usePlanYear } from "@/contexts/PlanYearContext";

interface SwotItem {
  id: string;
  text: string;
}

interface SwotData {
  strengths: SwotItem[];
  weaknesses: SwotItem[];
  opportunities: SwotItem[];
  threats: SwotItem[];
}

interface SwotMatrixProps {
  data?: SwotData;
  onUpdate?: (data: SwotData) => void;
}

const DEFAULT_DATA: SwotData = {
  strengths: [],
  weaknesses: [],
  opportunities: [],
  threats: [],
};

export default function SwotMatrix({ data, onUpdate }: SwotMatrixProps) {
  const { toast } = useToast();
  const { companyId, selectedYear } = usePlanYear();
  const [localData, setLocalData] = useState<SwotData>(data ?? DEFAULT_DATA);

  useEffect(() => {
    if (data) setLocalData(data);
  }, [data]);

  const shouldConnect = !onUpdate && data === undefined;

  useEffect(() => {
    if (!shouldConnect) return;

    let unsubYear: Unsubscribe | undefined;
    let unsubLegacy: Unsubscribe | undefined;
    let useLegacy = false;

    const normalizeSection = (raw: any, section: keyof SwotData): SwotItem[] => {
      if (!Array.isArray(raw)) return [];
      if (raw.length === 0) return [];
      if (typeof raw[0] === "string") {
        return (raw as string[]).map((text, idx) => ({ id: `${section}_${idx}`, text }));
      }
      // Allow [{text}] or [{id,text}]
      return (raw as any[]).map((item, idx) => ({
        id: String(item?.id ?? `${section}_${idx}`),
        text: String(item?.text ?? ""),
      })).filter((i) => i.text.trim().length > 0);
    };

    const applyFromDoc = (docData: any) => {
      const next: SwotData = {
        strengths: normalizeSection(docData?.strengths, "strengths"),
        weaknesses: normalizeSection(docData?.weaknesses, "weaknesses"),
        opportunities: normalizeSection(docData?.opportunities, "opportunities"),
        threats: normalizeSection(docData?.threats, "threats"),
      };
      setLocalData(next);
    };

    const yearRef = doc(db, "companies", companyId, "swot", `analysis-${selectedYear}`);
    const legacyRef = doc(db, "companies", companyId, "swot", "analysis");

    unsubYear = onSnapshot(
      yearRef,
      (snap) => {
        if (snap.exists()) {
          useLegacy = false;
          applyFromDoc(snap.data());
        } else {
          useLegacy = selectedYear === LEGACY_PLAN_YEAR;
          if (selectedYear !== LEGACY_PLAN_YEAR) setLocalData(DEFAULT_DATA);
        }
      },
      (e) => {
        useLegacy = selectedYear === LEGACY_PLAN_YEAR;
      }
    );

    if (selectedYear === LEGACY_PLAN_YEAR) {
      unsubLegacy = onSnapshot(
        legacyRef,
        (snap) => {
          if (!useLegacy) return;
          if (snap.exists()) applyFromDoc(snap.data());
        },
        () => {
          // ignore
        }
      );
    }

    return () => {
      unsubYear?.();
      unsubLegacy?.();
    };
  }, [companyId, selectedYear, shouldConnect]);

  const effectiveData = data ?? localData;

  const persistIfNeeded = async (nextData: SwotData) => {
    if (!shouldConnect) return;
    try {
      const ref = doc(db, "companies", companyId, "swot", `analysis-${selectedYear}`);
      await setDoc(
        ref,
        {
          year: selectedYear,
          strengths: nextData.strengths.map((i) => i.text),
          weaknesses: nextData.weaknesses.map((i) => i.text),
          opportunities: nextData.opportunities.map((i) => i.text),
          threats: nextData.threats.map((i) => i.text),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (e: any) {
      toast({
        title: "Failed to save SWOT",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    }
  };

  const update = (next: SwotData) => {
    if (onUpdate) {
      onUpdate(next);
      return;
    }
    setLocalData(next);
    void persistIfNeeded(next);
  };

  const [editingSection, setEditingSection] = useState<keyof SwotData | null>(null);
  const [newItemText, setNewItemText] = useState("");
  const [confirmAdd, setConfirmAdd] = useState(false);

  const addItem = (section: keyof SwotData) => {
    if (!newItemText.trim() || !confirmAdd) return;
    
    const newItem: SwotItem = {
      id: `${section}_${Date.now()}`,
      text: newItemText.trim()
    };

    const updatedData: SwotData = {
      ...effectiveData,
      [section]: [...effectiveData[section], newItem],
    };

    update(updatedData);
    setNewItemText("");
    setConfirmAdd(false);
    setEditingSection(null);
  };

  const removeItem = (section: keyof SwotData, itemId: string) => {
    const updatedData: SwotData = {
      ...effectiveData,
      [section]: effectiveData[section].filter((item) => item.id !== itemId),
    };
    update(updatedData);
  };

  const getSectionConfig = (section: keyof SwotData) => {
    const configs = {
      strengths: { 
        title: "Strengths", 
        color: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800",
        badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700"
      },
      weaknesses: { 
        title: "Weaknesses", 
        color: "bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800",
        badgeColor: "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-700"
      },
      opportunities: { 
        title: "Opportunities", 
        color: "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800",
        badgeColor: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700"
      },
      threats: { 
        title: "Threats", 
        color: "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800",
        badgeColor: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700"
      }
    };
    return configs[section];
  };

  const renderSection = (section: keyof SwotData) => {
    const config = getSectionConfig(section);
    const items = effectiveData[section];

    return (
      <Card className={`${config.color} hover:border-opacity-50 transition-all duration-300`} data-testid={`card-swot-${section}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-foreground">{config.title}</CardTitle>
            <Badge className={config.badgeColor}>
              {items.length}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-2">
          {items.map((item) => (
            <div 
              key={item.id} 
              className="flex items-center gap-2 p-2 bg-background/50 rounded-md hover:bg-background/80 transition-all"
            >
              <GripVerticalIcon className="w-4 h-4 text-muted-foreground cursor-move" />
              <span className="flex-1 text-sm text-foreground">{item.text}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeItem(section, item.id)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                data-testid={`button-remove-${section}-${item.id}`}
              >
                <XIcon className="w-3 h-3" />
              </Button>
            </div>
          ))}

          {editingSection === section ? (
            <div className="space-y-2 mt-3">
              <div className="flex gap-2">
                <Input
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  placeholder={`Add ${section.slice(0, -1)}`}
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && confirmAdd && addItem(section)}
                  data-testid={`input-new-${section}`}
                />
                <Button
                  size="sm"
                  onClick={() => addItem(section)}
                  disabled={!confirmAdd || !newItemText.trim()}
                  data-testid={`button-add-${section}`}
                >
                  <PlusIcon className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingSection(null);
                    setNewItemText("");
                    setConfirmAdd(false);
                  }}
                  data-testid={`button-cancel-${section}`}
                >
                  <XIcon className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`confirm-${section}`}
                  checked={confirmAdd}
                  onChange={(e) => setConfirmAdd(e.target.checked)}
                  className="rounded border-border bg-background"
                  data-testid={`checkbox-confirm-${section}`}
                />
                <label htmlFor={`confirm-${section}`} className="text-xs text-muted-foreground">
                  Confirm to add this item
                </label>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingSection(section)}
              className="w-full mt-3"
              data-testid={`button-edit-${section}`}
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add {config.title.slice(0, -1)}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">SWOT Analysis</h2>
        <p className="text-muted-foreground">
          Analyze your organization's internal strengths and weaknesses, and external opportunities and threats
        </p>
        <ActionMenu
          onEdit={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'canvas' }))}
          onDelete={() => {}}
          editLabel="Edit SWOT on Canvas"
          deleteLabel="Delete"
          testId="action-menu-swot-canvas"
          className="mt-4"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderSection('strengths')}
        {renderSection('weaknesses')}
        {renderSection('opportunities')}
        {renderSection('threats')}
      </div>
    </div>
  );
}
