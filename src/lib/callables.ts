import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { functions } from "@/lib/firebase";

/**
 * Callable errors surface as `FunctionsError` with a machine-readable `code`.
 * Everything in the UI wants the human message, so unwrap it in one place.
 */
export async function callFunction<Req, Res>(
  name: string,
  payload: Req
): Promise<Res> {
  try {
    const fn = httpsCallable<Req, Res>(functions, name);
    const result: HttpsCallableResult<Res> = await fn(payload);
    return result.data;
  } catch (error: any) {
    const message =
      error?.message ||
      "The server could not complete that request. Try again in a moment.";
    throw new Error(message);
  }
}

export interface HealthResponse {
  ok: boolean;
  uid: string;
  role: string;
  serverTime: string;
}

export function checkBackendHealth(): Promise<HealthResponse> {
  return callFunction<Record<string, never>, HealthResponse>("health", {});
}

export interface SyncClickUpResponse {
  status: "success" | "partial" | "error";
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

export function syncClickUp(
  payload: { goalId?: string; planYear?: number } = {}
): Promise<SyncClickUpResponse> {
  return callFunction<typeof payload, SyncClickUpResponse>("syncClickUp", payload);
}

export interface SyncPeopleResponse {
  count: number;
  members: number;
  created: number;
  updated: number;
  alreadyHadAccount: number;
  skippedGuests: number;
  skippedNoEmail: number;
}

/** Pulls ClickUp members and adds the ones without an account as placeholder users. */
export function refreshClickUpMembers(): Promise<SyncPeopleResponse> {
  return callFunction<Record<string, never>, SyncPeopleResponse>("refreshClickUpMembers", {});
}

export function approveClickUpRecap(payload: {
  goalId: string;
  commentId: string;
}): Promise<{ approvedBy: string }> {
  return callFunction<typeof payload, { approvedBy: string }>("approveClickUpRecap", payload);
}

export interface PushGoalResponse {
  status: "created" | "updated" | "skipped";
  reason?: string;
  taskId?: string;
  url?: string;
  warnings: string[];
  /** For an existing task, the empty fields that were filled in. */
  filled?: string[];
}

/**
 * Creates the department goal's ClickUp task. An existing task only has its
 * empty fields filled; nothing set in ClickUp is overwritten.
 */
export function pushGoalToClickUp(payload: { goalId: string }): Promise<PushGoalResponse> {
  return callFunction<typeof payload, PushGoalResponse>("pushGoalToClickUp", payload);
}

/** Writes one concise goal sentence from the SMART answers. */
export function writeSmartGoal(payload: {
  title: string;
  smart: Record<string, string>;
}): Promise<{ statement: string }> {
  return callFunction<typeof payload, { statement: string }>("writeSmartGoal", payload);
}

export function testClickUpConnection(): Promise<{ ok: boolean; connectedAs: string }> {
  return callFunction<Record<string, never>, { ok: boolean; connectedAs: string }>(
    "testClickUpConnection",
    {}
  );
}
