"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useActiveUsers, type ActiveUser } from "@/hooks/use-active-users";

const DEFAULT_COMPANY_ID = "default-company";

/** Mirror of CLICKUP_PERSON_PREFIX in functions/src/clickup/people.ts. */
export const CLICKUP_PERSON_PREFIX = "clickup:";

export interface AssignablePerson extends ActiveUser {
  /** True for ClickUp members who have never signed in to the app. */
  clickupOnly?: boolean;
}

interface ClickUpMemberDoc {
  username?: string;
  email?: string;
}

export function isClickUpOnlyId(id: string | undefined | null): boolean {
  return Boolean(id?.startsWith(CLICKUP_PERSON_PREFIX));
}

/**
 * App accounts plus ClickUp workspace members who have no account yet, so a
 * goal can name people before they ever sign in. ClickUp-only people get a
 * `clickup:<memberId>` id; the relinkClickUpPerson function swaps it for their
 * real id the first time they sign in.
 */
export function useAssignablePeople() {
  const { users, loading: usersLoading } = useActiveUsers();
  const [members, setMembers] = useState<{ id: string; data: ClickUpMemberDoc }[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "companies", DEFAULT_COMPANY_ID, "clickupMembers"),
      (snapshot) => {
        setMembers(snapshot.docs.map((d) => ({ id: d.id, data: d.data() as ClickUpMemberDoc })));
        setMembersLoading(false);
      },
      () => setMembersLoading(false)
    );
    return () => unsubscribe();
  }, []);

  const people = useMemo<AssignablePerson[]>(() => {
    const emails = new Set(users.map((u) => u.email?.trim().toLowerCase()).filter(Boolean));
    const clickupOnly: AssignablePerson[] = members
      .filter((m) => !m.data.email || !emails.has(m.data.email.trim().toLowerCase()))
      .map((m) => ({
        id: `${CLICKUP_PERSON_PREFIX}${m.id}`,
        name: m.data.username || m.data.email,
        email: m.data.email,
        clickupOnly: true,
      }));
    return [...users, ...clickupOnly].sort((a, b) =>
      (a.name || a.email || "").localeCompare(b.name || b.email || "")
    );
  }, [users, members]);

  return { people, loading: usersLoading || membersLoading };
}

export function personLabel(people: ActiveUser[], id: string | undefined | null): string {
  if (!id) return "";
  const found = people.find((p) => p.id === id);
  return found?.name || found?.email || id;
}
