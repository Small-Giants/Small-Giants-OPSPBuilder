import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let cached: Firestore | undefined;

/**
 * Lazily initialised so that importing a module for its types does not force an
 * Admin SDK handshake, which matters for unit tests and cold-start cost.
 */
export function db(): Firestore {
  if (!cached) {
    // firebase-functions registers its own named app to verify callable auth,
    // so "any app exists" does not mean the default app does.
    if (!getApps().some((app) => app.name === "[DEFAULT]")) initializeApp();
    cached = getFirestore();
  }
  return cached;
}

export function companyPath(companyId: string, collection: string): string {
  return `companies/${companyId}/${collection}`;
}
