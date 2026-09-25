import { describe, expect, it } from "vitest";
import {
  buildDigest,
  daysUntilQuarterEnd,
  intentsForGoalChange,
  intentsForQuarterDeadline,
  stakeholders,
} from "./rules";
import { channelsFor, DEFAULT_PREFERENCES, type NotificationPreferences } from "./types";
import { renderEmail } from "./email";
import type { Goal } from "../types";

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: "g1",
    title: "Grow revenue to $10m",
    level: "department",
    planYear: 2026,
    measurement: { type: "simple" },
    quarters: [
      { quarter: "Q1", target: null, actual: null, complete: false },
      { quarter: "Q2", target: null, actual: null, complete: false },
      { quarter: "Q3", target: null, actual: null, complete: false },
      { quarter: "Q4", target: null, actual: null, complete: false },
    ],
    ...overrides,
  };
}

describe("stakeholders", () => {
  it("collects the owner, contributors, and department leader without duplicates", () => {
    const result = stakeholders(
      goal({ ownerId: "u1", contributorIds: ["u2", "u1"] }),
      "u3"
    );
    expect(result.sort()).toEqual(["u1", "u2", "u3"]);
  });

  it("drops missing ids rather than emitting empty recipients", () => {
    expect(stakeholders(goal({ ownerId: undefined }), null)).toEqual([]);
  });
});

