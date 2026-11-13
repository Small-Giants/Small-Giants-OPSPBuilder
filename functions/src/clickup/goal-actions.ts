import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldPath } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { CLICKUP_API_TOKEN, DEFAULT_COMPANY_ID } from "../config";
import { requireCaller, type Caller } from "../auth";
import { db } from "../firestore";
import { leadersOf } from "../notifications/triggers";
import { raciMembers, type Goal, type RecapApproval } from "../types";
import { ClickUpClient, ClickUpError } from "./client";
import {
  addMissingPeople,
  currentPeople,
  fillEmptyTaskFields,
  findRaciFields,
  opspDescriptionBlock,
  raciClickUpIds,
  taskAssignees,
  toClickUpDate,
  type RaciRole,
} from "./goal-task";
import { loadDirectory, refreshMembers } from "./members";
import { loadGoalLocation, loadSettings, RACI_FIELD_NAMES } from "./settings";

const isAdmin = (caller: Caller) =>
  caller.record.role === "admin" || caller.record.role === "superadmin";

async function loadGoal(goalId: string | undefined): Promise<Goal> {
  if (!goalId) throw new HttpsError("invalid-argument", "goalId is required.");
  const snap = await db().doc(`companies/${DEFAULT_COMPANY_ID}/goals/${goalId}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "That goal no longer exists.");
  return { id: snap.id, ...snap.data() } as Goal;
}

/** Mirrors canWriteGoal in firestore.rules. */
async function requireGoalEditor(caller: Caller, goal: Goal): Promise<void> {
  if (isAdmin(caller) || raciMembers(goal).includes(caller.uid)) return;
  const leaders = await leadersOf(DEFAULT_COMPANY_ID, goal.departmentId);
  if (leaders.includes(caller.uid)) return;
  throw new HttpsError("permission-denied", "You cannot edit this goal.");
}

/**
 * Approves the recap waiting on a goal, from the app rather than ClickUp. The
 * next sync, scheduled or manual, applies it.
 */
export const approveClickUpRecap = onCall<{ goalId?: string; commentId?: string }>(
  async (request) => {
    const caller = await requireCaller(request);
    const goal = await loadGoal(request.data?.goalId);

    if (goal.ownerId !== caller.uid && !isAdmin(caller)) {
      throw new HttpsError(
        "permission-denied",
        "Only the goal's Accountable person or an admin can approve its recap."
      );
    }

    const pending = goal.clickup?.pendingRecap;
    const commentId = request.data?.commentId;
    if (!pending || pending.commentId !== commentId) {
      throw new HttpsError(
        "failed-precondition",
        "That recap is no longer waiting for approval. Refresh and try again."
      );
    }

    const approval: RecapApproval = {
      byId: caller.uid,
      byName: caller.record.name || caller.email,
      at: new Date().toISOString(),
      via: "app",
    };
    // Comment ids are numeric, which a dotted field path cannot express.
    await db()
      .doc(`companies/${DEFAULT_COMPANY_ID}/goals/${goal.id}`)
      .update(
        new FieldPath("clickup", "approvals", commentId),
        approval,
        new FieldPath("clickup", "pendingRecap", "approvedBy"),
        approval
      );

    return { approvedBy: approval.byName };
  }
);

export interface PushGoalResponse {
  status: "created" | "updated" | "skipped";
  reason?: string;
  taskId?: string;
  url?: string;
  warnings: string[];
  /** For an existing task, the empty fields that were filled in. */
  filled?: string[];
}

const FIELD_LABELS: Record<string, string> = {
  markdown_description: "description",
  due_date: "due date",
  start_date: "start date",
  assignees: "assignees",
};

/**
 * Creates the ClickUp task for a department goal: name, statement and SMART
 * description, dates, assignees, and the four RACI People fields. For a task
 * that already exists it only fills fields that are empty in ClickUp, and adds
 * the labelled statement block above a description that lacks it; it never
 * overwrites or removes anything. The executive sponsor stays in the app.
 */
export const pushGoalToClickUp = onCall<{ goalId?: string }, Promise<PushGoalResponse>>(
  { secrets: [CLICKUP_API_TOKEN] },
  async (request) => {
    const caller = await requireCaller(request);
    const goal = await loadGoal(request.data?.goalId);
    await requireGoalEditor(caller, goal);

    if (goal.level !== "department") {
      return { status: "skipped", reason: "Only department goals get a ClickUp task.", warnings: [] };
    }
    const settings = await loadSettings(DEFAULT_COMPANY_ID);
    if (!settings.enabled) {
      return { status: "skipped", reason: "The ClickUp integration is turned off.", warnings: [] };
    }

    const client = new ClickUpClient({ token: CLICKUP_API_TOKEN.value() });
    const location = await loadGoalLocation(DEFAULT_COMPANY_ID);

    try {
      const members = await refreshMembers(client, DEFAULT_COMPANY_ID, location?.workspaceId);
      const { directory } = await loadDirectory(DEFAULT_COMPANY_ID, members);
      const raci = raciClickUpIds(goal, directory);
      const warnings = raci.unmatched.map(
        (name) => `${name} has no ClickUp account with the same email, so was not assigned in ClickUp.`
      );

      const details = {
        name: goal.title.trim(),
        markdown_description: opspDescriptionBlock(goal),
        due_date: toClickUpDate(goal.dueDate),
        start_date: toClickUpDate(goal.startDate),
      };

      let taskId = goal.clickup?.taskId;
      let url = goal.clickup?.url;
      let listId: string;
      let status: PushGoalResponse["status"];
      let currentFields: Awaited<ReturnType<ClickUpClient["getTask"]>>["custom_fields"] = [];
      const filled: string[] = [];

      if (!taskId) {
        if (!location) {
          return {
            status: "skipped",
            reason: "No ClickUp location is set. A superadmin can set it in the Admin Panel.",
            warnings,
          };
        }
        listId = await resolveListId(client, location);
        const task = await client.createTask(listId, { ...details, assignees: taskAssignees(raci) });
        taskId = task.id;
        url = task.url;
        status = "created";
      } else {
        const task = await client.getTask(taskId);
        listId = task.list?.id ?? "";
        currentFields = task.custom_fields ?? [];
        const changes = fillEmptyTaskFields(
          task,
          { ...details, assignees: taskAssignees(raci) },
          goal.statement
        );
        if (Object.keys(changes).length > 0) await client.updateTask(taskId, changes);
        const hadDescription = Boolean(task.text_content?.trim() || task.description?.trim());
        filled.push(
          ...Object.keys(changes).map((key) =>
            key === "markdown_description" && hadDescription
              ? "goal statement and SMART breakdown above the existing description"
              : FIELD_LABELS[key] ?? key
          )
        );
        url = task.url ?? url;
        status = "updated";
      }

      const listFields = listId ? await client.getListFields(listId) : [];
      // A task can carry fields its list endpoint leaves out, so check both.
      const raciFields = findRaciFields([...(currentFields ?? []), ...listFields]);
      const raciLog: Record<string, unknown> = {};
      for (const role of Object.keys(RACI_FIELD_NAMES) as RaciRole[]) {
        const field = raciFields[role];
        if (!field) {
          warnings.push(`The ClickUp list has no People field named "${RACI_FIELD_NAMES[role]}".`);
          raciLog[role] = "no field";
          continue;
        }
        const current = currentPeople(currentFields?.find((f) => f.id === field.id));
        const diff = addMissingPeople(current, raci.ids[role]);
        raciLog[role] = { fieldId: field.id, current, wanted: raci.ids[role], add: diff.add };
        if (diff.add.length === 0) continue;
        try {
          await client.setPeopleField(taskId, field.id, diff);
          if (status === "updated") filled.push(RACI_FIELD_NAMES[role]);
        } catch (error) {
          const message = error instanceof ClickUpError ? error.message : String(error);
          warnings.push(`Could not set the ${RACI_FIELD_NAMES[role]} field: ${message}`);
          raciLog[role] = { ...(raciLog[role] as object), error: message };
        }
      }
      logger.info("Pushed goal to ClickUp", {
        goalId: goal.id,
        taskId,
        listId,
        status,
        raci: raciLog,
        unmatched: raci.unmatched,
        peopleFields: [...(currentFields ?? []), ...listFields]
          .filter((f) => f.type === "users")
          .map((f) => f.name),
      });

      await db()
        .doc(`companies/${DEFAULT_COMPANY_ID}/goals/${goal.id}`)
        .update({
          "clickup.taskId": taskId,
          "clickup.url": url ?? null,
          "clickup.listId": listId || null,
          "clickup.lastPushedAt": new Date().toISOString(),
        });

      return { status, taskId, url, warnings, filled };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      const message = error instanceof ClickUpError ? error.message : String(error);
      throw new HttpsError("failed-precondition", `ClickUp: ${message}`);
    }
  }
);

async function resolveListId(
  client: ClickUpClient,
  location: { listId: string | null; spaceId: string | null }
): Promise<string> {
  if (location.listId) return location.listId;

  const lists = await client.getSpaceLists(location.spaceId!);
  if (lists.length === 1) return lists[0].id;
  throw new HttpsError(
    "failed-precondition",
    lists.length === 0
      ? "The ClickUp space set in the Admin Panel has no lists outside folders. Paste a list link instead."
      : `The ClickUp space set in the Admin Panel has ${lists.length} lists. Paste the link of the list goals belong in.`
  );
}
