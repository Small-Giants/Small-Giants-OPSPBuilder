import { logger } from "firebase-functions";
import { getMessaging } from "firebase-admin/messaging";
import { db } from "../firestore";
import { deepLink, sendEmail } from "./email";
import {
  channelsFor,
  DEFAULT_PREFERENCES,
  type NotificationDoc,
  type NotificationIntent,
  type NotificationPreferences,
} from "./types";
import type { UserRecord } from "../types";

/** Repeats inside this window collapse into the existing notification. */
const DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000;

export async function dispatch(intents: NotificationIntent[]): Promise<number> {
  let delivered = 0;

  // One recipient usually receives several intents from the same write.
  const byRecipient = new Map<string, NotificationIntent[]>();
  for (const intent of intents) {
    byRecipient.set(intent.recipientId, [
      ...(byRecipient.get(intent.recipientId) ?? []),
      intent,
    ]);
  }

  for (const [recipientId, list] of byRecipient) {
    const [profile, preferences] = await Promise.all([
      loadProfile(recipientId),
      loadPreferences(recipientId),
    ]);

    if (!profile || profile.deletedAt) continue;

    for (const intent of list) {
      try {
        if (await alreadySent(recipientId, intent.dedupeKey)) continue;

        const channels = channelsFor(intent.kind, preferences);
        const url = deepLink(intent.view, intent.goalId);

        if (channels.inApp) {
          const doc: NotificationDoc = {
            kind: intent.kind,
            title: intent.title,
            body: intent.body,
            view: intent.view,
            goalId: intent.goalId,
            dedupeKey: intent.dedupeKey,
            createdAt: new Date().toISOString(),
            read: false,
            url,
          };
          await db().collection(`users/${recipientId}/notifications`).add(doc);
        }

        if (channels.email && profile.email) {
          await sendEmail({
            to: profile.email,
            subject: intent.title,
            heading: intent.title,
            body: intent.body,
            ctaLabel: "Open the OPSP",
            ctaUrl: url,
          });
        }

        if (channels.push) {
          await sendPush(recipientId, intent, url);
        }

        delivered += 1;
      } catch (error) {
        // One bad recipient must not stop the rest of the fan-out.
        logger.error("Notification dispatch failed", {
          recipientId,
          kind: intent.kind,
          error: (error as Error)?.message ?? String(error),
        });
      }
    }
  }

  return delivered;
}

async function loadProfile(userId: string): Promise<UserRecord | null> {
  const snap = await db().doc(`users/${userId}`).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as UserRecord) : null;
}

async function loadPreferences(userId: string): Promise<NotificationPreferences> {
  const snap = await db().doc(`users/${userId}/settings/notifications`).get();
  if (!snap.exists) return DEFAULT_PREFERENCES;

  const stored = snap.data() as Partial<NotificationPreferences>;
  return {
    defaults: { ...DEFAULT_PREFERENCES.defaults, ...stored.defaults },
    byKind: { ...DEFAULT_PREFERENCES.byKind, ...stored.byKind },
    digestOnly: stored.digestOnly ?? DEFAULT_PREFERENCES.digestOnly,
  };
}

async function alreadySent(userId: string, dedupeKey: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
  const snap = await db()
    .collection(`users/${userId}/notifications`)
    .where("dedupeKey", "==", dedupeKey)
    .where("createdAt", ">=", cutoff)
    .limit(1)
    .get();
  return !snap.empty;
}

async function sendPush(
  userId: string,
  intent: NotificationIntent,
  url: string
): Promise<void> {
  const tokensSnap = await db().collection(`users/${userId}/pushTokens`).get();
  const tokens = tokensSnap.docs.map((d) => d.id).filter(Boolean);
  if (tokens.length === 0) return;

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title: intent.title, body: intent.body },
    webpush: {
      fcmOptions: { link: url },
      notification: { icon: "/icon-192.png", tag: intent.dedupeKey },
    },
    data: { view: intent.view, goalId: intent.goalId ?? "", url },
  });

  // Tokens go stale when a browser profile is cleared; drop them so the list
  // does not grow forever.
  const stale = response.responses
    .map((r, index) => (r.success ? null : tokens[index]))
    .filter((token): token is string => Boolean(token));

  await Promise.all(
    stale.map((token) =>
      db().doc(`users/${userId}/pushTokens/${token}`).delete().catch(() => undefined)
    )
  );
}
