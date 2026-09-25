// Run with `npm run test:rules`. The Firestore emulator this depends on
// requires a JDK on PATH; without one the suite cannot start.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const PROJECT_ID = "opsp-rules-test";
const COMPANY = "default-company";

const ALICE = "uid-alice"; // regular user, owns a goal
const BOB = "uid-bob"; // regular user, unrelated
const CARLA = "uid-carla"; // contributor on Alice's goal
const DANA = "uid-dana"; // leader of the Engineering department
const ADMIN = "uid-admin";

let testEnv: RulesTestEnvironment;

function db(uid?: string) {
  return uid
    ? testEnv.authenticatedContext(uid).firestore()
    : testEnv.unauthenticatedContext().firestore();
}

const goalRef = (fs: any, id: string) =>
  doc(fs, "companies", COMPANY, "goals", id);

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();

    await setDoc(doc(fs, "users", ALICE), { role: "user", name: "Alice" });
    await setDoc(doc(fs, "users", BOB), { role: "user", name: "Bob" });
    await setDoc(doc(fs, "users", CARLA), { role: "user", name: "Carla" });
    await setDoc(doc(fs, "users", DANA), { role: "user", name: "Dana" });
    await setDoc(doc(fs, "users", ADMIN), { role: "admin", name: "Admin" });

    await setDoc(doc(fs, "companies", COMPANY, "departments", "engineering"), {
      name: "Engineering",
      leaderId: DANA,
      memberIds: [ALICE, CARLA],
    });

    await setDoc(goalRef(fs, "goal-alice"), {
      title: "Ship the thing",
      level: "individual",
      ownerId: ALICE,
      contributorIds: [CARLA],
      departmentId: "engineering",
      planYear: 2026,
    });

    await setDoc(goalRef(fs, "goal-orphan"), {
      title: "Unowned goal",
      level: "individual",
      ownerId: BOB,
      contributorIds: [],
      departmentId: "",
      planYear: 2026,
    });
  });
});

describe("unauthenticated access", () => {
  it("cannot read goals", async () => {
    await assertFails(getDoc(goalRef(db(), "goal-alice")));
  });

  it("cannot write goals", async () => {
    await assertFails(setDoc(goalRef(db(), "goal-new"), { title: "nope" }));
  });

  it("cannot read user profiles", async () => {
    await assertFails(getDoc(doc(db(), "users", ALICE)));
  });
});

describe("goal reads", () => {
  it("any authenticated user can read any goal", async () => {
    await assertSucceeds(getDoc(goalRef(db(BOB), "goal-alice")));
  });
});

describe("goal writes", () => {
  it("owner can update their own goal", async () => {
    await assertSucceeds(
      updateDoc(goalRef(db(ALICE), "goal-alice"), { title: "Ship it faster" })
    );
  });

  it("contributor can update the goal", async () => {
    await assertSucceeds(
      updateDoc(goalRef(db(CARLA), "goal-alice"), { title: "Contributor edit" })
    );
  });

  it("department leader can update a goal in their department", async () => {
    await assertSucceeds(
      updateDoc(goalRef(db(DANA), "goal-alice"), { title: "Leader edit" })
    );
  });

  it("admin can update any goal", async () => {
    await assertSucceeds(
      updateDoc(goalRef(db(ADMIN), "goal-alice"), { title: "Admin edit" })
    );
  });

  it("an unrelated user cannot update someone else's goal", async () => {
    await assertFails(
      updateDoc(goalRef(db(BOB), "goal-alice"), { title: "Hostile edit" })
    );
  });

  it("an unrelated user cannot delete someone else's goal", async () => {
    await assertFails(deleteDoc(goalRef(db(BOB), "goal-alice")));
  });

  it("a department leader has no authority outside their department", async () => {
    await assertFails(
      updateDoc(goalRef(db(DANA), "goal-orphan"), { title: "Out of scope" })
    );
  });

  it("a user cannot reassign a goal away from themselves to escape checks", async () => {
    await assertFails(
      updateDoc(goalRef(db(ALICE), "goal-alice"), { ownerId: BOB })
    );
  });

  it("a user can create a goal they own", async () => {
    await assertSucceeds(
      setDoc(goalRef(db(BOB), "goal-bob-new"), {
        title: "Bob's goal",
        level: "individual",
        ownerId: BOB,
        contributorIds: [],
        departmentId: "",
      })
    );
  });

  it("a user cannot create a goal owned by someone else", async () => {
    await assertFails(
      setDoc(goalRef(db(BOB), "goal-forged"), {
        title: "Forged",
        level: "individual",
        ownerId: ALICE,
        contributorIds: [],
        departmentId: "",
      })
    );
  });
});

