import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { CLICKUP_API_TOKEN, DEFAULT_COMPANY_ID, RESEND_API_KEY } from "../config";
import { dispatch } from "../notifications/dispatch";
import { requireAdmin, requireCaller } from "../auth";
import { db } from "../firestore";
import { ClickUpClient, ClickUpError } from "./client";
import {
  DEFAULT_MAPPING,
  mapTaskToQuarters,
  mergeQuarters,
  type ClickUpMappingConfig,
} from "./mapping";
import type { Goal, SyncLogEntry, SyncLogStatus } from "../types";

interface SyncRequest {
  /** Sync a single goal, or omit to sync every linked goal for the plan year. */
  goalId?: string;
  planYear?: number;
}

export interface SyncResponse {
  status: SyncLogStatus;
  goalsExamined: number;
  goalsUpdated: number;
  errors: { goalId: string; goalTitle: string; message: string }[];
  warnings: string[];
  finishedAt: string;
}

export const syncClickUp = onCall<SyncRequest, Promise<SyncResponse>>(
  { secrets: [CLICKUP_API_TOKEN, RESEND_API_KEY] },
  async (request) => {
    const companyId = DEFAULT_COMPANY_ID;
    const caller = await requireCaller(request, companyId);

    const config = await loadMapping(companyId);
    if (!config.enabled) {
      throw new HttpsError(
        "failed-precondition",
        "The ClickUp integration is turned off. An admin can enable it under Admin, Integrations."
      );
    }

    const goals = await loadLinkedGoals(companyId, request.data ?? {});
    if (goals.length === 0) {
      throw new HttpsError(
        "not-found",
        "No goals are linked to a ClickUp task yet. Add a task link on a goal first."
      );
    }

    // Syncing someone else's goal is an admin action; syncing your own is not.
    const ownsAll = goals.every(
      (g) => g.ownerId === caller.uid || (g.contributorIds ?? []).includes(caller.uid)
    );
    if (!ownsAll) requireAdmin(caller);

    const startedAt = new Date().toISOString();
    const client = new ClickUpClient({ token: CLICKUP_API_TOKEN.value() });

    const errors: SyncResponse["errors"] = [];
    const warnings: string[] = [];
    let goalsUpdated = 0;

    for (const goal of goals) {
      const taskId = goal.clickup?.taskId;
      if (!taskId) continue;

      try {
        const task = await client.getTask(taskId);
        const { quarters: mapped, unplacedSubtasks } = mapTaskToQuarters(task, goal, config);

        if (unplacedSubtasks.length > 0) {
          warnings.push(
            `${goal.title}: ${unplacedSubtasks.length} subtask(s) have no quarter or due date and were skipped.`
          );
        }

        const syncedAt = new Date().toISOString();
        const { quarters, changed } = mergeQuarters(goal.quarters ?? [], mapped, syncedAt);

        const update: Record<string, unknown> = {
          "clickup.lastSyncedAt": syncedAt,
          "clickup.lastSyncError": null,
          "clickup.url": task.url ?? goal.clickup?.url ?? null,
          updatedAt: syncedAt,
        };
        if (changed) {
          update.quarters = quarters;
          goalsUpdated += 1;
        }

        await db().doc(`companies/${companyId}/goals/${goal.id}`).update(update);
      } catch (error) {
        const message =
          error instanceof ClickUpError
            ? error.message
            : `Unexpected failure: ${(error as Error)?.message ?? error}`;

        logger.error("ClickUp sync failed for goal", { goalId: goal.id, message });
        errors.push({ goalId: goal.id, goalTitle: goal.title, message });

        // Record the failure on the goal so the UI can show it without a log dive.
        await db()
          .doc(`companies/${companyId}/goals/${goal.id}`)
          .update({ "clickup.lastSyncError": message })
          .catch(() => undefined);
      }
    }

    const finishedAt = new Date().toISOString();
    const status: SyncLogStatus =
      errors.length === 0 ? "success" : errors.length === goals.length ? "error" : "partial";

    const entry: SyncLogEntry = {
      startedAt,
      finishedAt,
      triggeredBy: caller.email,
      source: "clickup",
      status,
      goalsExamined: goals.length,
      goalsUpdated,
      errors: errors.map(({ goalId, message }) => ({ goalId, message })),
    };
    await db().collection(`companies/${companyId}/syncLogs`).add(entry);

    if (status !== "success") {
      await notifyAdminsOfSyncFailure(companyId, errors.length, goals.length);
    }

    return {
      status,
      goalsExamined: goals.length,
      goalsUpdated,
      errors,
      warnings,
      finishedAt,
    };
  }
);

/** Validates a token and returns the workspaces it can see, before saving config. */
export const testClickUpConnection = onCall(
  { secrets: [CLICKUP_API_TOKEN] },
  async (request) => {
    const caller = await requireCaller(request, DEFAULT_COMPANY_ID);
    requireAdmin(caller);

    const token = CLICKUP_API_TOKEN.value();
    if (!token) {
      throw new HttpsError(
        "failed-precondition",
        "No ClickUp token is stored. Run `firebase functions:secrets:set CLICKUP_API_TOKEN`."
      );
    }

    try {
      const { user } = await new ClickUpClient({ token }).getAuthorizedUser();
      return { ok: true, connectedAs: user.email ?? user.username ?? String(user.id) };
    } catch (error) {
      const message = error instanceof ClickUpError ? error.message : String(error);
      throw new HttpsError("failed-precondition", message);
    }
  }
);

async function notifyAdminsOfSyncFailure(
  companyId: string,
  failed: number,
  total: number
): Promise<void> {
  const admins = await db()
    .collection(`companies/${companyId}/users`)
    .where("role", "in", ["admin", "superadmin"])
    .get();

  const stamp = new Date().toISOString().slice(0, 13);
  await dispatch(
    admins.docs
      .filter((doc) => !doc.data().deletedAt)
      .map((doc) => ({
        kind: "sync_failed" as const,
        recipientId: doc.id,
        title: "ClickUp sync had failures",
        body: `${failed} of ${total} goal(s) could not be synced. Check Admin, Integrations for the error.`,
        view: "integrations",
        // Hourly at most, however many syncs are attempted.
        dedupeKey: `sync_failed:${stamp}:${doc.id}`,
      }))
  );
}

async function loadMapping(companyId: string): Promise<ClickUpMappingConfig> {
  const snap = await db().doc(`companies/${companyId}/integrations/clickup`).get();
  if (!snap.exists) return DEFAULT_MAPPING;
  return { ...DEFAULT_MAPPING, ...(snap.data() as Partial<ClickUpMappingConfig>) };
}

async function loadLinkedGoals(
  companyId: string,
  { goalId, planYear }: SyncRequest
): Promise<Goal[]> {
  const goals = db().collection(`companies/${companyId}/goals`);

  if (goalId) {
    const snap = await goals.doc(goalId).get();
    if (!snap.exists) throw new HttpsError("not-found", "That goal no longer exists.");
    const goal = { id: snap.id, ...snap.data() } as Goal;
    if (!goal.clickup?.taskId) {
      throw new HttpsError("failed-precondition", "That goal is not linked to a ClickUp task.");
    }
    return [goal];
  }

  // Filtering the link in memory keeps this to a single-field query, so no
  // composite index has to be kept in step with the schema.
  const snap = planYear
    ? await goals.where("planYear", "==", planYear).get()
    : await goals.get();

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Goal)
    .filter((g) => Boolean(g.clickup?.taskId));
}
