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
  errors: { goalId: string; goalTitle: string; message: string }[];
  warnings: string[];
  finishedAt: string;
}

export function syncClickUp(
  payload: { goalId?: string; planYear?: number } = {}
): Promise<SyncClickUpResponse> {
  return callFunction<typeof payload, SyncClickUpResponse>("syncClickUp", payload);
}

export function testClickUpConnection(): Promise<{ ok: boolean; connectedAs: string }> {
  return callFunction<Record<string, never>, { ok: boolean; connectedAs: string }>(
    "testClickUpConnection",
    {}
  );
}
