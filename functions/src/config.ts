import { defineSecret, defineString } from "firebase-functions/params";

/**
 * Credentials live in Secret Manager, never in Firestore. A Firestore document
 * is readable by anyone who can read the collection; a secret is readable only
 * by the service account the function runs as.
 *
 * Set them with:
 *   firebase functions:secrets:set CLICKUP_API_TOKEN
 *   firebase functions:secrets:set RESEND_API_KEY
 *
 * A function only receives a secret if it lists it in its `secrets` option.
 */
export const CLICKUP_API_TOKEN = defineSecret("CLICKUP_API_TOKEN");
export const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

/** Non-secret configuration, overridable per environment in .env files. */
export const APP_BASE_URL = defineString("APP_BASE_URL", {
  default: "https://opsp.smallgiantsonline.com",
  description: "Base URL used to build deep links in emails and notifications.",
});

/**
 * Resend requires this address to sit on a domain verified in the Resend
 * dashboard, otherwise every send is rejected.
 */
export const EMAIL_FROM = defineString("EMAIL_FROM", {
  default: "opsp@smallgiantsonline.com",
  description: "From address for outbound notification email.",
});

export const EMAIL_FROM_NAME = defineString("EMAIL_FROM_NAME", {
  default: "Small Giants OPSP",
  description: "Display name shown alongside the from address.",
});

/** The app is single-tenant; every document path hangs off this company. */
export const DEFAULT_COMPANY_ID = "default-company";

export const REGION = "us-central1";
