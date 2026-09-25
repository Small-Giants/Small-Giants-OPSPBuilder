"use client";

import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import {
  SMART_CHAR_LIMIT,
  SMART_FIELDS,
  SMART_FIELD_LABELS,
  SMART_FIELD_PROMPTS,
  isSmartComplete,
  type SmartDescription,
  type SmartField,
} from "@/types";

interface SmartGoalFieldsProps {
  value: SmartDescription;
  onChange: (value: SmartDescription) => void;
}

export function SmartGoalFields({ value, onChange }: SmartGoalFieldsProps) {
  const setField = (field: SmartField, text: string) => {
    onChange({ ...value, [field]: text.slice(0, SMART_CHAR_LIMIT) });
  };

  const complete = isSmartComplete(value);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Describe the goal (SMART)</label>
        {complete ? (
          <Badge variant="secondary" className="gap-1 text-green-600">
            <CheckCircle2 className="w-3 h-3" />
            Complete
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">
            {SMART_FIELDS.filter((f) => value[f]?.trim()).length} of{" "}
            {SMART_FIELDS.length} answered
          </span>
        )}
      </div>

      {SMART_FIELDS.map((field) => {
        const text = value[field] ?? "";
        const remaining = SMART_CHAR_LIMIT - text.length;

        return (
          <div key={field} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <label className="text-xs font-medium">
                {SMART_FIELD_LABELS[field]}
              </label>
              <span
                className={`text-[11px] tabular-nums ${
                  remaining <= 10 ? "text-amber-600" : "text-muted-foreground"
                }`}
              >
                {remaining}
              </span>
            </div>
            <Textarea
              value={text}
              onChange={(e) => setField(field, e.target.value)}
              placeholder={SMART_FIELD_PROMPTS[field]}
              maxLength={SMART_CHAR_LIMIT}
              rows={2}
              className="resize-none text-sm"
            />
          </div>
        );
      })}
    </div>
  );
}
