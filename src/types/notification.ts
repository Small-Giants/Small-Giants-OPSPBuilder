export const NOTIFICATION_KINDS = [
  "goal_assigned",
  "contributor_added",
  "goal_at_risk",
  "goal_completed",
  "quarter_due_soon",
  "quarter_updated",
  "sync_failed",
  "weekly_digest",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  goal_assigned: "A goal is assigned to me",
  contributor_added: "I am added as a contributor",
  goal_at_risk: "A goal I am on is flagged at risk",
  goal_completed: "A goal I am on is completed",
  quarter_due_soon: "A quarter check-in is coming due",
  quarter_updated: "Someone updates a quarter on my goals",
  sync_failed: "A ClickUp sync fails (admins only)",
  weekly_digest: "Weekly summary of my goals",
};

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  view: string;
  goalId?: string;
  url: string;
  createdAt: string;
  read: boolean;
  dedupeKey: string;
}

export interface ChannelPreferences {
  inApp: boolean;
  email: boolean;
  push: boolean;
}

export interface NotificationPreferences {
  defaults: ChannelPreferences;
  byKind: Partial<Record<NotificationKind, Partial<ChannelPreferences>>>;
  /** Collapse everything except the weekly summary into one Monday email. */
  digestOnly: boolean;
}

/** Must stay in step with DEFAULT_PREFERENCES in functions/src/notifications/types.ts. */
export const DEFAULT_PREFERENCES: NotificationPreferences = {
  defaults: { inApp: true, email: true, push: false },
  byKind: {
    quarter_updated: { email: false },
    sync_failed: { email: true, push: true },
  },
  digestOnly: false,
};

export function resolveChannels(
  kind: NotificationKind,
  preferences: NotificationPreferences
): ChannelPreferences {
  const base = { ...DEFAULT_PREFERENCES.defaults, ...preferences.defaults };
  const resolved = { ...base, ...(preferences.byKind?.[kind] ?? {}) };
  if (preferences.digestOnly && kind !== "weekly_digest") {
    return { ...resolved, email: false, push: false };
  }
  return resolved;
}
