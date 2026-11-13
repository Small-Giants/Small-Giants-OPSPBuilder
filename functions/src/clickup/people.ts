import type { UserRecord } from "../types";

/** A ClickUp workspace member, as stored in companies/{id}/clickupMembers. */
export interface ClickUpMember {
  id: number;
  username?: string | null;
  email?: string | null;
  role?: number | null;
}

const CLICKUP_GUEST_ROLE = 4;

/**
 * A user record standing in for a ClickUp member who has not signed in yet.
 * Its id is the member's `clickup:<id>` person id, so goals and rocks that
 * already name the member keep pointing at it.
 */
export interface PlaceholderUser {
  name: string;
  email: string;
  role: "user";
  source: "clickup";
  clickupUserId: number;
}

export interface PeopleSyncPlan {
  creates: { id: string; data: PlaceholderUser }[];
  /** Name changes on placeholders this sync created earlier. */
  updates: { id: string; data: Pick<PlaceholderUser, "name"> }[];
  skipped: { member: ClickUpMember; reason: "guest" | "no_email" | "has_account" }[];
}

/**
 * Decides which ClickUp members become user records. Never removes anyone,
 * and never creates a second record for an email that already has one, even
 * a deleted one: removing people is left to an admin.
 */
export function planPeopleSync(users: UserRecord[], members: ClickUpMember[]): PeopleSyncPlan {
  const byEmail = new Map<string, UserRecord>();
  users.forEach((u) => {
    const email = normalizeEmail(u.email);
    if (email && !byEmail.has(email)) byEmail.set(email, u);
  });

  const plan: PeopleSyncPlan = { creates: [], updates: [], skipped: [] };
  for (const member of members) {
    if (member.role === CLICKUP_GUEST_ROLE) {
      plan.skipped.push({ member, reason: "guest" });
      continue;
    }
    const email = normalizeEmail(member.email);
    if (!email) {
      plan.skipped.push({ member, reason: "no_email" });
      continue;
    }
    const name = member.username?.trim() || email;
    const existing = byEmail.get(email);
    if (!existing) {
      const id = clickUpPersonId(member.id);
      plan.creates.push({
        id,
        data: { name, email, role: "user", source: "clickup", clickupUserId: member.id },
      });
      byEmail.set(email, { id, email, name });
      continue;
    }
    if (existing.source === "clickup" && !existing.deletedAt && existing.name !== name) {
      plan.updates.push({ id: existing.id, data: { name } });
    } else if (existing.source !== "clickup") {
      plan.skipped.push({ member, reason: "has_account" });
    }
  }
  return plan;
}

/** Profile fields an admin may have set on a placeholder, carried to the real account. */
export const CARRIED_PROFILE_FIELDS = [
  "role",
  "departmentId",
  "managerId",
  "deletedAt",
  "deletedBy",
] as const;

/**
 * What a newly signed-in account takes over from its placeholder. The
 * client-chosen role is only replaced when it is the default, so an
 * auto-granted superadmin keeps that role.
 */
export function profileFromPlaceholder(
  placeholder: Partial<UserRecord> & Record<string, unknown>,
  account: Partial<UserRecord> & Record<string, unknown>
): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  for (const field of CARRIED_PROFILE_FIELDS) {
    const value = placeholder[field];
    if (value === undefined || value === null || value === "") continue;
    if (field === "role" && (account.role ?? "user") !== "user") continue;
    changes[field] = value;
  }
  if (!account.name && placeholder.name) changes.name = placeholder.name;
  if (typeof placeholder.clickupUserId === "number") changes.clickupUserId = placeholder.clickupUserId;
  return changes;
}

/**
 * Someone who can be named on a goal or rock. Most contributors only ever use
 * ClickUp, so people without an OPSP account are included under a
 * `clickup:<member id>` id until they sign in and get a real one.
 */
export interface Person {
  id: string;
  name: string;
  email: string | null;
  clickupUserId: number | null;
}

export const CLICKUP_PERSON_PREFIX = "clickup:";

export function clickUpPersonId(memberId: number): string {
  return `${CLICKUP_PERSON_PREFIX}${memberId}`;
}

export function memberIdFromPersonId(personId: string): number | null {
  if (!personId.startsWith(CLICKUP_PERSON_PREFIX)) return null;
  const id = Number(personId.slice(CLICKUP_PERSON_PREFIX.length));
  return Number.isFinite(id) ? id : null;
}

const normalizeEmail = (email?: string | null) => email?.trim().toLowerCase() || null;
const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

export function buildDirectory(users: UserRecord[], members: ClickUpMember[]): Person[] {
  const memberByEmail = new Map<string, ClickUpMember>();
  members.forEach((m) => {
    const email = normalizeEmail(m.email);
    if (email) memberByEmail.set(email, m);
  });

  const people: Person[] = [];
  const claimed = new Set<number>();

  for (const user of users) {
    if (user.deletedAt) continue;
    const email = normalizeEmail(user.email);
    const member = email ? memberByEmail.get(email) : undefined;
    if (member) claimed.add(member.id);
    people.push({
      id: user.id,
      name: user.name || user.email || user.id,
      email,
      clickupUserId: member?.id ?? user.clickupUserId ?? null,
    });
  }

  for (const member of members) {
    if (claimed.has(member.id)) continue;
    people.push({
      id: clickUpPersonId(member.id),
      name: member.username || member.email || `ClickUp user ${member.id}`,
      email: normalizeEmail(member.email),
      clickupUserId: member.id,
    });
  }

  return people;
}

/**
 * Resolves a name or email as written by the ClickUp agent. Exact email or
 * full name wins; otherwise a unique match on the start of a name, so "Thomas"
 * finds Thomas Rider when there is only one Thomas.
 */
export function findPerson(directory: Person[], written: string): Person | null {
  const query = written.trim().replace(/^@/, "");
  if (!query) return null;

  const email = normalizeEmail(query);
  const byEmail = directory.find((p) => p.email === email);
  if (byEmail) return byEmail;

  const name = normalizeName(query);
  const exact = directory.filter((p) => normalizeName(p.name) === name);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  const partial = directory.filter((p) => {
    const candidate = normalizeName(p.name);
    return candidate.startsWith(`${name} `) || candidate === name;
  });
  return partial.length === 1 ? partial[0] : null;
}

export function clickUpIdFor(directory: Person[], personId: string): number | null {
  return (
    directory.find((p) => p.id === personId)?.clickupUserId ??
    memberIdFromPersonId(personId)
  );
}
