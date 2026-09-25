export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

export const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

export function isQuarter(value: unknown): value is Quarter {
  return typeof value === "string" && (QUARTERS as string[]).includes(value);
}

export function toQuarter(value: unknown, fallback: Quarter = "Q1"): Quarter {
  return isQuarter(value) ? value : fallback;
}
