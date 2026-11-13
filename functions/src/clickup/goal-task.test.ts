import { describe, expect, it } from "vitest";
import {
  currentPeople,
  findRaciFields,
  goalTaskDescription,
  peopleDiff,
  raciClickUpIds,
  taskAssignees,
  toClickUpDate,
} from "./goal-task";
import { buildDirectory } from "./people";
import type { Goal } from "../types";

const directory = buildDirectory(
  [
    { id: "uid-pat", name: "Patrick Kuhl", email: "patrick@smallgiantsonline.com" },
    { id: "uid-nicole", name: "Nicole Matt", email: "nicolem@smallgiantsonline.com" },
  ],
  [
    { id: 11, username: "Patrick Kuhl", email: "patrick@smallgiantsonline.com" },
    { id: 33, username: "James Richardson", email: "james@smallgiantsonline.com" },
  ]
);

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: "g1",
    title: "Web Goal 3",
    level: "department",
    planYear: 2026,
    measurement: { type: "simple" },
    quarters: [],
    ...overrides,
  };
}

describe("goalTaskDescription", () => {
  it("writes one labelled line per answered SMART field", () => {
    const text = goalTaskDescription(
      goal({ smart: { specific: "Ship the dashboard", timeBound: "By Q3", measurable: " " } })
    );
    expect(text).toBe("**Specific:** Ship the dashboard\n\n**Time-bound:** By Q3");
  });

  it("falls back to the plain description", () => {
    expect(goalTaskDescription(goal({ description: "Legacy text" }))).toBe("Legacy text");
  });
});

describe("toClickUpDate", () => {
  it("uses noon UTC so the date does not shift a day in US time zones", () => {
    expect(new Date(toClickUpDate("2026-03-31")!).toISOString()).toBe("2026-03-31T12:00:00.000Z");
    expect(toClickUpDate("")).toBeNull();
  });
});

describe("raciClickUpIds", () => {
  it("maps each role to ClickUp ids and lists people with no ClickUp account", () => {
    const raci = raciClickUpIds(
      goal({
        ownerId: "clickup:33",
        contributorIds: ["uid-pat"],
        informedIds: ["uid-nicole"],
        executiveSponsorId: "uid-nicole",
      }),
      directory
    );
    expect(raci.ids).toEqual({ accountable: [33], responsible: [11], consulted: [], informed: [] });
    expect(raci.unmatched).toEqual(["Nicole Matt"]);
    expect(taskAssignees(raci)).toEqual([33, 11]);
  });
});

describe("RACI fields", () => {
  it("finds People fields by name regardless of case", () => {
    const fields = findRaciFields([
      { id: "f1", name: "accountable", type: "users" },
      { id: "f2", name: "Responsible", type: "short_text" },
      { id: "f3", name: "Informed ", type: "users" },
    ]);
    expect(fields.accountable?.id).toBe("f1");
    expect(fields.responsible).toBeUndefined();
    expect(fields.informed?.id).toBe("f3");
  });

  it("diffs current and wanted people", () => {
    const current = currentPeople({ id: "f", name: "Accountable", type: "users", value: [{ id: 1 }, { id: 2 }] });
    expect(peopleDiff(current, [2, 3])).toEqual({ add: [3], rem: [1] });
  });
});
