"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  DEFAULT_STATEMENT_INSTRUCTIONS,
  MAX_INSTRUCTIONS_LENGTH,
} from "../../functions/src/ai/statement-instructions";

const DEFAULT_COMPANY_ID = "default-company";

/**
 * The prompt writeSmartGoal sends to Gemini. Admin-only, enforced by
 * firestore.rules. Saving the built-in text stores a blank value, so the
 * app tracks future changes to the built-in prompt until someone edits it.
 */
export function GoalStatementPromptSetting() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const [text, setText] = useState(DEFAULT_STATEMENT_INSTRUCTIONS);
  const [savedText, setSavedText] = useState(DEFAULT_STATEMENT_INSTRUCTIONS);
  const [saving, setSaving] = useState(false);
  const isAdmin = hasRole("admin");

  useEffect(() => {
    if (!isAdmin) return;
    return onSnapshot(doc(db, "companies", DEFAULT_COMPANY_ID, "ai", "goal-statement"), (snap) => {
      const value = (snap.data()?.instructions as string | undefined)?.trim() || DEFAULT_STATEMENT_INSTRUCTIONS;
      setText(value);
      setSavedText(value);
    });
  }, [isAdmin]);

  if (!isAdmin) return null;

  const trimmed = text.trim();
  const tooLong = trimmed.length > MAX_INSTRUCTIONS_LENGTH;
  const isDefault = trimmed === DEFAULT_STATEMENT_INSTRUCTIONS;

  const save = async () => {
    if (tooLong) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "companies", DEFAULT_COMPANY_ID, "ai", "goal-statement"), {
        instructions: isDefault || !trimmed ? "" : trimmed,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid ?? "",
      });
      toast({ title: "Saved", description: "The next goal statement written will use this prompt." });
    } catch (error) {
      toast({
        title: "Could not save",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Goal statement prompt</CardTitle>
        <CardDescription>
          The instructions the AI follows when it turns a goal&apos;s SMART answers
          into one sentence. The goal name and the answered SMART fields are added
          below these instructions automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="goal-statement-prompt">Prompt</Label>
        <Textarea
          id="goal-statement-prompt"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          className="font-mono text-xs"
        />
        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs ${tooLong ? "text-destructive" : "text-muted-foreground"}`}>
            {tooLong
              ? `Too long: ${trimmed.length} of ${MAX_INSTRUCTIONS_LENGTH} characters.`
              : isDefault
                ? "Using the built-in prompt."
                : "Using a custom prompt."}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setText(DEFAULT_STATEMENT_INSTRUCTIONS)}
              disabled={saving || isDefault}
            >
              Reset to built-in
            </Button>
            <Button onClick={save} disabled={saving || tooLong || trimmed === savedText.trim()}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
