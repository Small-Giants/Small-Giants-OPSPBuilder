import { setGlobalOptions } from "firebase-functions/v2";
import { onCall } from "firebase-functions/v2/https";
import { REGION, DEFAULT_COMPANY_ID } from "./config";
import { requireCaller } from "./auth";

setGlobalOptions({
  region: REGION,
  maxInstances: 10,
  memory: "256MiB",
  timeoutSeconds: 60,
});

/**
 * Confirms the Blaze upgrade, deploy pipeline, and callable auth path all work
 * end to end, without touching any data.
 */
export { syncClickUp, testClickUpConnection } from "./clickup/sync";
export {
  onGoalWritten,
  quarterDeadlineReminders,
  weeklyDigest,
} from "./notifications/triggers";

export const health = onCall(async (request) => {
  const caller = await requireCaller(request, DEFAULT_COMPANY_ID);
  return {
    ok: true,
    uid: caller.uid,
    role: caller.record.role ?? "user",
    serverTime: new Date().toISOString(),
  };
});
