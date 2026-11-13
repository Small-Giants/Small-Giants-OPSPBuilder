"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { parseClickUpLocation } from "@/types";
import { Loader2 } from "lucide-react";

const DEFAULT_COMPANY_ID = "default-company";

/**
 * Where saving a department goal creates its ClickUp task. Superadmin-only,
 * enforced by firestore.rules; read by pushGoalToClickUp.
 */
export function ClickUpLocationSetting() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [savedUrl, setSavedUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const isSuperadmin = hasRole("superadmin");

  useEffect(() => {
    if (!isSuperadmin) return;
    return onSnapshot(
      doc(db, "companies", DEFAULT_COMPANY_ID, "integrations", "clickup-location"),
      (snap) => {
        const value = (snap.data()?.url as string | undefined) ?? "";
        setUrl(value);
        setSavedUrl(value);
      }
    );
  }, [isSuperadmin]);

  if (!isSuperadmin) return null;

  const parsed = url.trim() ? parseClickUpLocation(url) : null;
  const invalid = Boolean(url.trim()) && !parsed;

  const save = async () => {
    if (invalid) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "companies", DEFAULT_COMPANY_ID, "integrations", "clickup-location"), {
        url: url.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid ?? "",
      });
      toast({ title: "Saved", description: "New department goals will be created there." });
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
        <CardTitle>ClickUp goal location</CardTitle>
        <CardDescription>
          Saving a department goal creates its task here. Paste the URL of a
          ClickUp List, or of a Space that has exactly one List.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="clickup-location">List or Space URL</Label>
        <div className="flex gap-2">
          <Input
            id="clickup-location"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://app.clickup.com/14150185/v/li/901105786543"
          />
          <Button onClick={save} disabled={saving || invalid || url.trim() === savedUrl}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save
          </Button>
        </div>
        <p className={`text-xs ${invalid ? "text-destructive" : "text-muted-foreground"}`}>
          {invalid
            ? "That is not a ClickUp List or Space link. Open the List in ClickUp and copy the URL from the address bar."
            : parsed
              ? `Recognized a ClickUp ${parsed.kind} (${parsed.id}).`
              : "Not set. Department goals are saved in the app only until this is filled in."}
        </p>
      </CardContent>
    </Card>
  );
}
