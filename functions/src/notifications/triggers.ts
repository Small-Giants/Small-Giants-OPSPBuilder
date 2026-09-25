import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { DEFAULT_COMPANY_ID, RESEND_API_KEY } from "../config";
import { db } from "../firestore";
import { dispatch } from "./dispatch";
import {
  buildDigest,
  intentsForGoalChange,
  intentsForQuarterDeadline,
  type DigestLine,
} from "./rules";
import { currentQuarter } from "./rules";
import type { Goal } from "../types";
import type { NotificationIntent } from "./types";

export const onGoalWritten = onDocumentWritten(
  {
    document: "companies/{companyId}/goals/{goalId}",
    secrets: [RESEND_API_KEY],
  },
  async (event) => {
    const before = event.data?.before.exists
      ? ({ id: event.params.goalId, ...event.data.before.data() } as Goal)
      : null;
    const after = event.data?.after.exists
      ? ({ id: event.params.goalId, ...event.data.after.data() } as Goal)
      : null;

    if (!after) return;

    const departmentLeaderId = await leaderOf(event.params.companyId, after.departmentId);

    const intents = intentsForGoalChange({
      before,
      after,
      departmentLeaderId,
      // Goal writes carry the last editor, so self-edits stay quiet.
      actorId: (after as Goal & { updatedBy?: string }).updatedBy,
    });

    if (intents.length === 0) return;

    const delivered = await dispatch(intents);
    logger.info("Goal change notifications sent", {
      goalId: event.params.goalId,
      intents: intents.length,
      delivered,
    });
  }
);

/** Weekday nudge as the quarter closes, at 9am Phoenix time. */
export const quarterDeadlineReminders = onSchedule(
  {
    schedule: "0 9 * * 1-5",
    timeZone: "America/Phoenix",
    secrets: [RESEND_API_KEY],
  },
  async () => {
    const now = new Date();
    const goals = await loadGoals(DEFAULT_COMPANY_ID, now.getFullYear());
    const intents = intentsForQuarterDeadline(goals, now);

    if (intents.length === 0) {
      logger.info("No quarter reminders due");
      return;
    }

    const delivered = await dispatch(intents);
    logger.info("Quarter reminders sent", { intents: intents.length, delivered });
  }
);

/** Monday morning summary, one email per person rather than one per goal. */
export const weeklyDigest = onSchedule(
  {
    schedule: "0 8 * * 1",
    timeZone: "America/Phoenix",
    secrets: [RESEND_API_KEY],
  },
  async () => {
    const now = new Date();
    const goals = await loadGoals(DEFAULT_COMPANY_ID, now.getFullYear());
    const quarter = currentQuarter(now);

    const byOwner = new Map<string, DigestLine[]>();
    for (const goal of goals) {
      if (!goal.ownerId) continue;
      const entry = goal.quarters?.find((q) => q.quarter === quarter);
      const target = entry?.target ?? null;
      const actual = entry?.actual ?? null;

      const percent = entry?.complete
        ? 100
        : target && actual != null
          ? Math.min(100, Math.round((actual / target) * 100))
          : 0;

      byOwner.set(goal.ownerId, [
        ...(byOwner.get(goal.ownerId) ?? []),
        {
          goalId: goal.id,
          title: goal.title,
          percent,
          needsCheckIn: !entry?.complete && actual == null,
        },
      ]);
    }

    const intents: NotificationIntent[] = [];
    for (const [ownerId, lines] of byOwner) {
      const intent = buildDigest(ownerId, lines, now);
      if (intent) intents.push(intent);
    }

    const delivered = await dispatch(intents);
    logger.info("Weekly digests sent", { recipients: intents.length, delivered });
  }
);

async function loadGoals(companyId: string, planYear: number): Promise<Goal[]> {
  const snap = await db()
    .collection(`companies/${companyId}/goals`)
    .where("planYear", "==", planYear)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Goal);
}

async function leaderOf(
  companyId: string,
  departmentId: string | null | undefined
): Promise<string | null> {
  if (!departmentId) return null;
  const snap = await db().doc(`companies/${companyId}/departments/${departmentId}`).get();
  return (snap.data()?.leaderId as string | undefined) ?? null;
}
