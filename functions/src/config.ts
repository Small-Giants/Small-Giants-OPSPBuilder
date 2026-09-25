import { defineSecret, defineString } from "firebase-functions/params";

/**
 * Credentials live in Secret Manager, never in Firestore. A Firestore document
 * is readable by anyone who can read the collection; a secret is readable only
 * by the service account the function runs as.
 *
 * Set them with:
 *   firebase functions:secrets:set CLICKUP_API_TOKEN
 *   firebase functions:secrets:set SENDGRID_API_KEY
 *
 * A function only receives a secret if it lists it in its `secrets` option.
 */
export const CLICKUP_API_TOKEN = defineSecret("CLICKUP_API_TOKEN");
export const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");

/** Non-secret configuration, overridable per environment in .env files. */
export const APP_BASE_URL = defineString("APP_BASE_URL", {
  default: "https://opsp.smallgiantsonline.com",
  description: "Base URL used to build deep links in emails and notifications.",
});

export const EMAIL_FROM = defineString("EMAIL_FROM", {
  default: "opsp@smallgiantsonline.com",
  description: "From address for outbound notification email.",
});

/** The app is single-tenant; every document path hangs off this company. */
export const DEFAULT_COMPANY_ID = "default-company";

export const REGION = "us-central1";
