/**
 * Converts legacy annual `priorities` documents into the unified `goals`
 * collection, and repoints existing `rocks` onto the goals their priorities
 * became.
 *
 * Capabilities stay in the priorities collection and are never touched. Rocks
 * stay rocks: only their parent link and RACI fields are updated.
 *
 * Dry run (default, writes nothing):
 *   npx tsx scripts/migrate-goals.ts --company default-company --years 2025,2026
 *
 * Commit:
 *   npx tsx scripts/migrate-goals.ts --company default-company --years 2025,2026 --commit
 *
 * Roll back a committed run:
 *   npx tsx scripts/migrate-goals.ts --company default-company --years 2025,2026 --rollback --commit
 *
 * Authenticates with GOOGLE_APPLICATION_CREDENTIALS if set, otherwise with
 * gcloud application-default credentials.
 */
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  planMigration,
  summarizePlan,
  type LegacyPriority,
  type LegacyRock,
} from "../src/lib/goal-migration";

const LEGACY_PLAN_YEAR = 2025;
const BATCH_LIMIT = 400;

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      i += 1;
    } else {
      args.set(key, true);
    }
  }
  return args;
}

function parseYears(raw: unknown): number[] {
  if (raw === undefined || raw === true) return [2025, 2026];
  const years = String(raw)
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((year) => Number.isFinite(year));
  if (years.length === 0) {
    throw new Error(`--years must be a comma-separated list, received "${raw}"`);
  }
  return years;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const companyId = String(args.get("company") ?? "default-company");
  const planYears = parseYears(args.get("years") ?? args.get("year"));
  const commit = args.get("commit") === true;
  const rollback = args.get("rollback") === true;

  if (!getApps().length) {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Falls back to gcloud application-default credentials, which is enough
      // for a one-off run from a machine that is already signed in.
      console.log(
        "GOOGLE_APPLICATION_CREDENTIALS is not set; using gcloud application-default credentials."
      );
    }
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT ?? "small-giants-opsp-2025",
    });
  }

  const db = getFirestore();
  const goalsRef = db.collection(`companies/${companyId}/goals`);
  const rocksRef = db.collection(`companies/${companyId}/rocks`);

  if (rollback) {
    await runRollback({ db, goalsRef, rocksRef, planYears, commit });
    return;
  }

  const existing = await goalsRef.get();
  const clashes = existing.docs.filter((d) =>
    planYears.includes(d.data().planYear)
  );
  if (clashes.length > 0) {
    console.log(
      `Warning: ${clashes.length} goal(s) already exist for ${planYears.join(", ")}. This run will add to them, not replace them.`
    );
  }

  const [prioritiesSnap, rocksSnap, usersSnap] = await Promise.all([
    db.collection(`companies/${companyId}/priorities`).get(),
    rocksRef.get(),
    db.collection("users").get(),
  ]);

  const priorities: LegacyPriority[] = prioritiesSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));
  const rocks: LegacyRock[] = rocksSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

  const departmentByUserId: Record<string, string | undefined> = {};
  const userIdByName: Record<string, string | undefined> = {};
  usersSnap.docs.forEach((d) => {
    const data = d.data() as any;
    if (data.deletedAt) return;
    departmentByUserId[d.id] = data.departmentId ?? undefined;
    if (data.name) userIdByName[data.name] = d.id;
    if (data.email) userIdByName[data.email] = d.id;
  });

  const plan = planMigration({
    companyId,
    planYears,
    legacyPlanYear: LEGACY_PLAN_YEAR,
    priorities,
    rocks,
    departmentByUserId,
    userIdByName,
  });

  const summary = summarizePlan(plan);

  console.log("");
  console.log(`Company:    ${companyId}`);
  console.log(`Plan years: ${planYears.join(", ")}`);
  console.log(`Mode:       ${commit ? "COMMIT" : "DRY RUN (no writes)"}`);
  console.log("");
  console.log(`Source: ${priorities.length} priorities, ${rocks.length} rocks`);
  console.log(`Planned annual priority goals: ${summary.annual}`);
  console.log(`Rocks to repoint:              ${summary.rocksRepointed}`);
  console.log(`Skipped:                       ${summary.skipped}`);
  console.log("");

  if (plan.skipped.length) {
    console.log("Skipped records:");
    plan.skipped.forEach((s) =>
      console.log(`  - ${s.collection}/${s.id}: ${s.reason}`)
    );
    console.log("");
  }

  if (plan.warnings.length) {
    console.log("Warnings:");
    plan.warnings.forEach((w) => console.log(`  ! ${w}`));
    console.log("");
  }

  if (!commit) {
    console.log("Goals that would be written:");
    plan.goals.forEach((g) =>
      console.log(`  [${g.draft.planYear}] ${g.draft.title}`)
    );
    console.log("");
    console.log("Rocks that would be repointed:");
    plan.rockUpdates.forEach((r) =>
      console.log(`  ${r.rockId} -> ${r.goalKey}`)
    );
    console.log("");
    console.log("Dry run complete. Re-run with --commit to write.");
    return;
  }

  const idByKey = new Map<string, string>();
  for (const planned of plan.goals) {
    const payload = Object.fromEntries(
      Object.entries(planned.draft).filter(([, v]) => v !== undefined)
    );
    const ref = await goalsRef.add(payload);
    idByKey.set(planned.key, ref.id);
  }
  console.log(`Wrote ${idByKey.size} goal(s).`);

  let batch = db.batch();
  let queued = 0;
  let repointed = 0;
  for (const update of plan.rockUpdates) {
    const goalId = idByKey.get(update.goalKey);
    if (!goalId) continue;

    batch.update(rocksRef.doc(update.rockId), {
      goalId,
      ownerId: update.ownerId,
      ownerName: update.ownerName,
      contributorIds: update.contributorIds,
      consultedIds: [],
      informedIds: [],
    });
    repointed += 1;
    queued += 1;

    if (queued === BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      queued = 0;
    }
  }
  if (queued > 0) await batch.commit();

  console.log(`Repointed ${repointed} rock(s) onto their new goals.`);
  console.log(
    "Priorities were left untouched, and rocks kept their priorityId. Use --rollback to undo."
  );
}

