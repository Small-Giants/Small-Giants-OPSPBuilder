import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { requireCaller } from "../auth";
import { DEFAULT_COMPANY_ID, geminiModel } from "../config";
import { db } from "../firestore";
import { DEFAULT_STATEMENT_INSTRUCTIONS, MAX_INSTRUCTIONS_LENGTH } from "./statement-instructions";

export const SMART_LABELS = {
  specific: "Specific",
  measurable: "Measurable",
  achievable: "Achievable",
  relevant: "Relevant",
  timeBound: "Time-bound",
} as const;

export type SmartInput = Partial<Record<keyof typeof SMART_LABELS, string>>;

/** Long enough for one rich sentence; anything longer means the model ignored the brief. */
export const MAX_STATEMENT_LENGTH = 400;

/**
 * The goal name and answers are always appended by code, so an edited prompt
 * can change the style but never lose the input.
 */
export function buildStatementPrompt(title: string, smart: SmartInput, instructions?: string): string {
  const answers = (Object.keys(SMART_LABELS) as (keyof typeof SMART_LABELS)[])
    .map((field) => [SMART_LABELS[field], smart[field]?.trim()] as const)
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");

  return [
    instructions?.trim() || DEFAULT_STATEMENT_INSTRUCTIONS,
    "",
    `Goal name: ${title.trim() || "(none)"}`,
    answers,
  ].join("\n");
}

async function savedInstructions(): Promise<string> {
  const snap = await db().doc(`companies/${DEFAULT_COMPANY_ID}/ai/goal-statement`).get();
  const value = snap.get("instructions");
  return typeof value === "string" ? value.slice(0, MAX_INSTRUCTIONS_LENGTH) : "";
}

/** Models sometimes wrap the answer in quotes or a label despite the brief. */
export function cleanStatement(raw: string): string {
  let text = raw
    .replace(/[*_`#]/g, "")
    .replace(/^\s*(goal statement|goal|statement)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  text = text.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
  if (text && !/[.!?]$/.test(text)) text += ".";
  return text;
}

/** The runtime service account's token, from the metadata server Cloud Run provides. */
async function accessToken(): Promise<string> {
  const res = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    { headers: { "Metadata-Flavor": "Google" } }
  );
  if (!res.ok) throw new Error(`Could not get a service account token (${res.status}).`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function generate(prompt: string): Promise<string> {
  const project = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
  const url = `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${geminiModel()}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      // Thinking tokens count against this limit, so it is far above one sentence.
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
    }),
  });
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(body.error?.message ?? `Vertex AI returned ${res.status}.`);
  const candidate = body.candidates?.[0];
  if (candidate?.finishReason && candidate.finishReason !== "STOP") {
    throw new Error(`The model stopped early (${candidate.finishReason}).`);
  }
  return candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

/**
 * Turns a goal's five SMART answers into one goal sentence. Any signed-in
 * user may call it: it reads and writes nothing, and the form saves the
 * result through the normal goal rules.
 */
export const writeSmartGoal = onCall<{ title?: string; smart?: SmartInput }>(
  { timeoutSeconds: 30 },
  async (request) => {
    await requireCaller(request);
    const smart = request.data?.smart ?? {};
    const answered = Object.values(smart).filter((v) => typeof v === "string" && v.trim()).length;
    if (answered < 2) {
      throw new HttpsError("invalid-argument", "Fill in at least two SMART answers first.");
    }

    try {
      const prompt = buildStatementPrompt(request.data?.title ?? "", smart, await savedInstructions());
      const statement = cleanStatement(await generate(prompt));
      if (!statement) throw new Error("The model returned nothing.");
      return { statement: statement.slice(0, MAX_STATEMENT_LENGTH) };
    } catch (error) {
      logger.error("Goal statement generation failed", { error: String(error) });
      throw new HttpsError("unavailable", "Could not write the goal statement right now. Try again, or write it by hand.");
    }
  }
);
