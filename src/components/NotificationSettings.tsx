"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { checkPushSupport, disablePush, enablePush } from "@/lib/push";
import {
  DEFAULT_PREFERENCES,
  NOTIFICATION_KINDS,
  NOTIFICATION_KIND_LABELS,
  resolveChannels,
  type NotificationKind,
  type NotificationPreferences,
} from "@/types";
import { BellIcon, Loader2, Smartphone } from "lucide-react";

const PUSH_TOKEN_STORAGE_KEY = "opsp:pushToken";

export default function NotificationSettings() {
  const { toast } = useToast();
  const { user, hasRole } = useAuth();

  const [preferences, setPreferences] =
    useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [saving, setSaving] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const pushSupport = checkPushSupport();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPushToken(window.localStorage.getItem(PUSH_TOKEN_STORAGE_KEY));
    }
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    return onSnapshot(
      doc(db, "users", user.uid, "settings", "notifications"),
      (snap) => {
        if (!snap.exists()) return;
        const stored = snap.data() as Partial<NotificationPreferences>;
        setPreferences({
          defaults: { ...DEFAULT_PREFERENCES.defaults, ...stored.defaults },
          byKind: { ...DEFAULT_PREFERENCES.byKind, ...stored.byKind },
          digestOnly: stored.digestOnly ?? false,
        });
      }
    );
  }, [user?.uid]);

  const save = async (next: NotificationPreferences) => {
    if (!user?.uid) return;
    setPreferences(next);
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid, "settings", "notifications"), next);
    } catch (error: any) {
      toast({
        title: "Could not save",
        description: error?.message ?? "Unknown error.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const setKindChannel = (
    kind: NotificationKind,
    channel: "inApp" | "email" | "push",
    value: boolean
  ) =>
    save({
      ...preferences,
      byKind: {
        ...preferences.byKind,
        [kind]: { ...preferences.byKind?.[kind], [channel]: value },
      },
    });

  const togglePush = async () => {
    if (!user?.uid) return;
    setPushBusy(true);
    try {
      if (pushToken) {
        await disablePush(user.uid, pushToken);
        window.localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
        setPushToken(null);
        toast({ title: "Push turned off for this browser" });
      } else {
        const token = await enablePush(user.uid);
        window.localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
        setPushToken(token);
        toast({
          title: "Push enabled",
          description: "This browser will now receive notifications.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Push not enabled",
        description: error?.message ?? "Unknown error.",
        variant: "destructive",
      });
    } finally {
      setPushBusy(false);
    }
  };

  const visibleKinds = NOTIFICATION_KINDS.filter(
    (kind) => kind !== "sync_failed" || hasRole("admin")
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BellIcon className="w-6 h-6" />
          Notifications
        </h2>
        <p className="text-muted-foreground text-sm">
          Choose what reaches you and how. These settings are yours alone.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Push on this browser
              </CardTitle>
              <CardDescription>
                {pushSupport.supported
                  ? "Notifications appear even when the OPSP tab is closed. Enable this on each browser you use."
                  : pushSupport.reason}
              </CardDescription>
            </div>
            <Button
              variant={pushToken ? "outline" : "default"}
              onClick={togglePush}
              disabled={!pushSupport.supported || pushBusy}
            >
              {pushBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {pushToken ? "Turn off" : "Enable push"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Weekly digest only</CardTitle>
              <CardDescription>
                Hold email and push, and send one Monday summary instead. The
                in-app inbox keeps working as normal.
              </CardDescription>
            </div>
            <Switch
              checked={preferences.digestOnly}
              onCheckedChange={(digestOnly) => save({ ...preferences, digestOnly })}
            />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">What to send</CardTitle>
          <CardDescription>
            {preferences.digestOnly
              ? "Email and push are paused while the weekly digest is on."
              : "Per event type. Unchecked boxes stay out of your way entirely."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 gap-y-1 items-center text-xs text-muted-foreground pb-2">
            <span />
            <span className="w-12 text-center">In app</span>
            <span className="w-12 text-center">Email</span>
            <span className="w-12 text-center">Push</span>
          </div>
          <Separator />
          {visibleKinds.map((kind) => {
            const channels = resolveChannels(kind, preferences);
            const locked = preferences.digestOnly && kind !== "weekly_digest";
            return (
              <div
                key={kind}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 items-center py-2 border-b last:border-b-0"
              >
                <Label htmlFor={`${kind}-inApp`} className="text-sm font-normal">
                  {NOTIFICATION_KIND_LABELS[kind]}
                </Label>
                {(["inApp", "email", "push"] as const).map((channel) => (
                  <div key={channel} className="w-12 flex justify-center">
                    <Checkbox
                      id={`${kind}-${channel}`}
                      checked={channels[channel]}
                      disabled={saving || (locked && channel !== "inApp")}
                      onCheckedChange={(checked) =>
                        setKindChannel(kind, channel, checked === true)
                      }
                      aria-label={`${NOTIFICATION_KIND_LABELS[kind]} via ${channel}`}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
