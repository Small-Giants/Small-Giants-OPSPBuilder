/**
 * Imports a Workleap goal CSV export into the `goals` collection.
 *
 * Dry run (default, writes nothing):
 *   npx tsx scripts/import-workleap.ts --file ./workleap-export.csv --year 2026
 *
 * Commit:
 *   npx tsx scripts/import-workleap.ts --file ./workleap-export.csv --year 2026 --commit
 *
 * Roll back a committed run:
 *   npx tsx scripts/import-workleap.ts --rollback
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS to point at a service account key.
 * Imported goals land as department and individual goals; somebody has to
 * attach them to annual priorities afterwards, because Workleap has no
 * equivalent layer to read that from.
 */
import { readFileSync } from "node:fs";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  planWorkleapImport,
  resolveParents,
  summarizeImport,
  type ImportContext,
  type ImportedGoal,
} from "../src/lib/workleap-import";

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
  const file = args.get("file");

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
    const imported = await goalsRef.where("migratedFrom.collection", "==", "workleap").get();
    console.log(`Found ${imported.size} imported goal(s).`);

    if (!commit) {
      console.log("Dry run. Re-run with --rollback --commit to delete them.");
      return;
    }

    const batch = db.batch();
    imported.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`Deleted ${imported.size} imported goal(s).`);
    return;
  }

  if (typeof file !== "string") {
    throw new Error("--file is required. Point it at the Workleap CSV export.");
  }

  const context = await loadContext(db, companyId, planYear);
  const plan = planWorkleapImport(readFileSync(file, "utf8"), context);

  if (plan.missingColumns.length > 0) {
    throw new Error(
      `The export is missing required column(s): ${plan.missingColumns.join(", ")}. ` +
        "Re-export from Workleap with the goal name included."
    );
  }

  console.log(summarizeImport(plan));
  plan.skipped.forEach((s) => console.log(`  skipped row ${s.row}: ${s.reason}`));
  plan.warnings.forEach((w) => console.log(`  warning: ${w}`));

  if (!commit) {
    console.log("\nDry run. Nothing was written. Re-run with --commit to import.");
    return;
  }

  // Ids have to exist before parents can be linked, so allocate refs up front.
  const withIds = plan.goals.map((goal) => ({
    ...goal,
    id: goalsRef.doc().id,
  })) as (ImportedGoal & { id: string })[];

  const { resolved, orphaned } = resolveParents(withIds);
  console.log(`\nLinked ${resolved} child goal(s) to a parent.`);
  if (orphaned.length > 0) {
    console.log(`  no parent found for: ${orphaned.join(", ")}`);
  }

  // Firestore batches cap at 500 writes.
  for (let i = 0; i < withIds.length; i += 400) {
    const batch = db.batch();
    for (const { id, parentTitle: _parentTitle, ...goal } of withIds.slice(i, i + 400)) {
      batch.set(goalsRef.doc(id), {
        ...goal,
        companyId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    await batch.commit();
  }

  console.log(`\nImported ${withIds.length} goal(s) into ${companyId} for ${planYear}.`);
  console.log(
    "Next: open Company Goals and attach the department goals to their annual priorities."
  );
}

async function loadContext(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  planYear: number
): Promise<ImportContext> {
  const [users, departments] = await Promise.all([
    db.collection(`companies/${companyId}/users`).get(),
    db.collection(`companies/${companyId}/departments`).get(),
  ]);

  const usersByEmail = new Map<
    string,
    { id: string; name: string; departmentId?: string | null }
  >();
  users.docs.forEach((doc) => {
    const data = doc.data();
    if (data.deletedAt) return;
    const email = String(data.email ?? "").toLowerCase();
    if (!email) return;
    usersByEmail.set(email, {
      id: doc.id,
      name: String(data.name ?? data.email ?? ""),
      departmentId: data.departmentId ?? null,
    });
  });

  const departmentsByName = new Map<string, string>();
  departments.docs.forEach((doc) => {
    const name = String(doc.data().name ?? "").toLowerCase();
    if (name) departmentsByName.set(name, doc.id);
  });

  console.log(
    `Matched against ${usersByEmail.size} active user(s) and ${departmentsByName.size} department(s).`
  );

  return { planYear, usersByEmail, departmentsByName };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
