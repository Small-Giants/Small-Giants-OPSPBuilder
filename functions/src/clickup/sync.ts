import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { CLICKUP_API_TOKEN, DEFAULT_COMPANY_ID, RESEND_API_KEY } from "../config";
import { dispatch } from "../notifications/dispatch";
import { requireAdmin, requireCaller } from "../auth";
import { db } from "../firestore";
import { ClickUpClient, ClickUpError, type ClickUpTask } from "./client";
import {
  DEFAULT_MAPPING,
  mapSubtasksToRocks,
  mapTaskToQuarters,
  mergeQuarters,
  mergeRock,
  type ClickUpMappingConfig,
} from "./mapping";
import {
  raciMembers,
  type Goal,
  type Rock,
  type SyncLogEntry,
  type SyncLogStatus,
} from "../types";

interface SyncRequest {
  /** Sync a single goal, or omit to sync every linked goal for the plan year. */
  goalId?: string;
  planYear?: number;
}

export interface SyncResponse {
  status: SyncLogStatus;
  goalsExamined: number;
  goalsUpdated: number;
  rocksCreated: number;
  rocksUpdated: number;
  errors: { goalId: string; goalTitle: string; message: string }[];
  warnings: string[];
  finishedAt: string;
}

export const syncClickUp = onCall<SyncRequest, Promise<SyncResponse>>(
  { secrets: [CLICKUP_API_TOKEN, RESEND_API_KEY] },
  async (request) => {
    const companyId = DEFAULT_COMPANY_ID;
    const caller = await requireCaller(request);

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
    const ownsAll = goals.every((g) => raciMembers(g).includes(caller.uid));
    if (!ownsAll) requireAdmin(caller);

    const startedAt = new Date().toISOString();
    const client = new ClickUpClient({ token: CLICKUP_API_TOKEN.value() });

    const errors: SyncResponse["errors"] = [];
    const warnings: string[] = [];
    let goalsUpdated = 0;
    let rocksCreated = 0;
    let rocksUpdated = 0;

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

        const rockResult = await syncRocksForGoal(companyId, goal, task, config, syncedAt);
        rocksCreated += rockResult.created;
        rocksUpdated += rockResult.updated;

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
      await notifyAdminsOfSyncFailure(errors.length, goals.length);
    }

    return {
      status,
      goalsExamined: goals.length,
      goalsUpdated,
      rocksCreated,
      rocksUpdated,
      errors,
      warnings,
      finishedAt,
    };
  }
);

/**
 * Mirrors a goal's ClickUp subtasks into rocks on that goal.
 *
 * Rocks are matched by the subtask id rather than by name, so renaming a
 * subtask in ClickUp renames the rock instead of orphaning it and creating a
 * duplicate. A rock whose subtask disappears is left alone: deleting work
 * someone may have added RACI and notes to is not a decision a sync should
 * make on its own.
 */
async function syncRocksForGoal(
  companyId: string,
  goal: Goal,
  task: ClickUpTask,
  config: ClickUpMappingConfig,
  syncedAt: string
): Promise<{ created: number; updated: number }> {
  const { rocks: mapped } = mapSubtasksToRocks(task, config);
  if (mapped.length === 0) return { created: 0, updated: 0 };

  const rocksRef = db().collection(`companies/${companyId}/rocks`);
  const existing = await rocksRef.where("goalId", "==", goal.id).get();

  const byTaskId = new Map<string, Rock>();
  existing.docs.forEach((doc) => {
    const rock = { id: doc.id, ...doc.data() } as Rock;
    const linked = rock.clickup?.taskId;
    if (linked) byTaskId.set(linked, rock);
  });

  let created = 0;
  let updated = 0;
  const batch = db().batch();

  for (const entry of mapped) {
    const current = byTaskId.get(entry.taskId);

    if (!current) {
      batch.set(rocksRef.doc(), {
        text: entry.text,
        description: "",
        status: entry.status,
        quarter: entry.quarter,
        year: goal.planYear ?? null,
        goalId: goal.id,
        // The goal's accountable owner carries over so a synced rock is never
        // unassigned. Editable in the app afterwards.
        ownerId: goal.ownerId ?? "",
        ownerName: goal.ownerName ?? "",
        contributorIds: [],
        companyId,
        createdAt: syncedAt,
        updatedAt: syncedAt,
        updatedBy: "clickup",
        clickup: { taskId: entry.taskId, url: entry.url ?? null, lastSyncedAt: syncedAt },
      });
      created += 1;
      continue;
    }

    const { changes, changed } = mergeRock(current, entry, syncedAt);
    batch.update(rocksRef.doc(current.id), {
      ...changes,
      "clickup.lastSyncedAt": syncedAt,
    });
    if (changed) updated += 1;
  }

  await batch.commit();
  return { created, updated };
}

/** Validates a token and returns the workspaces it can see, before saving config. */
export const testClickUpConnection = onCall(
  { secrets: [CLICKUP_API_TOKEN] },
  async (request) => {
    const caller = await requireCaller(request);
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
  failed: number,
  total: number
): Promise<void> {
  const admins = await db()
    .collection("users")
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
