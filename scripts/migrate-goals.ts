/**
 * Converts legacy `priorities` and `rocks` documents into the unified `goals`
 * collection.
 *
 * Dry run (default, writes nothing):
 *   npx tsx scripts/migrate-goals.ts --company default-company --year 2026
 *
 * Commit:
 *   npx tsx scripts/migrate-goals.ts --company default-company --year 2026 --commit
 *
 * Roll back a committed run:
 *   npx tsx scripts/migrate-goals.ts --company default-company --year 2026 --rollback
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS to point at a service account key.
 * The script never deletes or mutates the source documents.
 */
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  planMigration,
  summarizePlan,
  type LegacyPriority,
  type LegacyRock,
} from "../src/lib/goal-migration";

const LEGACY_PLAN_YEAR = 2025;

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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const companyId = String(args.get("company") ?? "default-company");
  const planYear = Number(args.get("year") ?? new Date().getFullYear());
  const commit = args.get("commit") === true;
  const rollback = args.get("rollback") === true;

  if (!Number.isFinite(planYear)) {
    throw new Error(`--year must be a number, received "${args.get("year")}"`);
  }

  if (!getApps().length) {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      throw new Error(
        "GOOGLE_APPLICATION_CREDENTIALS is not set. Point it at a service account key with Firestore access."
      );
    }
    initializeApp({ credential: applicationDefault() });
  }

  const db = getFirestore();
  const goalsRef = db.collection(`companies/${companyId}/goals`);

  if (rollback) {
    const migrated = await goalsRef.where("migratedFrom.collection", "in", [
      "priorities",
      "rocks",
    ]).get();

    const forYear = migrated.docs.filter(
      (d) => d.data().planYear === planYear
    );

    console.log(
      `Rollback: found ${forYear.length} migrated goal(s) for ${planYear}.`
    );

    if (!commit) {
      console.log("Dry run. Re-run with --commit to delete them.");
      return;
    }

    let batch = db.batch();
    let queued = 0;
    for (const docSnap of forYear) {
      batch.delete(docSnap.ref);
      queued += 1;
      if (queued % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    if (queued % 400 !== 0) await batch.commit();

    console.log(`Deleted ${forYear.length} migrated goal(s).`);
    return;
  }

  const existing = await goalsRef.where("planYear", "==", planYear).get();
  if (!existing.empty) {
    console.log(
      `Warning: ${existing.size} goal(s) already exist for ${planYear}. This run will add to them, not replace them.`
    );
  }

  const [prioritiesSnap, rocksSnap, usersSnap] = await Promise.all([
    db.collection(`companies/${companyId}/priorities`).get(),
    db.collection(`companies/${companyId}/rocks`).get(),
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
    planYear,
    legacyPlanYear: LEGACY_PLAN_YEAR,
    priorities,
    rocks,
    departmentByUserId,
    userIdByName,
  });

  const summary = summarizePlan(plan);

  console.log("");
  console.log(`Company:   ${companyId}`);
  console.log(`Plan year: ${planYear}`);
  console.log(`Mode:      ${commit ? "COMMIT" : "DRY RUN (no writes)"}`);
  console.log("");
  console.log(`Source: ${priorities.length} priorities, ${rocks.length} rocks`);
  console.log(
    `Planned goals: ${summary.total} (annual ${summary.annual}, department ${summary.department}, individual ${summary.individual})`
  );
  console.log(`Skipped: ${summary.skipped}`);
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
    console.log("Sample of goals that would be written:");
    plan.goals.slice(0, 10).forEach((g) =>
      console.log(
        `  [${g.draft.level}] ${g.draft.title}${g.parentKey ? ` (under ${g.parentKey})` : ""}`
      )
    );
    if (plan.goals.length > 10) {
      console.log(`  ... and ${plan.goals.length - 10} more`);
    }
    console.log("");
    console.log("Dry run complete. Re-run with --commit to write.");
    return;
  }

  // Parents are written first so children can reference real document ids.
  const idByKey = new Map<string, string>();
  const ordered = [
    ...plan.goals.filter((g) => !g.parentKey),
    ...plan.goals.filter((g) => g.parentKey),
  ];

  let written = 0;
  for (const planned of ordered) {
    const parentGoalId = planned.parentKey
      ? idByKey.get(planned.parentKey) ?? null
      : null;

    const payload = Object.fromEntries(
      Object.entries({ ...planned.draft, parentGoalId }).filter(
        ([, v]) => v !== undefined
      )
    );

    const ref = await goalsRef.add(payload);
    idByKey.set(planned.key, ref.id);
    written += 1;
  }

  console.log(`Wrote ${written} goal(s).`);
  console.log(
    "Source priorities and rocks were left untouched. Use --rollback to undo."
  );
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
