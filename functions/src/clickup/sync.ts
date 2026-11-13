import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { CLICKUP_API_TOKEN, DEFAULT_COMPANY_ID, RESEND_API_KEY } from "../config";
import { dispatch } from "../notifications/dispatch";
import { requireAdmin, requireCaller } from "../auth";
import { db } from "../firestore";
import { planRockChanges } from "./agent-rocks";
import { ClickUpClient, ClickUpError, type ClickUpComment } from "./client";
import { loadDirectory, refreshMembers, syncPeople } from "./members";
import type { Person } from "./people";
import {
  applyRecapToQuarters,
  commentText,
  commentUrl,
  findRecaps,
  isApprovalReply,
  parseRecap,
  type ParsedRecap,
} from "./recap";
import { loadGoalLocation, loadSettings, type ClickUpSettings } from "./settings";
import type {
  Goal,
  GoalQuarter,
  GoalRecap,
  GoalStatus,
  RecapApproval,
  Rock,
  SyncLogEntry,
  SyncLogStatus,
  UserRecord,
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
  recapsApplied: number;
  recapsPending: number;
  rocksCreated: number;
  rocksUpdated: number;
  errors: { goalId: string; goalTitle: string; message: string }[];
  warnings: string[];
  finishedAt: string;
}

const SCHEDULE_TIME_ZONE = "America/Phoenix";

/**
 * Applies the monthly recaps the ClickUp agent posts on each goal's task. A
 * recap only applies once the goal's Accountable person (or an admin) has
 * approved it, either by replying "Approved" in ClickUp or in the app.
 */
export const syncClickUp = onCall<SyncRequest, Promise<SyncResponse>>(
  { secrets: [CLICKUP_API_TOKEN, RESEND_API_KEY], timeoutSeconds: 300 },
  async (request) => {
    const caller = await requireCaller(request);
    requireAdmin(caller);
    const { goalId, planYear } = request.data ?? {};
    return runSync({
      trigger: "manual",
      triggeredBy: caller.email,
      goalId,
      planYears: planYear ? [planYear] : undefined,
    });
  }
);

/**
 * Runs every Friday morning but only acts on the first Friday of the month,
 * and only if no admin has already synced by hand since the month began.
 */
export const scheduledClickUpSync = onSchedule(
  {
    schedule: "0 7 * * 5",
    timeZone: SCHEDULE_TIME_ZONE,
    secrets: [CLICKUP_API_TOKEN, RESEND_API_KEY],
    timeoutSeconds: 540,
  },
  async () => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: SCHEDULE_TIME_ZONE,
        year: "numeric",
        month: "numeric",
        day: "numeric",
      })
        .formatToParts(new Date())
        .map((p) => [p.type, Number(p.value)])
    ) as { year: number; month: number; day: number };

    if (parts.day > 7) return;

    // Phoenix has no daylight saving, so local midnight is always 07:00 UTC.
    const monthStart = new Date(Date.UTC(parts.year, parts.month - 1, 1, 7)).toISOString();
    const recent = await db()
      .collection(`companies/${DEFAULT_COMPANY_ID}/syncLogs`)
      .where("finishedAt", ">=", monthStart)
      .get();
    if (recent.docs.some((doc) => doc.data().trigger === "manual")) {
      logger.info("Skipping scheduled ClickUp sync: an admin already synced this month.");
      return;
    }

    // December's recap is posted in January, so January also covers last year.
    const planYears = parts.month === 1 ? [parts.year, parts.year - 1] : [parts.year];
    await runSync({ trigger: "scheduled", triggeredBy: "First-Friday schedule", planYears }).catch(
      (error) => {
        // No linked goals is not worth an alert from an unattended job.
        if (!(error instanceof HttpsError)) throw error;
        logger.info(`Scheduled ClickUp sync did nothing: ${error.message}`);
      }
    );
  }
);

