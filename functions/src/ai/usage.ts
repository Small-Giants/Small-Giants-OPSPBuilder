import { FieldValue } from "firebase-admin/firestore";
import { DEFAULT_COMPANY_ID } from "../config";
import { db } from "../firestore";

/** Vertex AI's usageMetadata, as returned by generateContent. */
export interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  /** Thinking tokens, billed at the output rate. */
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

export interface TokenPrice {
  /** USD per million tokens. */
  input: number;
  output: number;
}

/**
 * Vertex AI list prices in the global location, newest first. Each call is
 * costed at the price in effect when it ran, so a price change never rewrites
 * past months. Add a row when Google changes a price or the model changes.
 */
const PRICES: { model: string; from: string; price: TokenPrice }[] = [
  { model: "gemini-3.8-flash", from: "2027-01-01", price: { input: 1.5, output: 7.5 } },
  { model: "gemini-3.8-flash", from: "2000-01-01", price: { input: 0.75, output: 3.75 } },
];

export function priceFor(model: string, at: Date): TokenPrice | null {
  const day = at.toISOString().slice(0, 10);
  return PRICES.find((p) => p.model === model && p.from <= day)?.price ?? null;
}

export function tokensOf(usage: GeminiUsage): { input: number; output: number } {
  return {
    input: usage.promptTokenCount ?? 0,
    output: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
  };
}

export function costUsd(usage: GeminiUsage, price: TokenPrice | null): number {
  if (!price) return 0;
  const { input, output } = tokensOf(usage);
  return (input * price.input + output * price.output) / 1_000_000;
}

/** Months run on Arizona time, like the rest of the app's schedules. */
export function usageMonth(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Phoenix",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}`;
}

/**
 * Adds one AI call to companies/{company}/aiUsage/{YYYY-MM}. Usage tracking
 * must never fail the call it measures, so errors are swallowed by callers.
 */
export async function recordUsage(params: {
  feature: string;
  model: string;
  uid: string;
  usage: GeminiUsage;
  at?: Date;
}): Promise<void> {
  const at = params.at ?? new Date();
  const price = priceFor(params.model, at);
  const { input, output } = tokensOf(params.usage);
  const cost = costUsd(params.usage, price);
  const inc = FieldValue.increment;

  await db()
    .doc(`companies/${DEFAULT_COMPANY_ID}/aiUsage/${usageMonth(at)}`)
    .set(
      {
        month: usageMonth(at),
        calls: inc(1),
        inputTokens: inc(input),
        outputTokens: inc(output),
        costUsd: inc(cost),
        unpricedCalls: inc(price ? 0 : 1),
        features: { [params.feature]: { calls: inc(1), costUsd: inc(cost) } },
        byUser: { [params.uid]: { calls: inc(1), costUsd: inc(cost) } },
        models: { [params.model]: { calls: inc(1) } },
        updatedAt: at.toISOString(),
      },
      { merge: true }
    );
}
