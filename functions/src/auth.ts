import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { db } from "./firestore";
import type { UserRecord } from "./types";

const ALLOWED_DOMAIN = "smallgiantsonline.com";

export interface Caller {
  uid: string;
  email: string;
  record: UserRecord;
}

/**
 * Callable functions run with the caller's identity but no security rules, so
 * every entry point has to re-check what the rules would have checked.
 */
export async function requireCaller(
  request: CallableRequest,
  companyId: string
): Promise<Caller> {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError("unauthenticated", "Sign in to continue.");
  }

  const email = (auth.token.email ?? "").toLowerCase();
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    throw new HttpsError("permission-denied", "This app is restricted to Small Giants accounts.");
  }

  const snap = await db().doc(`companies/${companyId}/users/${auth.uid}`).get();
  if (!snap.exists) {
    throw new HttpsError("permission-denied", "No user profile found for this account.");
  }

  const record = { id: snap.id, ...snap.data() } as UserRecord;
  if (record.deletedAt) {
    throw new HttpsError("permission-denied", "This account has been deactivated.");
  }

  return { uid: auth.uid, email, record };
}

export function requireAdmin(caller: Caller): void {
  if (caller.record.role !== "admin" && caller.record.role !== "superadmin") {
    throw new HttpsError("permission-denied", "Admin access required.");
  }
}