export async function runSync(options: {
  trigger: "manual" | "scheduled";
  triggeredBy: string;
  goalId?: string;
  planYears?: number[];
}): Promise<SyncResponse> {
  const companyId = DEFAULT_COMPANY_ID;
  const settings = await loadSettings(companyId);
  if (!settings.enabled) {
    throw new HttpsError(
      "failed-precondition",
      "The ClickUp integration is turned off. An admin can enable it under Admin, Integrations."
    );
  }

  const goals = await loadLinkedGoals(companyId, options);
  if (goals.length === 0) {
    throw new HttpsError(
      "not-found",
      "No goals are linked to a ClickUp task yet. Create a department goal or add a task link first."
    );
  }

  const startedAt = new Date().toISOString();
  const client = new ClickUpClient({ token: CLICKUP_API_TOKEN.value() });
  const location = await loadGoalLocation(companyId);
  const members = await refreshMembers(client, companyId, location?.workspaceId).catch((error) => {
    logger.warn("Could not refresh ClickUp members; using the stored list.", { error: String(error) });
    return undefined;
  });
  const { directory, users } = await loadDirectory(companyId, members);

  const totals = { goalsUpdated: 0, recapsApplied: 0, recapsPending: 0, rocksCreated: 0, rocksUpdated: 0 };
  const errors: SyncResponse["errors"] = [];
  const warnings: string[] = [];

  for (const goal of goals) {
    try {
      const result = await syncGoal(client, companyId, goal, settings, directory, users);
      totals.recapsApplied += result.applied;
      totals.recapsPending += result.pending ? 1 : 0;
      totals.rocksCreated += result.rocksCreated;
      totals.rocksUpdated += result.rocksUpdated;
      if (result.changed) totals.goalsUpdated += 1;
      warnings.push(...result.warnings);
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

  const entry: SyncLogEntry & Record<string, unknown> = {
    startedAt,
    finishedAt,
    triggeredBy: options.triggeredBy,
    trigger: options.trigger,
    source: "clickup",
    status,
    goalsExamined: goals.length,
    goalsUpdated: totals.goalsUpdated,
    recapsFound: totals.recapsApplied + totals.recapsPending,
    recapsApplied: totals.recapsApplied,
    recapsPending: totals.recapsPending,
    errors: errors.map(({ goalId, message }) => ({ goalId, message })),
  };
  await db().collection(`companies/${companyId}/syncLogs`).add(entry);

  if (status !== "success") {
    await notifyAdminsOfSyncFailure(errors.length, goals.length);
  }

  return { status, goalsExamined: goals.length, ...totals, errors, warnings, finishedAt };
}

interface GoalSyncResult {
  changed: boolean;
  applied: number;
  pending: boolean;
  rocksCreated: number;
  rocksUpdated: number;
  warnings: string[];
}

async function syncGoal(
  client: ClickUpClient,
  companyId: string,
  goal: Goal,
  settings: ClickUpSettings,
  directory: Person[],
  users: UserRecord[]
): Promise<GoalSyncResult> {
  const taskId = goal.clickup!.taskId!;
  const syncedAt = new Date().toISOString();
  const result: GoalSyncResult = {
    changed: false,
    applied: 0,
    pending: false,
    rocksCreated: 0,
    rocksUpdated: 0,
    warnings: [],
  };
  const warn = (message: string) => result.warnings.push(`${goal.title}: ${message}`);

  const appliedIds = new Set(goal.clickup?.appliedRecapIds ?? []);
  // Newest first, so once a page reaches a recap that was already applied,
  // everything older has been handled.
  const comments = await client.getTaskComments(taskId, {
    maxPages: 8,
    stop: (page) => page.some((c) => appliedIds.has(c.id)),
  });
  const unapplied = findRecaps(comments, settings).filter((c) => !appliedIds.has(c.id));

  const update: Record<string, unknown> = {
    "clickup.lastSyncedAt": syncedAt,
    "clickup.lastSyncError": null,
  };

  if (unapplied.length === 0 && !goal.clickup?.recap) {
    warn(`no comment starting with ${settings.recapMarkers.map((m) => `"${m}"`).join(" or ")} on the ClickUp task yet.`);
  }

  const approvers = approverIdentities(goal, directory, users);
  if (approvers.accountable === null && unapplied.length > 0) {
    warn("the goal has no Accountable person in the app, so only an admin can approve its recaps.");
  }

  let quarters: GoalQuarter[] = goal.quarters ?? [];
  let status: GoalStatus | undefined = goal.status;
  let latestApplied: GoalRecap | null = null;
  let pending: GoalRecap | null = null;
  const nowApplied: string[] = [];
  let unapprovedSoFar: string[] = [];

  for (const comment of unapplied) {
    const parsed = parseRecap(commentText(comment));
    const approval =
      goal.clickup?.approvals?.[comment.id] ?? (await clickUpApproval(client, comment, approvers));

    if (!approval) {
      // Only the newest unapproved recap is worth reviewing; an older one is
      // superseded by the next month's.
      pending = toGoalRecap(taskId, comment, parsed, null, syncedAt);
      unapprovedSoFar.push(comment.id);
      continue;
    }

    // Older unapproved recaps are superseded by this one, which re-lists every
    // rock, so they are marked handled without being applied.
    pending = null;
    nowApplied.push(...unapprovedSoFar);
    unapprovedSoFar = [];
    parsed.warnings.forEach(warn);

    const rocks = await applyRocks(companyId, goal, parsed, directory, syncedAt);
    result.rocksCreated += rocks.created;
    result.rocksUpdated += rocks.updated;
    rocks.warnings.forEach((w) => result.warnings.push(w));

    quarters = applyRecapToQuarters(quarters, parsed, {
      quantitative: goal.measurement?.type === "quantitative",
      syncedAt,
    }).quarters;
    if (parsed.status) status = parsed.status;

    latestApplied = toGoalRecap(taskId, comment, parsed, approval, syncedAt);
    nowApplied.push(comment.id);
    result.applied += 1;
  }

  if (pending) {
    result.pending = true;
    pending.warnings.forEach((w) => warn(`waiting recap: ${w}`));
    warn(`a recap is waiting for ${approvers.accountableName ?? "an admin"} to approve it.`);
  }
  const previousPending = goal.clickup?.pendingRecap ?? null;
  if (JSON.stringify(stripPulled(previousPending)) !== JSON.stringify(stripPulled(pending))) {
    update["clickup.pendingRecap"] = pending
      ? { ...pending, pulledAt: previousPending?.commentId === pending.commentId ? previousPending.pulledAt : syncedAt }
      : null;
  }

  if (latestApplied) {
    result.changed = true;
    update["clickup.recap"] = latestApplied;
    update["clickup.appliedRecapIds"] = [...(goal.clickup?.appliedRecapIds ?? []), ...nowApplied];
    if (JSON.stringify(quarters) !== JSON.stringify(goal.quarters ?? [])) update.quarters = quarters;
    if (status !== goal.status) update.status = status;
    update.updatedAt = syncedAt;
    // Read by the notification trigger; never matches a person, so RACI
    // members hear about status changes the recap makes.
    update.updatedBy = "clickup";
  }

  await db().doc(`companies/${companyId}/goals/${goal.id}`).update(update);
  return result;
}

function stripPulled(recap: GoalRecap | null): Omit<GoalRecap, "pulledAt"> | null {
  if (!recap) return null;
  const { pulledAt: _pulledAt, ...rest } = recap;
  return rest;
}

function toGoalRecap(
  taskId: string,
  comment: ClickUpComment,
  parsed: ParsedRecap,
  approval: RecapApproval | null,
  syncedAt: string
): GoalRecap {
  return {
    commentId: comment.id,
    commentUrl: commentUrl(taskId, comment.id),
    text: parsed.text,
    author: comment.user?.username ?? null,
    postedAt: comment.date ? new Date(Number(comment.date)).toISOString() : null,
    period: parsed.period,
    summary: parsed.summary,
    status: parsed.status,
    rockCount: parsed.rocks.length,
    warnings: parsed.warnings,
    approvedBy: approval,
    pulledAt: syncedAt,
  };
}

interface Approvers {
  accountable: Person | null;
  accountableName: string | null;
  /** Who may approve in ClickUp, looked up by ClickUp user id or email. */
  byClickUpId: Map<number, Person>;
  byEmail: Map<string, Person>;
}

/** The goal's Accountable person, plus OPSP admins, may approve a recap. */
function approverIdentities(goal: Goal, directory: Person[], users: UserRecord[]): Approvers {
  const accountable = goal.ownerId ? directory.find((p) => p.id === goal.ownerId) ?? null : null;
  const adminIds = new Set(
    users
      .filter((u) => !u.deletedAt && (u.role === "admin" || u.role === "superadmin"))
      .map((u) => u.id)
  );
  const allowed = directory.filter((p) => p.id === accountable?.id || adminIds.has(p.id));

  const approvers: Approvers = {
    accountable,
    accountableName: accountable?.name ?? goal.ownerName ?? null,
    byClickUpId: new Map(),
    byEmail: new Map(),
  };
  allowed.forEach((person) => {
    if (person.clickupUserId != null) approvers.byClickUpId.set(person.clickupUserId, person);
    if (person.email) approvers.byEmail.set(person.email, person);
  });
  return approvers;
}

async function clickUpApproval(
  client: ClickUpClient,
  comment: ClickUpComment,
  approvers: Approvers
): Promise<RecapApproval | null> {
  if (comment.reply_count != null && Number(comment.reply_count) === 0) return null;

  const replies = await client.getCommentReplies(comment.id);
  for (const reply of replies) {
    if (!isApprovalReply(reply)) continue;
    const id = reply.user?.id;
    const email = reply.user?.email?.toLowerCase();
    const person =
      (id != null ? approvers.byClickUpId.get(id) : undefined) ??
      (email ? approvers.byEmail.get(email) : undefined);
    if (!person) continue;

    return {
      byId: person.id,
      byName: person.name,
      at: reply.date ? new Date(Number(reply.date)).toISOString() : new Date().toISOString(),
      via: "clickup",
    };
  }
  return null;
}

async function applyRocks(
  companyId: string,
  goal: Goal,
  parsed: ParsedRecap,
  directory: Person[],
  syncedAt: string
): Promise<{ created: number; updated: number; warnings: string[] }> {
  if (parsed.rocks.length === 0) return { created: 0, updated: 0, warnings: [] };

  const rocksRef = db().collection(`companies/${companyId}/rocks`);
  const existing = await rocksRef.where("goalId", "==", goal.id).get();
  const plan = planRockChanges(
    goal,
    existing.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Rock),
    parsed.rocks,
    directory,
    { companyId, syncedAt }
  );

  const batch = db().batch();
  plan.creates.forEach((rock) => batch.set(rocksRef.doc(), rock));
  plan.updates.forEach(({ id, changes }) => batch.update(rocksRef.doc(id), changes));
  await batch.commit();

  return { created: plan.creates.length, updated: plan.updates.length, warnings: plan.warnings };
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

/**
 * The admin "Sync people" button: pulls the ClickUp workspace's members and
 * gives each one without an OPSP account a placeholder user record. Never
 * removes or duplicates anyone.
 */
export const refreshClickUpMembers = onCall(
  { secrets: [CLICKUP_API_TOKEN] },
  async (request) => {
    const caller = await requireCaller(request);
    requireAdmin(caller);

    try {
      const client = new ClickUpClient({ token: CLICKUP_API_TOKEN.value() });
      const location = await loadGoalLocation(DEFAULT_COMPANY_ID);
      const members = await refreshMembers(client, DEFAULT_COMPANY_ID, location?.workspaceId);
      return { count: members.length, ...(await syncPeople(members)) };
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

async function loadLinkedGoals(
  companyId: string,
  { goalId, planYears }: { goalId?: string; planYears?: number[] }
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
  const snap = planYears?.length
    ? await goals.where("planYear", "in", planYears).get()
    : await goals.get();

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Goal)
    .filter((g) => Boolean(g.clickup?.taskId));
}
