import type { UserRecord } from "../types";

/** A ClickUp workspace member, as stored in companies/{id}/clickupMembers. */
export interface ClickUpMember {
  id: number;
  username?: string | null;
  email?: string | null;
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
      clickupUserId: member?.id ?? null,
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
