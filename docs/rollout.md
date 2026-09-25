# Goal Tracking Rollout

Order of operations for going live and retiring Workleap.

## Before anything ships

- [ ] Upgrade the Firebase project to **Blaze**. Cloud Functions will not deploy
      on Spark, and everything in Phases 5 to 7 depends on them. Set a budget
      alert at the same time.
- [ ] Store the credentials in Secret Manager:
      `firebase functions:secrets:set CLICKUP_API_TOKEN` and
      `firebase functions:secrets:set RESEND_API_KEY`.
- [ ] Add the web push key as `NEXT_PUBLIC_FIREBASE_VAPID_KEY` in `.env.local`
      and in the hosting build environment. Without it the push toggle stays
      disabled and explains why, rather than failing at runtime.
- [ ] Verify the `EMAIL_FROM` domain in the Resend dashboard and publish the
      DKIM and SPF records. Resend returns a 403 for any unverified sending
      domain, so nothing arrives until this is done.
- [ ] `npm run verify` passes: typecheck, functions build, app tests, functions
      tests.
- [ ] `npm run test:rules` passes. It needs a JDK on PATH for the Firestore
      emulator.

## Deploy order

Rules and indexes first, then functions, then hosting. Deploying hosting first
would put a UI in front of users that the backend cannot yet serve.

```
npm run deploy:rules
npm run deploy:functions
npm run deploy:hosting
```

Call the `health` callable once from a signed-in browser to confirm the Blaze
upgrade, the deploy pipeline, and the callable auth path all work.

## Data setup

1. **Departments.** Admin, Departments. Create every department and name a
   leader for each. Nothing else works properly without this: department goals
   have nowhere to live, the manager view is empty, and the leader write
   permission has nothing to match against.
2. **User assignment.** Admin Panel. Give every active person a department and a
   manager.
3. **Existing OPSP data.** Dry run first, always:
   ```
   npm run migrate:goals -- --year 2026
   npm run migrate:goals -- --year 2026 --commit
   ```
   The migration never deletes or mutates the source `priorities` and `rocks`
   documents, and `--rollback` removes everything it created.
4. **Workleap.** Export goals to CSV, then:
   ```
   npm run import:workleap -- --file ./workleap-export.csv --year 2026
   npm run import:workleap -- --file ./workleap-export.csv --year 2026 --commit
   ```
   Read the dry-run warnings before committing. Unmatched owner emails and
   unknown team names are reported per row.
5. **Re-parent the imports.** Workleap has no annual layer, so imported goals
   arrive as department and individual goals with no annual priority above
   them. Open Company Goals and attach them. The "Not linked to a priority"
   panel at the bottom of that page lists exactly what still needs doing.

## UAT checklist

Run through this as a normal user, not as an admin, and then again as an admin.

**Goal tree**
- [ ] Create an annual priority, a department goal under it, and an individual
      goal under that.
- [ ] The annual rollup reads `0/1 met` and the bar is empty.
- [ ] Complete every quarter on the department goal; the annual priority flips
      to met.
- [ ] Delete a goal that has children; the children move up to its parent rather
      than disappearing.
- [ ] The "Not linked to a priority" panel catches a department goal with no
      parent.

**Measurement**
- [ ] A numeric goal with a $10m annual target splits to $2.5m per quarter.
- [ ] Overriding Q3 to $4m and the rest to $2m still totals $10m.
- [ ] A point-in-time goal reports the latest quarter as the annual number, not
      the sum.
- [ ] A quarter past its midpoint and behind target shows as at risk.

**Permissions**
- [ ] A person who is neither owner, contributor, nor department leader sees a
      goal but has no edit or delete buttons.
- [ ] That same person is actually blocked by the rules, not just by the UI.
      Confirm with `npm run test:rules`.
- [ ] A non-admin cannot open Admin, Departments, or Integrations.

**ClickUp**
- [ ] Test connection succeeds against the real workspace.
- [ ] A linked task with quarterly subtasks syncs into the right quarters.
- [ ] A subtask with no quarter field and no due date produces a warning rather
      than landing in the wrong quarter.
- [ ] A hand-entered target survives a sync unchanged.
- [ ] Revoking the token produces a clear error on the goal and in the sync log,
      and notifies admins.

**Notifications**
- [ ] Assigning a goal emails the new owner and lands in their in-app inbox.
- [ ] Editing your own goal does **not** notify you.
- [ ] Marking a goal complete notifies the owner, contributors, and the
      department leader once each.
- [ ] Push works on Chrome desktop after enabling it in Notification settings.
- [ ] Weekly digest mode suppresses immediate email but keeps the inbox.
- [ ] A link in an email opens the app on the right view.

**Exports and rollups**
- [ ] The Goal Tree section appears in the PDF export with quarterly values.
- [ ] Executive Summary shows the goal rollup and the at-risk count.
- [ ] The Weekly Meeting agenda has a Goals step that can record a check-in.

## Hypercare

Keep the first two weeks deliberately noisy:

- Watch `firebase functions:log` daily for `Notification dispatch failed` and
  `ClickUp sync failed for goal`.
- Check Admin, Integrations for partial syncs. A partial sync means some goals
  updated and some did not, which is easy to miss.
- Leave Workleap read-only rather than deleting it until a full quarter has
  closed in the OPSP. The first quarter-end is the real test.

## Rollback

Every data step is reversible:

```
npm run import:workleap -- --rollback --commit
npm run migrate:goals -- --year 2026 --rollback --commit
```

Neither touches hand-created goals. Both only remove documents they wrote,
identified by their `migratedFrom` stamp.
