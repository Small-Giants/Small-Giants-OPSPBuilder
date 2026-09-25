import { logger } from "firebase-functions";
import {
  APP_BASE_URL,
  EMAIL_FROM,
  EMAIL_FROM_NAME,
  RESEND_API_KEY,
} from "../config";

const RESEND_URL = "https://api.resend.com/emails";

/**
 * Resend allows 2 requests per second on the default plan, and a weekly digest
 * fans out to everyone at once. Sends are serialised with a gap rather than
 * fired in parallel, because a 429 loses the email outright.
 */
const MIN_SEND_GAP_MS = 550;

export interface EmailMessage {
  to: string;
  subject: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /** Lets Resend collapse a retry of the same notification into one send. */
  idempotencyKey?: string;
}

/** Escapes anything that came from a goal title or a person's own text. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderEmail(message: EmailMessage): { html: string; text: string } {
  const cta =
    message.ctaUrl && message.ctaLabel
      ? `<tr><td style="padding-top:24px">
           <a href="${esc(message.ctaUrl)}" style="background:#319899;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block;font-weight:600">${esc(message.ctaLabel)}</a>
         </td></tr>`
      : "";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f7f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2933">
    <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
      <tr><td style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#727272">Small Giants OPSP</td></tr>
      <tr><td style="font-size:20px;font-weight:700;padding-top:8px">${esc(message.heading)}</td></tr>
      <tr><td style="font-size:15px;line-height:1.6;padding-top:12px;color:#3e4c59">${esc(message.body)}</td></tr>
      ${cta}
      <tr><td style="padding-top:32px;font-size:12px;color:#9aa5b1;border-top:1px solid #e5e9eb">
        You are receiving this because you own or contribute to goals in the OPSP.
        Change what you get emailed under Settings, Notifications.
      </td></tr>
    </table>
  </body>
</html>`;

  const text = [
    message.heading,
    "",
    message.body,
    message.ctaUrl ? `\n${message.ctaLabel}: ${message.ctaUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}

/** Tail of the send queue. Each send waits for the previous one plus the gap. */
let sendChain: Promise<unknown> = Promise.resolve();

function throttle<T>(task: () => Promise<T>): Promise<T> {
  const result = sendChain.then(task, task);
  sendChain = result
    .catch(() => undefined)
    .then(() => new Promise((resolve) => setTimeout(resolve, MIN_SEND_GAP_MS)));
  return result;
}

/**
 * Returns false rather than throwing when email is not configured or rejected,
 * so a missing Resend key degrades to in-app only instead of failing the whole
 * trigger and losing the other channels with it.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const apiKey = RESEND_API_KEY.value();
  if (!apiKey) {
    logger.warn("RESEND_API_KEY is not set; skipping email", { to: message.to });
    return false;
  }

  const { html, text } = renderEmail(message);
  const payload = JSON.stringify({
    from: `${EMAIL_FROM_NAME.value()} <${EMAIL_FROM.value()}>`,
    to: [message.to],
    subject: message.subject,
    html,
    text,
  });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (message.idempotencyKey) {
    headers["Idempotency-Key"] = message.idempotencyKey;
  }

  // One retry, because a 429 here means the burst was too fast rather than the
  // message being wrong.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const outcome = await throttle(() => post(payload, headers, message.to));
    if (outcome === "sent") return true;
    if (outcome === "failed") return false;
    logger.warn("Resend rate limited the send; retrying once", { to: message.to });
  }

  logger.error("Resend rate limited the send twice; giving up", { to: message.to });
  return false;
}

type SendOutcome = "sent" | "failed" | "rate_limited";

async function post(
  payload: string,
  headers: Record<string, string>,
  to: string
): Promise<SendOutcome> {
  let response: Response;
  try {
    response = await fetch(RESEND_URL, { method: "POST", headers, body: payload });
  } catch (error: any) {
    logger.error("Could not reach Resend", { to, error: error?.message ?? String(error) });
    return "failed";
  }

  if (response.ok) return "sent";
  if (response.status === 429) return "rate_limited";

  const detail = await response.text().catch(() => "");
  logger.error("Resend rejected the message", {
    to,
    status: response.status,
    // 403 here almost always means the from domain is not verified in Resend.
    detail: detail.slice(0, 300),
  });
  return "failed";
}

export function deepLink(view: string, goalId?: string): string {
  const base = APP_BASE_URL.value().replace(/\/$/, "");
  const params = new URLSearchParams({ view });
  if (goalId) params.set("goal", goalId);
  return `${base}/?${params.toString()}`;
}
