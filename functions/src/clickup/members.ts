import { db } from "../firestore";
import type { UserRecord } from "../types";
import type { ClickUpClient } from "./client";
import { buildDirectory, type ClickUpMember, type Person } from "./people";

const membersPath = (companyId: string) => `companies/${companyId}/clickupMembers`;

/**
 * Copies the ClickUp workspace's members into Firestore so the app can offer
 * them in people pickers without a ClickUp token of its own. Members who have
 * left the workspace are removed.
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
    .map((user) => ({ id: user.id, username: user.username ?? null, email: user.email ?? null }));

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
