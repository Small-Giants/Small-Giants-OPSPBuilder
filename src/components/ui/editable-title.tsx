"use client";

import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PencilIcon, CheckIcon, XIcon } from "lucide-react";
import { useLabels } from "@/hooks/use-labels";
import { cn } from "@/lib/utils";

interface EditableTitleProps {
  labelKey: string;
  fallback?: string;
  icon?: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3" | "span";
}

export function EditableTitle({
  labelKey,
  fallback,
  icon,
  className,
  as: Tag = "span",
}: EditableTitleProps) {
  const { getLabel, updateLabel, isSuperAdmin } = useLabels();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const currentValue = getLabel(labelKey, fallback);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEditing = () => {
    setDraft(currentValue);
    setEditing(true);
  };

  const save = async () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== currentValue) {
      await updateLabel(labelKey, trimmed);
    }
    setEditing(false);
  };

  const cancel = () => {
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  };

  if (editing) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {icon}
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={save}
          className="h-7 text-sm bg-background border-border text-foreground"
        />
        <Button
          size="sm"
          variant="ghost"
          onMouseDown={(e) => e.preventDefault()}
          onClick={save}
          className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
        >
          <CheckIcon className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onMouseDown={(e) => e.preventDefault()}
          onClick={cancel}
          className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
        >
          <XIcon className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 group", className)}>
      {icon}
      <Tag>{currentValue}</Tag>
      {isSuperAdmin && (
        <Button
          size="sm"
          variant="ghost"
          onClick={startEditing}
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
        >
          <PencilIcon className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
