import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { DEFAULT_COMPANY_ID } from "../config";
import { db } from "../firestore";
import { clickUpPersonId } from "./people";
import { loadMembers } from "./members";

const SINGLE_FIELDS = ["ownerId", "executiveSponsorId"] as const;
const LIST_FIELDS = ["contributorIds", "consultedIds", "informedIds"] as const;

/**
 * People who only used ClickUp are named on goals and rocks as
 * `clickup:<member id>`. When one of them signs in to the OPSP for the first
 * time, those references are moved to their real account so they can see and
 * edit their own goals.
 */
export const relinkClickUpPerson = onDocumentCreated("users/{uid}", async (event) => {
  const uid = event.params.uid;
  const email = (event.data?.data()?.email as string | undefined)?.trim().toLowerCase();
  if (!email) return;

  const member = (await loadMembers(DEFAULT_COMPANY_ID)).find(
    (m) => m.email?.trim().toLowerCase() === email
  );
  if (!member) return;

  const placeholder = clickUpPersonId(member.id);
  let moved = 0;

  for (const collection of ["goals", "rocks"]) {
    const ref = db().collection(`companies/${DEFAULT_COMPANY_ID}/${collection}`);
    const snaps = await Promise.all([
      ...SINGLE_FIELDS.map((field) => ref.where(field, "==", placeholder).get()),
      ...LIST_FIELDS.map((field) => ref.where(field, "array-contains", placeholder).get()),
    ]);

    const docs = new Map(snaps.flatMap((s) => s.docs).map((doc) => [doc.ref.path, doc]));
    const batch = db().batch();
    docs.forEach((doc) => {
      const data = doc.data();
      const changes: Record<string, string | string[]> = {};
      SINGLE_FIELDS.forEach((field) => {
        if (data[field] === placeholder) changes[field] = uid;
      });
      LIST_FIELDS.forEach((field) => {
        const ids = data[field] as string[] | undefined;
        if (ids?.includes(placeholder)) {
          changes[field] = ids.map((id) => (id === placeholder ? uid : id));
        }
      });
      batch.update(doc.ref, changes);
    });
    await batch.commit();
    moved += docs.size;
  }

  if (moved > 0) logger.info("Moved ClickUp-only references to a new account", { uid, moved });
});
