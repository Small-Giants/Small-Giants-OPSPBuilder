import { logger } from "firebase-functions";
import { APP_BASE_URL, EMAIL_FROM, SENDGRID_API_KEY } from "../config";

const SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send";

export interface EmailMessage {
  to: string;
  subject: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
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

/**
 * Returns false rather than throwing when email is not configured, so a missing
 * SendGrid key degrades to in-app only instead of failing the whole trigger.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const apiKey = SENDGRID_API_KEY.value();
  if (!apiKey) {
    logger.warn("SENDGRID_API_KEY is not set; skipping email", { to: message.to });
    return false;
  }

  const { html, text } = renderEmail(message);

  const response = await fetch(SENDGRID_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: message.to }] }],
      from: { email: EMAIL_FROM.value(), name: "Small Giants OPSP" },
      subject: message.subject,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    logger.error("SendGrid rejected the message", {
      to: message.to,
      status: response.status,
      detail: detail.slice(0, 300),
    });
    return false;
  }

  return true;
}

export function deepLink(view: string, goalId?: string): string {
  const base = APP_BASE_URL.value().replace(/\/$/, "");
  const params = new URLSearchParams({ view });
  if (goalId) params.set("goal", goalId);
  return `${base}/?${params.toString()}`;
}
