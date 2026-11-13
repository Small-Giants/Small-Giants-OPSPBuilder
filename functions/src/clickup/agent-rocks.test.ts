import { describe, expect, it } from "vitest";
import { planRockChanges } from "./agent-rocks";
import { buildDirectory } from "./people";
import type { ParsedRock } from "./recap";
import type { Rock } from "../types";

const goal = { id: "g1", title: "Web Goal 3", planYear: 2026 };
const context = { companyId: "default-company", syncedAt: "2026-11-06T14:00:00.000Z" };
const directory = buildDirectory(
  [{ id: "uid-pat", name: "Patrick Kuhl", email: "patrick@smallgiantsonline.com" }],
  [{ id: 33, username: "James Richardson", email: "james@smallgiantsonline.com" }]
);

function parsed(overrides: Partial<ParsedRock> = {}): ParsedRock {
  return {
    quarter: "Q1",
    title: "Launch pricing page",
    assignees: ["Patrick Kuhl", "James Richardson"],
    dueDate: "2026-03-31",
    status: null,
    taskId: null,
    ...overrides,
  };
}

function rock(overrides: Partial<Rock> = {}): Rock {
  return {
    id: "r1",
    text: "Launch pricing page",
    status: "in_progress",
    quarter: "Q1",
    dueDate: "2026-03-31",
    ownerId: "uid-pat",
    contributorIds: ["clickup:33"],
    ...overrides,
  };
}

describe("planRockChanges", () => {
  it("creates a rock the first time the agent lists it, with resolved assignees", () => {
    const plan = planRockChanges(goal, [], [parsed()], directory, context);
    expect(plan.creates).toHaveLength(1);
    expect(plan.creates[0]).toMatchObject({
      text: "Launch pricing page",
      goalId: "g1",
      year: 2026,
      status: "not_started",
      ownerId: "uid-pat",
      ownerName: "Patrick Kuhl",
      contributorIds: ["clickup:33"],
      updatedBy: "clickup",
    });
    expect(plan.creates[0]).not.toHaveProperty("clickup");
  });

  it("does nothing when the agent re-lists a rock unchanged", () => {
    const plan = planRockChanges(goal, [rock()], [parsed()], directory, context);
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toHaveLength(0);
  });

  it("matches loosely on title and updates what changed", () => {
    const plan = planRockChanges(
      goal,
      [rock()],
      [parsed({ title: "Launch  pricing page.", quarter: "Q2", status: "complete" })],
      directory,
      context
    );
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].changes).toMatchObject({
      text: "Launch  pricing page.",
      quarter: "Q2",
      status: "complete",
    });
  });

  it("follows a linked ClickUp task through a rename", () => {
    const plan = planRockChanges(
      goal,
      [rock({ clickup: { taskId: "abc" } })],
      [parsed({ title: "Renamed rock", taskId: "abc" })],
      directory,
      context
    );
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates[0].changes.text).toBe("Renamed rock");
  });

  it("keeps existing assignees and warns when nobody named can be found", () => {
    const plan = planRockChanges(
      goal,
      [rock()],
      [parsed({ assignees: ["Someone New"] })],
      directory,
      context
    );
    expect(plan.updates).toHaveLength(0);
    expect(plan.warnings[0]).toContain("Someone New");
  });

  it("applies a rock listed twice in one recap only once", () => {
    const plan = planRockChanges(goal, [], [parsed(), parsed()], directory, context);
    expect(plan.creates).toHaveLength(1);
  });
});
