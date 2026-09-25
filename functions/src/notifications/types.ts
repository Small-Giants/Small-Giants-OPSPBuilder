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

export type NotificationChannel = "inApp" | "email" | "push";

/** What the trigger decided should happen, before any channel is touched. */
export interface NotificationIntent {
  kind: NotificationKind;
  recipientId: string;
  title: string;
  body: string;
  /** Client-side view id plus optional goal, used to build the deep link. */
  view: string;
  goalId?: string;
  /**
   * Collapses duplicates. Two intents with the same key inside the dedupe
   * window produce one notification.
   */
  dedupeKey: string;
}

export interface NotificationDoc extends Omit<NotificationIntent, "recipientId"> {
  createdAt: string;
  read: boolean;
  url: string;
}

export interface ChannelPreferences {
  inApp: boolean;
  email: boolean;
  push: boolean;
}

export type NotificationPreferences = {
  /** Channels that apply unless a kind overrides them. */
  defaults: ChannelPreferences;
  byKind: Partial<Record<NotificationKind, Partial<ChannelPreferences>>>;
  /** Roll everything except weekly_digest into one Monday email. */
  digestOnly: boolean;
};

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  defaults: { inApp: true, email: true, push: false },
  byKind: {
    // High frequency and low stakes: visible in the app, not worth an email.
    quarter_updated: { email: false },
    // Only admins receive these, and they need to act on them.
    sync_failed: { email: true, push: true },
  },
  digestOnly: false,
};

export function channelsFor(
  kind: NotificationKind,
  preferences: NotificationPreferences
): ChannelPreferences {
  const base = { ...DEFAULT_PREFERENCES.defaults, ...preferences.defaults };
  const override = preferences.byKind?.[kind] ?? {};
  const resolved = { ...base, ...override };

  // Digest mode silences everything immediate except the digest itself.
  if (preferences.digestOnly && kind !== "weekly_digest") {
    return { ...resolved, email: false, push: false };
  }

  return resolved;
}
