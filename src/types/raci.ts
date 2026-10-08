/**
 * RACI assignments, shared by goals and rocks.
 *
 * `ownerId` stores Accountable and `contributorIds` stores Responsible. Those
 * two names predate the RACI model and are load-bearing in firestore.rules,
 * the notification triggers, and the ClickUp sync, so they keep their storage
 * names and change only their labels.
 */
export interface RaciAssignment {
  /** Accountable. Exactly one person answers for the outcome. */
  ownerId?: string;
  /** Denormalized so list views can render without a user lookup. */
  ownerName?: string;
  /** Responsible. The people doing the work. */
  contributorIds?: string[];
  consultedIds?: string[];
  informedIds?: string[];
  executiveSponsorId?: string;
}

export const RACI_ROLES = [
  "accountable",
  "responsible",
  "consulted",
  "informed",
  "sponsor",
] as const;

export type RaciRole = (typeof RACI_ROLES)[number];

export const RACI_ROLE_LABELS: Record<RaciRole, string> = {
  accountable: "Accountable",
  responsible: "Responsible",
  consulted: "Consulted",
  informed: "Informed",
  sponsor: "Executive sponsor",
};

export const RACI_ROLE_HINTS: Record<RaciRole, string> = {
  accountable: "The one person who answers for the outcome.",
  responsible: "The people doing the work.",
  consulted: "Asked for input before decisions.",
  informed: "Kept up to date on progress.",
  sponsor: "The executive backing this.",
};

/** Roles that hold a list of people rather than a single person. */
export const RACI_MULTI_ROLES: RaciRole[] = [
  "responsible",
  "consulted",
  "informed",
];

export function raciRoleIds(
  entity: RaciAssignment,
  role: RaciRole
): string[] {
  switch (role) {
    case "accountable":
      return entity.ownerId ? [entity.ownerId] : [];
    case "responsible":
      return entity.contributorIds ?? [];
    case "consulted":
      return entity.consultedIds ?? [];
    case "informed":
      return entity.informedIds ?? [];
    case "sponsor":
      return entity.executiveSponsorId ? [entity.executiveSponsorId] : [];
  }
}

/**
 * Everyone named in any RACI role. All of them may edit, so this is the same
 * set firestore.rules checks in `canWriteGoal`.
 */
export function raciMembers(entity: RaciAssignment): string[] {
  const ids = RACI_ROLES.flatMap((role) => raciRoleIds(entity, role));
  return Array.from(new Set(ids.filter(Boolean)));
}

export function isRaciMember(
  entity: RaciAssignment,
  userId: string | undefined
): boolean {
  if (!userId) return false;
  return raciMembers(entity).includes(userId);
}

/** Drops a person from every role, used when reassigning Accountable. */
export function withoutRaciMember<T extends RaciAssignment>(
  entity: T,
  userId: string
): T {
  return {
    ...entity,
    contributorIds: (entity.contributorIds ?? []).filter((id) => id !== userId),
    consultedIds: (entity.consultedIds ?? []).filter((id) => id !== userId),
    informedIds: (entity.informedIds ?? []).filter((id) => id !== userId),
  };
}
