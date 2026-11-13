import type { ClickUpComment } from "./client";
import {
  QUARTERS,
  type GoalQuarter,
  type GoalStatus,
  type Quarter,
  type RockStatus,
} from "../types";

export interface RecapConfig {
  /**
   * Headings the ClickUp agent opens a recap with: the first run's rock plan
   * and the monthly update. Matched case-insensitively against the first line.
   */
  recapMarkers: string[];
  /** Optional: only accept recaps whose author name contains this text. */
  recapAuthor?: string;
}

export const DEFAULT_RECAP_MARKERS = ["OPSP Rock Plan", "OPSP Monthly Recap"];

const DATA_START = /^opsp data$/i;
const DATA_END = /^end opsp data$/i;
const ROCKS_START = /^opsp rocks$/i;
const ROCKS_END = /^end opsp rocks$/i;

/**
 * Agents write the heading as markdown more often than not, so formatting
 * characters are stripped before any line is compared or split.
 */
function cleanLine(line: string): string {
  return line
    .replace(/[*_`#>]/g, "")
    .replace(/^\s*[-•]\s+/, "")
    .trim();
}

export function commentText(comment: ClickUpComment): string {
  if (comment.comment_text) return comment.comment_text;
  return (comment.comment ?? []).map((part) => part.text ?? "").join("");
}

function firstLine(text: string): string {
  return text.split(/\r?\n/).map(cleanLine).find(Boolean) ?? "";
}

function isRecap(comment: ClickUpComment, config: RecapConfig): boolean {
  const markers = config.recapMarkers
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);

  // The heading has to open the comment, so a person quoting or discussing
  // the recap in a later comment is not mistaken for a new one.
  const opening = firstLine(commentText(comment)).toLowerCase();
  if (!markers.some((marker) => opening.startsWith(marker))) return false;

  const author = config.recapAuthor?.trim().toLowerCase();
  if (!author) return true;
  // Bot and agent authors can come back without an id, so the name is the
  // only author detail that is reliably present.
  return (comment.user?.username ?? "").toLowerCase().includes(author);
}

/** Every recap on the task, oldest first, ready to be applied in order. */
export function findRecaps(
  comments: ClickUpComment[],
  config: RecapConfig
): ClickUpComment[] {
  const seen = new Set<string>();
  return comments
    .filter((comment) => {
      // Paging from a reference comment can return that comment twice.
      if (seen.has(comment.id) || !isRecap(comment, config)) return false;
      seen.add(comment.id);
      return true;
    })
    .sort((a, b) => Number(a.date ?? 0) - Number(b.date ?? 0));
}

export function findLatestRecap(
  comments: ClickUpComment[],
  config: RecapConfig
): ClickUpComment | null {
  const recaps = findRecaps(comments, config);
  return recaps[recaps.length - 1] ?? null;
}

/** A goal owner approves a recap by replying in its thread with "Approved". */
export function isApprovalReply(reply: ClickUpComment): boolean {
  return /^approved?\b/i.test(firstLine(commentText(reply)));
}

export interface ParsedRock {
  quarter: Quarter;
  title: string;
  /** Names or emails, exactly as the agent wrote them. */
  assignees: string[];
  /** YYYY-MM-DD. */
  dueDate: string | null;
  status: RockStatus | null;
  /** The ClickUp task or subtask the rock refers to, when the agent linked one. */
  taskId: string | null;
}

export interface ParsedRecap {
  /** Full comment text, which is what the app shows people. */
  text: string;
  period: string | null;
  summary: string | null;
  status: GoalStatus | null;
  /** Null when the recap did not say, which leaves completion untouched. */
  completedQuarters: Quarter[] | null;
  actuals: Partial<Record<Quarter, number>>;
  rocks: ParsedRock[];
  /** Problems worth surfacing to the admin who ran the sync. */
  warnings: string[];
}

const STATUS_WORDS: [RegExp, GoalStatus][] = [
  [/^not started/, "not_started"],
  [/^(at risk|off track|behind|blocked)/, "at_risk"],
  [/^(complete|completed|done|met|achieved)/, "complete"],
  [/^(on track|in progress|ahead)/, "in_progress"],
];

export function parseStatus(raw: string): GoalStatus | null {
  const value = raw.trim().toLowerCase();
  return STATUS_WORDS.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}

/** Accepts "$1,250,000", "1.25m", "40%", and "12 hires". */
export function parseAmount(raw: string): number | null {
  const match = raw
    .replace(/[$,%]/g, "")
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*([kmb])?\b/i);
  if (!match) return null;

  const multiplier = { k: 1e3, m: 1e6, b: 1e9 }[
    (match[2]?.toLowerCase() ?? "") as "k" | "m" | "b"
  ] ?? 1;
  const value = Number(match[1]) * multiplier;
  return Number.isFinite(value) ? value : null;
}

function parseQuarterList(raw: string): Quarter[] {
  const found = Array.from(raw.matchAll(/q(?:uarter)?\s*([1-4])/gi)).map(
    (m) => `Q${m[1]}` as Quarter
  );
  return QUARTERS.filter((q) => found.includes(q));
}

const ROCK_STATUS_WORDS: [RegExp, RockStatus][] = [
  [/^not started/, "not_started"],
  [/^ready/, "ready"],
  [/^(complete|completed|done)/, "complete"],
  [/^(in progress|on track|at risk|off track|behind|blocked|started)/, "in_progress"],
];

export function parseRockStatus(raw: string): RockStatus | null {
  const value = raw.trim().toLowerCase();
  return ROCK_STATUS_WORDS.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}

/** Accepts 2026-03-31, 3/31/2026, and March 31, 2026. Returns YYYY-MM-DD. */
export function parseDueDate(raw: string): string | null {
  const iso = raw.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (iso) return `${iso[1]}-${pad(Number(iso[2]))}-${pad(Number(iso[3]))}`;

  const parsed = new Date(raw.trim());
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

/**
 * One rock per line, pipe-separated, quarter and title first:
 *
 *   Q1 | Launch pricing page | Assignees: Pat Kuhl, Thomas Rider | Due: 2026-03-31 | Status: In Progress | Task: https://app.clickup.com/t/86abc
 */
export function parseRockLine(line: string): ParsedRock | null {
  const [quarterPart, titlePart, ...rest] = line.split("|").map((part) => part.trim());
  const quarter = quarterPart?.match(/q(?:uarter)?\s*([1-4])/i);
  const title = titlePart?.replace(/^(rock|title)\s*:\s*/i, "").trim();
  if (!quarter || !title) return null;

  const rock: ParsedRock = {
    quarter: `Q${quarter[1]}` as Quarter,
    title,
    assignees: [],
    dueDate: null,
    status: null,
    taskId: line.match(/clickup\.com\/t\/(?:\d+\/)?([a-z0-9]+)/i)?.[1] ?? null,
  };

  for (const part of rest) {
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    const key = part.slice(0, colon).trim().toLowerCase();
    const value = part.slice(colon + 1).trim();

    if (/^(assignees?|owners?|assigned to)$/.test(key)) {
      rock.assignees = value
        .split(/,|;|\band\b/i)
        .map((name) => name.trim())
        .filter((name) => name && !/^(none|unassigned)$/i.test(name));
    } else if (/^due( date)?$/.test(key)) {
      rock.dueDate = parseDueDate(value);
    } else if (key === "status") {
      rock.status = parseRockStatus(value);
    }
  }

  return rock;
}

/** The lines between a start and end marker. A missing end runs to the end of the text. */
function block(lines: string[], start: RegExp, end: RegExp): string[] | null {
  const from = lines.findIndex((line) => start.test(line));
  if (from === -1) return null;
  const endOffset = lines.slice(from + 1).findIndex((line) => end.test(line));
  return lines.slice(from + 1, endOffset === -1 ? undefined : from + 1 + endOffset);
}

/**
 * Reads the structured blocks at the end of a recap. Everything above them is
 * free-form narrative for people; only the blocks drive the goal.
 *
 * ```
 * OPSP ROCKS
 * Q1 | Rock title | Assignees: Name, Name | Due: 2026-03-31 | Status: In Progress
 * END OPSP ROCKS
 *
 * OPSP DATA
 * Status: On Track
 * Summary: One or two sentences.
 * Completed quarters: Q1, Q2
 * Q3 actual: 1250000
 * END OPSP DATA
 * ```
 */
export function parseRecap(text: string): ParsedRecap {
  const result: ParsedRecap = {
    text: text.trim(),
    period: null,
    summary: null,
    status: null,
    completedQuarters: null,
    actuals: {},
    rocks: [],
    warnings: [],
  };

  const lines = text.split(/\r?\n/).map(cleanLine);

  const rockLines = block(lines, ROCKS_START, ROCKS_END);
  for (const line of rockLines ?? []) {
    if (!line) continue;
    const rock = parseRockLine(line);
    if (rock) {
      result.rocks.push(rock);
    } else {
      result.warnings.push(`Could not read the rock line "${line.slice(0, 80)}".`);
    }
  }

  const dataLines = block(lines, DATA_START, DATA_END);
  if (!dataLines) {
    if (!rockLines) {
      result.warnings.push(
        "The recap has no OPSP DATA or OPSP ROCKS block, so only its text was saved."
      );
    }
    return result;
  }

  for (const line of dataLines) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (!value) continue;

    if (key === "status") {
      result.status = parseStatus(value);
      if (!result.status) {
        result.warnings.push(
          `Status "${value}" is not one of On Track, At Risk, Complete, or Not Started.`
        );
      }
      continue;
    }

    if (key === "summary") {
      result.summary = value;
      continue;
    }

    if (key === "period") {
      result.period = value;
      continue;
    }

    if (key === "completed quarters") {
      result.completedQuarters = /^none\b/i.test(value) ? [] : parseQuarterList(value);
      continue;
    }

    const actualKey = key.match(/^q([1-4]) actual$/);
    if (actualKey) {
      const quarter = `Q${actualKey[1]}` as Quarter;
      const amount = parseAmount(value);
      if (amount == null) {
        result.warnings.push(`${quarter} actual "${value}" is not a number.`);
      } else {
        result.actuals[quarter] = amount;
      }
    }
  }

  return result;
}

export interface QuarterMerge {
  quarters: GoalQuarter[];
  changed: boolean;
}

/**
 * Applies a recap onto the goal's quarters. Targets are never touched: the
 * recap reports what happened, it does not get to redefine the plan. Quarters
 * the recap says nothing about keep whatever they had.
 */
export function applyRecapToQuarters(
  existing: GoalQuarter[],
  recap: Pick<ParsedRecap, "completedQuarters" | "actuals">,
  options: { quantitative: boolean; syncedAt: string }
): QuarterMerge {
  let changed = false;

  const quarters = QUARTERS.map((quarter) => {
    const current =
      existing.find((q) => q.quarter === quarter) ??
      ({ quarter, target: null, actual: null, complete: false } as GoalQuarter);

    const nextComplete =
      recap.completedQuarters == null
        ? current.complete
        : recap.completedQuarters.includes(quarter);
    const reported = options.quantitative ? recap.actuals[quarter] : undefined;
    const nextActual = reported ?? current.actual;

    if (nextComplete === current.complete && nextActual === current.actual) {
      return current;
    }

    changed = true;
    return {
      ...current,
      actual: nextActual,
      complete: nextComplete,
      updatedAt: options.syncedAt,
      updatedBy: "clickup",
    };
  });

  return { quarters, changed };
}

/** ClickUp opens a task scrolled to a comment with this query parameter. */
export function commentUrl(taskId: string, commentId: string): string {
  return `https://app.clickup.com/t/${encodeURIComponent(taskId)}?comment=${encodeURIComponent(commentId)}`;
}
