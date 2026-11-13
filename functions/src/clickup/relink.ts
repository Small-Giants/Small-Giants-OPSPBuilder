import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { DEFAULT_COMPANY_ID } from "../config";
import { db } from "../firestore";
import { CLICKUP_PERSON_PREFIX, clickUpPersonId, profileFromPlaceholder } from "./people";
import { loadMembers } from "./members";

const SINGLE_FIELDS = ["ownerId", "executiveSponsorId"] as const;
const LIST_FIELDS = ["contributorIds", "consultedIds", "informedIds"] as const;

/**
 * People who only used ClickUp are named as `clickup:<member id>`, and the
 * people sync gives them a placeholder user record under that id. When one of
 * them signs in to the OPSP for the first time, their new account takes over
 * the placeholder's role, department, and manager, every reference to the
 * placeholder moves to the new account, and the placeholder is deleted.
 */
export const relinkClickUpPerson = onDocumentCreated("users/{uid}", async (event) => {
  const uid = event.params.uid;
  if (uid.startsWith(CLICKUP_PERSON_PREFIX)) return;
  const account = event.data?.data() ?? {};
  const email = (account.email as string | undefined)?.trim().toLowerCase();
  if (!email) return;

  const placeholderDoc = (
    await db().collection("users").where("source", "==", "clickup").where("email", "==", email).get()
  ).docs.find((doc) => doc.id !== uid);

  let placeholder = placeholderDoc?.id;
  if (!placeholder) {
    const member = (await loadMembers(DEFAULT_COMPANY_ID)).find(
      (m) => m.email?.trim().toLowerCase() === email
    );
    if (!member) return;
    placeholder = clickUpPersonId(member.id);
  }

  if (placeholderDoc) {
    const carried = profileFromPlaceholder(placeholderDoc.data(), account);
    if (Object.keys(carried).length > 0) await db().doc(`users/${uid}`).update(carried);
  }

  const moved = await moveReferences(placeholder, uid);
  if (placeholderDoc) await placeholderDoc.ref.delete();

  logger.info("Linked a new account to its ClickUp placeholder", { uid, placeholder, moved });
});

async function moveReferences(from: string, to: string): Promise<number> {
  let moved = 0;

  for (const collection of ["goals", "rocks"]) {
    const ref = db().collection(`companies/${DEFAULT_COMPANY_ID}/${collection}`);
    const snaps = await Promise.all([
      ...SINGLE_FIELDS.map((field) => ref.where(field, "==", from).get()),
      ...LIST_FIELDS.map((field) => ref.where(field, "array-contains", from).get()),
    ]);

    const docs = new Map(snaps.flatMap((s) => s.docs).map((doc) => [doc.ref.path, doc]));
    const batch = db().batch();
    docs.forEach((doc) => {
      const data = doc.data();
      const changes: Record<string, string | string[]> = {};
      SINGLE_FIELDS.forEach((field) => {
        if (data[field] === from) changes[field] = to;
      });
      LIST_FIELDS.forEach((field) => {
        const ids = data[field] as string[] | undefined;
        if (ids?.includes(from)) changes[field] = ids.map((id) => (id === from ? to : id));
      });
      batch.update(doc.ref, changes);
    });
    await batch.commit();
    moved += docs.size;
  }

  const departmentsRef = db().collection(`companies/${DEFAULT_COMPANY_ID}/departments`);
  const [reports, ledByList, ledBySingle] = await Promise.all([
    db().collection("users").where("managerId", "==", from).get(),
    departmentsRef.where("leaderIds", "array-contains", from).get(),
    departmentsRef.where("leaderId", "==", from).get(),
  ]);
  const departments = new Map([...ledByList.docs, ...ledBySingle.docs].map((doc) => [doc.id, doc]));
  const batch = db().batch();
  reports.docs.forEach((doc) => batch.update(doc.ref, { managerId: to }));
  departments.forEach((doc) => {
    const data = doc.data();
    const changes: Record<string, string | string[]> = {};
    if (Array.isArray(data.leaderIds) && data.leaderIds.includes(from)) {
      changes.leaderIds = (data.leaderIds as string[]).map((id) => (id === from ? to : id));
    }
    if (data.leaderId === from) changes.leaderId = to;
    batch.update(doc.ref, changes);
  });
  if (!reports.empty || departments.size > 0) await batch.commit();

  return moved + reports.size + departments.size;
}