async function runRollback({
  db,
  goalsRef,
  rocksRef,
  planYears,
  commit,
}: {
  db: FirebaseFirestore.Firestore;
  goalsRef: FirebaseFirestore.CollectionReference;
  rocksRef: FirebaseFirestore.CollectionReference;
  planYears: number[];
  commit: boolean;
}) {
  const migrated = await goalsRef
    .where("migratedFrom.collection", "==", "priorities")
    .get();

  const forYears = migrated.docs.filter((d) =>
    planYears.includes(d.data().planYear)
  );
  const goalIds = new Set(forYears.map((d) => d.id));

  // Rocks only need reverting if they point at a goal being deleted. Their
  // priorityId was never removed, so clearing goalId restores the old link.
  const rocksSnap = await rocksRef.get();
  const affectedRocks = rocksSnap.docs.filter((d) =>
    goalIds.has(d.data().goalId)
  );

  console.log(
    `Rollback: ${forYears.length} migrated goal(s) and ${affectedRocks.length} repointed rock(s) for ${planYears.join(", ")}.`
  );

  if (!commit) {
    console.log("Dry run. Re-run with --commit to apply.");
    return;
  }

  let batch = db.batch();
  let queued = 0;
  const flush = async () => {
    if (queued === 0) return;
    await batch.commit();
    batch = db.batch();
    queued = 0;
  };

  for (const rock of affectedRocks) {
    batch.update(rock.ref, {
      goalId: FieldValue.delete(),
      ownerId: FieldValue.delete(),
      ownerName: FieldValue.delete(),
      contributorIds: FieldValue.delete(),
      consultedIds: FieldValue.delete(),
      informedIds: FieldValue.delete(),
    });
    queued += 1;
    if (queued === BATCH_LIMIT) await flush();
  }

  for (const goal of forYears) {
    batch.delete(goal.ref);
    queued += 1;
    if (queued === BATCH_LIMIT) await flush();
  }

  await flush();

  console.log(
    `Deleted ${forYears.length} goal(s) and reverted ${affectedRocks.length} rock(s).`
  );
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
