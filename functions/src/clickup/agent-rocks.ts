import { findPerson, type Person } from "./people";
import type { ParsedRock } from "./recap";
import type { Goal, Rock } from "../types";

export interface RockPlan {
  creates: Omit<Rock, "id">[];
  updates: { id: string; changes: Partial<Rock> }[];
  warnings: string[];
}

/** Titles are compared loosely so "Launch pricing page." matches "launch  pricing page". */
export function rockKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveAssignees(
  rock: ParsedRock,
  directory: Person[],
  warnings: string[],
  goalTitle: string
): Person[] {
  const people: Person[] = [];
  for (const written of rock.assignees) {
    const person = findPerson(directory, written);
    if (person) {
      if (!people.some((p) => p.id === person.id)) people.push(person);
    } else {
      warnings.push(
        `${goalTitle}: rock "${rock.title}" names "${written}", who matches no one in the OPSP app or the ClickUp workspace.`
      );
    }
  }
  return people;
}

/**
 * Turns the rocks listed in an approved recap into creates and updates. The
 * agent re-lists every rock each month, so a rock that appears for the first
 * time mid-year is created then. A rock is matched to an existing one by its
 * ClickUp task when the agent linked one, otherwise by title. Rocks the agent
 * stops listing are left alone rather than deleted.
 */
export function planRockChanges(
  goal: Pick<Goal, "id" | "title" | "planYear">,
  existing: Rock[],
  parsed: ParsedRock[],
  directory: Person[],
  context: { companyId: string; syncedAt: string }
): RockPlan {
  const plan: RockPlan = { creates: [], updates: [], warnings: [] };
  const byTask = new Map<string, Rock>();
  const byTitle = new Map<string, Rock>();
  existing.forEach((rock) => {
    if (rock.clickup?.taskId) byTask.set(rock.clickup.taskId, rock);
    byTitle.set(rockKey(rock.text), rock);
  });
  const handled = new Set<string>();

  for (const rock of parsed) {
    const key = rockKey(rock.title);
    const match = (rock.taskId && byTask.get(rock.taskId)) || byTitle.get(key);
    // The same rock listed twice in one recap is applied once.
    const dedupe = match?.id ?? `new:${rock.taskId ?? key}`;
    if (handled.has(dedupe)) continue;
    handled.add(dedupe);

    const people = resolveAssignees(rock, directory, plan.warnings, goal.title);
    const assignment =
      people.length > 0
        ? {
            ownerId: people[0].id,
            ownerName: people[0].name,
            contributorIds: people.slice(1).map((p) => p.id),
          }
        : null;

    if (!match) {
      plan.creates.push({
        text: rock.title,
        description: "",
        status: rock.status ?? "not_started",
        quarter: rock.quarter,
        year: goal.planYear ?? null,
        dueDate: rock.dueDate,
        goalId: goal.id,
        ownerId: assignment?.ownerId ?? "",
        ownerName: assignment?.ownerName ?? "",
        contributorIds: assignment?.contributorIds ?? [],
        companyId: context.companyId,
        createdAt: context.syncedAt,
        updatedAt: context.syncedAt,
        updatedBy: "clickup",
        // Firestore rejects undefined, so the link is only added when present.
        ...(rock.taskId ? { clickup: { taskId: rock.taskId } } : {}),
      });
      continue;
    }

    const changes: Partial<Rock> = {};
    if (match.text !== rock.title) changes.text = rock.title;
    if (match.quarter !== rock.quarter) changes.quarter = rock.quarter;
    if (rock.status && match.status !== rock.status) changes.status = rock.status;
    if (rock.dueDate && match.dueDate !== rock.dueDate) changes.dueDate = rock.dueDate;
    if (rock.taskId && match.clickup?.taskId !== rock.taskId) {
      changes.clickup = { ...match.clickup, taskId: rock.taskId };
    }
    if (assignment) {
      const sameOwner = match.ownerId === assignment.ownerId;
      const sameOthers =
        JSON.stringify(match.contributorIds ?? []) === JSON.stringify(assignment.contributorIds);
      if (!sameOwner || !sameOthers) Object.assign(changes, assignment);
    }

    if (Object.keys(changes).length > 0) {
      plan.updates.push({
        id: match.id,
        changes: { ...changes, updatedAt: context.syncedAt, updatedBy: "clickup" },
      });
    }
  }

  return plan;
}