describe("intentsForGoalChange", () => {
  it("tells a new owner they were assigned", () => {
    const intents = intentsForGoalChange({
      before: goal({ ownerId: "u1" }),
      after: goal({ ownerId: "u2" }),
    });
    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({ kind: "goal_assigned", recipientId: "u2" });
  });

  it("only notifies contributors who are newly added", () => {
    const intents = intentsForGoalChange({
      before: goal({ ownerId: "u1", contributorIds: ["u2"] }),
      after: goal({ ownerId: "u1", contributorIds: ["u2", "u3"] }),
    });
    const added = intents.filter((i) => i.kind === "contributor_added");
    expect(added.map((i) => i.recipientId)).toEqual(["u3"]);
  });

  it("does not notify the person who made the change", () => {
    const intents = intentsForGoalChange({
      before: goal({ ownerId: "u1", status: "in_progress" }),
      after: goal({ ownerId: "u1", status: "at_risk" }),
      actorId: "u1",
    });
    expect(intents).toHaveLength(0);
  });

  it("fires at-risk only on the transition, not on every later write", () => {
    const already = intentsForGoalChange({
      before: goal({ ownerId: "u1", status: "at_risk" }),
      after: goal({ ownerId: "u1", status: "at_risk", title: "Renamed" }),
    });
    expect(already.filter((i) => i.kind === "goal_at_risk")).toHaveLength(0);
  });

  it("notifies the whole stakeholder set when a goal completes", () => {
    const intents = intentsForGoalChange({
      before: goal({ ownerId: "u1", contributorIds: ["u2"], status: "in_progress" }),
      after: goal({ ownerId: "u1", contributorIds: ["u2"], status: "complete" }),
      departmentLeaderId: "u3",
    });
    const completed = intents.filter((i) => i.kind === "goal_completed");
    expect(completed.map((i) => i.recipientId).sort()).toEqual(["u1", "u2", "u3"]);
  });

  it("reports a quarter check-in", () => {
    const before = goal({ ownerId: "u1" });
    const after = goal({
      ownerId: "u1",
      quarters: before.quarters.map((q) =>
        q.quarter === "Q2" ? { ...q, actual: 500, complete: true } : q
      ),
    });

    const intents = intentsForGoalChange({ before, after });
    const updated = intents.find((i) => i.kind === "quarter_updated");
    expect(updated?.title).toContain("Q2");
  });

  it("emits nothing when the goal is deleted", () => {
    expect(intentsForGoalChange({ before: goal(), after: null })).toEqual([]);
  });

  it("gives every intent a dedupe key scoped to goal and recipient", () => {
    const intents = intentsForGoalChange({
      before: goal({ ownerId: "u1", status: "in_progress" }),
      after: goal({ ownerId: "u1", contributorIds: ["u2"], status: "complete" }),
    });
    const keys = intents.map((i) => i.dedupeKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("daysUntilQuarterEnd", () => {
  it("counts down to the last day of the quarter", () => {
    expect(daysUntilQuarterEnd(new Date(2026, 2, 25))).toBe(6);
    expect(daysUntilQuarterEnd(new Date(2026, 0, 1))).toBe(89);
  });

  it("reads as zero on the last day of the quarter", () => {
    expect(daysUntilQuarterEnd(new Date(2026, 2, 31, 9))).toBe(0);
  });
});

describe("intentsForQuarterDeadline", () => {
  const nearEnd = new Date(2026, 2, 25); // 6 days left in Q1

  it("nudges owners with an open current quarter", () => {
    const intents = intentsForQuarterDeadline([goal({ ownerId: "u1" })], nearEnd);
    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({ kind: "quarter_due_soon", recipientId: "u1" });
  });

  it("stays quiet when the quarter still has plenty of time", () => {
    expect(intentsForQuarterDeadline([goal({ ownerId: "u1" })], new Date(2026, 0, 5))).toEqual([]);
  });

  it("skips quarters already checked in", () => {
    const subject = goal({
      ownerId: "u1",
      quarters: goal().quarters.map((q) =>
        q.quarter === "Q1" ? { ...q, complete: true } : q
      ),
    });
    expect(intentsForQuarterDeadline([subject], nearEnd)).toEqual([]);
  });

  it("skips quarters whose numeric target is already met", () => {
    const subject = goal({
      ownerId: "u1",
      quarters: goal().quarters.map((q) =>
        q.quarter === "Q1" ? { ...q, target: 100, actual: 120 } : q
      ),
    });
    expect(intentsForQuarterDeadline([subject], nearEnd)).toEqual([]);
  });

  it("dedupes per week so the weekday schedule does not nag five times", () => {
    const monday = intentsForQuarterDeadline([goal({ ownerId: "u1" })], new Date(2026, 2, 23));
    const tuesday = intentsForQuarterDeadline([goal({ ownerId: "u1" })], new Date(2026, 2, 24));
    expect(monday[0].dedupeKey).toBe(tuesday[0].dedupeKey);
  });
});

describe("buildDigest", () => {
  const now = new Date(2026, 0, 12);

  it("returns null when a person has no goals", () => {
    expect(buildDigest("u1", [], now)).toBeNull();
  });

  it("says everything is up to date when nothing needs a check-in", () => {
    const intent = buildDigest(
      "u1",
      [{ goalId: "g1", title: "A", percent: 80, needsCheckIn: false }],
      now
    );
    expect(intent?.body).toContain("up to date");
  });

  it("names the goals that need attention and averages the rest", () => {
    const intent = buildDigest(
      "u1",
      [
        { goalId: "g1", title: "Revenue", percent: 100, needsCheckIn: false },
        { goalId: "g2", title: "Hiring", percent: 0, needsCheckIn: true },
      ],
      now
    );
    expect(intent?.body).toContain("Hiring");
    expect(intent?.body).toContain("50%");
  });
});

describe("channelsFor", () => {
  it("falls back to the defaults for an unconfigured kind", () => {
    expect(channelsFor("goal_assigned", DEFAULT_PREFERENCES)).toEqual({
      inApp: true,
      email: true,
      push: false,
    });
  });

  it("applies the per-kind override", () => {
    expect(channelsFor("quarter_updated", DEFAULT_PREFERENCES).email).toBe(false);
  });

  it("silences immediate email and push in digest mode but keeps the app inbox", () => {
    const preferences: NotificationPreferences = { ...DEFAULT_PREFERENCES, digestOnly: true };
    const channels = channelsFor("goal_assigned", preferences);
    expect(channels).toEqual({ inApp: true, email: false, push: false });
  });

  it("still sends the digest itself in digest mode", () => {
    const preferences: NotificationPreferences = { ...DEFAULT_PREFERENCES, digestOnly: true };
    expect(channelsFor("weekly_digest", preferences).email).toBe(true);
  });
});

describe("renderEmail", () => {
  it("escapes goal text so a title cannot inject markup", () => {
    const { html } = renderEmail({
      to: "a@b.com",
      subject: "s",
      heading: "h",
      body: '<img src=x onerror="alert(1)">',
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("omits the button when there is no link", () => {
    const { html } = renderEmail({ to: "a@b.com", subject: "s", heading: "h", body: "b" });
    expect(html).not.toContain("<a href");
  });
});
