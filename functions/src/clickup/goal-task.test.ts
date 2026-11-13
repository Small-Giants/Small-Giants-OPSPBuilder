import { describe, expect, it } from "vitest";
import {
  addMissingPeople,
  currentPeople,
  descriptionWithOpspBlock,
  OPSP_MARKER,
  opspDescriptionBlock,
  fillEmptyTaskFields,
  findRaciFields,
  goalTaskDescription,
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
    expect(text).toBe("**Specific:** Ship the dashboard\n**Time-bound:** By Q3");
  });

  it("leads with the goal statement when there is one", () => {
    const text = goalTaskDescription(
      goal({ statement: "Ship the dashboard by Q3.", smart: { specific: "Ship the dashboard" } })
    );
    expect(text).toBe(
      "**Goal:** Ship the dashboard by Q3.\n\n### SMART breakdown\n**Specific:** Ship the dashboard"
    );
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

  it("adds the goal's people who are missing and never removes anyone", () => {
    const current = currentPeople({ id: "f", name: "Accountable", type: "users", value: [{ id: 1 }, { id: 2 }] });
    expect(addMissingPeople(current, [2, 3])).toEqual({ add: [3], rem: [] });
    expect(addMissingPeople(current, [1])).toEqual({ add: [], rem: [] });
    expect(addMissingPeople([], [2, 3])).toEqual({ add: [2, 3], rem: [] });
  });
});

describe("opspDescriptionBlock", () => {
  it("labels the goal's description as added by the app, dated in Arizona time", () => {
    const block = opspDescriptionBlock(
      goal({ statement: "Ship the dashboard by Q3.", smart: { specific: "Ship the dashboard" } }),
      new Date("2026-11-13T05:00:00Z")
    );
    expect(block).toBe(
      `***${OPSP_MARKER}*** *(Nov 12, 2026)*\n**Goal:** Ship the dashboard by Q3.\n\n### SMART breakdown\n**Specific:** Ship the dashboard`
    );
  });

  it("is empty when the goal has nothing to describe", () => {
    expect(opspDescriptionBlock(goal({}))).toBe("");
  });
});

describe("descriptionWithOpspBlock", () => {
  const block = `**${OPSP_MARKER}** (Nov 12, 2026)\n\n**Goal:** Relaunch the site by June 30.`;

  it("fills an empty description with the block", () => {
    expect(descriptionWithOpspBlock({ description: "", markdown_description: "" }, block, "x")).toBe(block);
  });

  it("adds the block above existing text, keeping the original markdown", () => {
    const task = { description: "Notes from the kickoff", markdown_description: "## Notes\n\n- from the kickoff" };
    expect(descriptionWithOpspBlock(task, block, "Relaunch the site by June 30.")).toBe(
      `${block}\n\n---\n\n## Notes\n\n- from the kickoff`
    );
  });

  it("adds nothing when the block or the statement is already there", () => {
    const labelled = { description: `${OPSP_MARKER} (Oct 1, 2026) Older statement`, markdown_description: "x" };
    expect(descriptionWithOpspBlock(labelled, block, "Relaunch the site by June 30.")).toBeNull();
    const hasStatement = {
      description: "Goal: Relaunch the  site by June 30. More notes",
      markdown_description: "**Goal:** Relaunch the site by June 30.\n\nMore notes",
    };
    expect(descriptionWithOpspBlock(hasStatement, block, "Relaunch the site by June 30.")).toBeNull();
  });

  it("adds nothing when ClickUp did not return the markdown to keep", () => {
    expect(descriptionWithOpspBlock({ description: "Notes" }, block, "Relaunch.")).toBeNull();
  });
});

describe("fillEmptyTaskFields", () => {
  const wanted = {
    name: "Web Goal 3",
    markdown_description: "**Goal:** Relaunch the site.",
    due_date: 1782820800000,
    start_date: 1767268800000,
    assignees: [7, 8],
  };

  it("leaves set fields alone and never sends the name, but adds missing assignees", () => {
    const changes = fillEmptyTaskFields(
      {
        description: `${OPSP_MARKER} (Nov 1, 2026) Written by hand in ClickUp`,
        markdown_description: `**${OPSP_MARKER}** (Nov 1, 2026)\n\nWritten by hand in ClickUp`,
        due_date: "1780000000000",
        start_date: "1760000000000",
        assignees: [{ id: 9 }],
      },
      wanted
    );
    expect(changes).toEqual({ assignees: { add: [7, 8], rem: [] } });
  });

  it("sends nothing when the task already has everything", () => {
    const changes = fillEmptyTaskFields(
      {
        description: "Notes",
        markdown_description: `**${OPSP_MARKER}** (Nov 1, 2026)\n\nNotes`,
        due_date: "1780000000000",
        start_date: "1760000000000",
        assignees: [{ id: 7 }, { id: 8 }, { id: 9 }],
      },
      wanted
    );
    expect(changes).toEqual({});
  });

  it("fills only the empty fields", () => {
    const changes = fillEmptyTaskFields(
      { description: "", text_content: "", due_date: null, start_date: "1760000000000", assignees: [] },
      wanted
    );
    expect(changes).toEqual({
      markdown_description: wanted.markdown_description,
      due_date: wanted.due_date,
      assignees: { add: [7, 8], rem: [] },
    });
  });

  it("does not send values the goal does not have", () => {
    const changes = fillEmptyTaskFields(
      { description: "  ", due_date: null, assignees: [] },
      { name: "x", markdown_description: "", due_date: null, start_date: null, assignees: [] }
    );
    expect(changes).toEqual({});
  });
});