describe("quarterly targets inherit goal permissions", () => {
  const quarterRef = (fs: any, goalId: string, q: string) =>
    doc(fs, "companies", COMPANY, "goals", goalId, "quarters", q);

  it("owner can write a quarter", async () => {
    await assertSucceeds(
      setDoc(quarterRef(db(ALICE), "goal-alice", "Q1"), { target: 100 })
    );
  });

  it("unrelated user cannot write a quarter", async () => {
    await assertFails(
      setDoc(quarterRef(db(BOB), "goal-alice", "Q1"), { target: 999 })
    );
  });
});

describe("departments", () => {
  it("any authenticated user can read departments", async () => {
    await assertSucceeds(
      getDoc(doc(db(BOB), "companies", COMPANY, "departments", "engineering"))
    );
  });

  it("a regular user cannot create a department", async () => {
    await assertFails(
      setDoc(doc(db(BOB), "companies", COMPANY, "departments", "sales"), {
        name: "Sales",
        leaderId: BOB,
        memberIds: [],
      })
    );
  });

  it("an admin can create a department", async () => {
    await assertSucceeds(
      setDoc(doc(db(ADMIN), "companies", COMPANY, "departments", "sales"), {
        name: "Sales",
        leaderId: BOB,
        memberIds: [],
      })
    );
  });

  it("a leader cannot hand leadership to someone else", async () => {
    await assertFails(
      updateDoc(
        doc(db(DANA), "companies", COMPANY, "departments", "engineering"),
        { leaderId: BOB }
      )
    );
  });

  it("a leader can rename their own department", async () => {
    await assertSucceeds(
      updateDoc(
        doc(db(DANA), "companies", COMPANY, "departments", "engineering"),
        { name: "Engineering & Platform" }
      )
    );
  });
});

describe("user profile protection", () => {
  it("a user cannot escalate their own role", async () => {
    await assertFails(
      updateDoc(doc(db(ALICE), "users", ALICE), { role: "superadmin" })
    );
  });

  it("a user cannot assign their own department", async () => {
    await assertFails(
      updateDoc(doc(db(ALICE), "users", ALICE), { departmentId: "engineering" })
    );
  });

  it("a user can update their own display name", async () => {
    await assertSucceeds(
      updateDoc(doc(db(ALICE), "users", ALICE), { name: "Alice A." })
    );
  });

  it("a user cannot edit another user's profile", async () => {
    await assertFails(
      updateDoc(doc(db(BOB), "users", ALICE), { name: "Hacked" })
    );
  });
});

describe("private per-user data", () => {
  it("a user can read their own notifications", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "users", ALICE, "notifications", "n1"),
        { title: "Goal assigned", read: false }
      );
    });

    await assertSucceeds(
      getDoc(doc(db(ALICE), "users", ALICE, "notifications", "n1"))
    );
  });

  it("a user cannot read another user's notifications", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "users", ALICE, "notifications", "n1"),
        { title: "Goal assigned", read: false }
      );
    });

    await assertFails(
      getDoc(doc(db(BOB), "users", ALICE, "notifications", "n1"))
    );
  });

  it("a user cannot plant a notification in someone else's inbox", async () => {
    await assertFails(
      setDoc(doc(db(BOB), "users", ALICE, "notifications", "spam"), {
        title: "Click here",
        read: false,
      })
    );
  });

  it("a user can dismiss their own notification", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users", ALICE, "notifications", "n1"), {
        title: "Goal assigned",
        read: false,
      });
    });

    await assertSucceeds(
      updateDoc(doc(db(ALICE), "users", ALICE, "notifications", "n1"), { read: true })
    );
  });

  it("a user cannot read another user's notification preferences", async () => {
    await assertFails(
      getDoc(doc(db(BOB), "users", ALICE, "settings", "notifications"))
    );
  });

  it("a user cannot steal another user's push tokens", async () => {
    await assertFails(
      getDoc(doc(db(BOB), "users", ALICE, "pushTokens", "t1"))
    );
  });
});

describe("integrations and sync logs", () => {
  it("a regular user cannot read the ClickUp integration config", async () => {
    await assertFails(
      getDoc(doc(db(BOB), "companies", COMPANY, "integrations", "clickup"))
    );
  });

  it("an admin can write the ClickUp integration config", async () => {
    await assertSucceeds(
      setDoc(doc(db(ADMIN), "companies", COMPANY, "integrations", "clickup"), {
        workspaceId: "123",
      })
    );
  });

  it("sync logs are not client writable, even by an admin", async () => {
    await assertFails(
      setDoc(doc(db(ADMIN), "companies", COMPANY, "syncLogs", "log1"), {
        status: "ok",
      })
    );
  });
});

describe("label overrides", () => {
  it("a regular user cannot rewrite nav labels", async () => {
    await assertFails(
      setDoc(doc(db(BOB), "companies", COMPANY, "settings", "labels"), {
        "nav.rocks": "Hacked",
      })
    );
  });
});
