import { db } from "../firestore";
import type { UserRecord } from "../types";
import type { ClickUpClient } from "./client";
import { buildDirectory, planPeopleSync, type ClickUpMember, type Person } from "./people";

const membersPath = (companyId: string) => `companies/${companyId}/clickupMembers`;

/**
 * Copies the ClickUp workspace's members into Firestore so the app can offer
 * them in people pickers without a ClickUp token of its own. Members who have
 * left the workspace drop out of this cache; their user records, if any, stay.
 */
export async function refreshMembers(
  client: ClickUpClient,
  companyId: string,
  workspaceId?: string | null
): Promise<ClickUpMember[]> {
  const workspaces = await client.getWorkspaces();
  const workspace =
    (workspaceId && workspaces.find((w) => String(w.id) === String(workspaceId))) ||
    workspaces[0];
  if (!workspace) return [];

  const members: ClickUpMember[] = (workspace.members ?? [])
    .map(({ user }) => user)
    .filter((user): user is typeof user & { id: number } => typeof user?.id === "number")
    .map((user) => ({
      id: user.id,
      username: user.username ?? null,
      email: user.email ?? null,
      role: user.role ?? null,
    }));

  const collection = db().collection(membersPath(companyId));
  const existing = await collection.get();
  const current = new Set(members.map((m) => String(m.id)));
  const refreshedAt = new Date().toISOString();

  const batch = db().batch();
  members.forEach((member) =>
    batch.set(collection.doc(String(member.id)), { ...member, workspaceId: workspace.id, refreshedAt })
  );
  existing.docs.forEach((doc) => {
    if (!current.has(doc.id)) batch.delete(doc.ref);
  });
  await batch.commit();

  return members;
}

export interface PeopleSyncResult {
  members: number;
  created: number;
  updated: number;
  alreadyHadAccount: number;
  skippedGuests: number;
  skippedNoEmail: number;
}

/**
 * Gives every ClickUp member without an OPSP account a placeholder user
 * record, so they can be assigned, given a department, and so on before they
 * sign in. See relinkClickUpPerson for what happens when they do.
 */
export async function syncPeople(members: ClickUpMember[]): Promise<PeopleSyncResult> {
  const plan = planPeopleSync(await loadUsers(), members);
  const now = new Date().toISOString();
  const users = db().collection("users");

  const writes = [
    ...plan.creates.map(({ id, data }) => ({ id, data: { ...data, id, createdAt: now, updatedAt: now } })),
    ...plan.updates.map(({ id, data }) => ({ id, data: { ...data, updatedAt: now } })),
  ];
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db().batch();
    writes.slice(i, i + 400).forEach(({ id, data }) => batch.set(users.doc(id), data, { merge: true }));
    await batch.commit();
  }

  const skipped = (reason: string) => plan.skipped.filter((s) => s.reason === reason).length;
  return {
    members: members.length,
    created: plan.creates.length,
    updated: plan.updates.length,
    alreadyHadAccount: skipped("has_account"),
    skippedGuests: skipped("guest"),
    skippedNoEmail: skipped("no_email"),
  };
}

export async function loadMembers(companyId: string): Promise<ClickUpMember[]> {
  const snap = await db().collection(membersPath(companyId)).get();
  return snap.docs.map((doc) => doc.data() as ClickUpMember);
}

export async function loadUsers(): Promise<UserRecord[]> {
  const snap = await db().collection("users").get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as UserRecord);
}

export async function loadDirectory(
  companyId: string,
  members?: ClickUpMember[]
): Promise<{ directory: Person[]; users: UserRecord[] }> {
  const [users, stored] = await Promise.all([
    loadUsers(),
    members ? Promise.resolve(members) : loadMembers(companyId),
  ]);
  return { directory: buildDirectory(users, stored), users };
}
