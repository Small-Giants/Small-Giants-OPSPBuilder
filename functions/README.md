# OPSP Cloud Functions

Backend for the pieces the static app cannot do itself: talking to ClickUp with
a private token, and sending email and push notifications.

## One-time setup

1. **Upgrade the Firebase project to Blaze.** Cloud Functions will not deploy on
   Spark. This is a billing change in the Firebase console and cannot be scripted.
   Set a budget alert at the same time; expected steady-state cost for this
   workload is a few dollars a month.

2. **Store the credentials in Secret Manager**, not in Firestore:

   ```
   firebase functions:secrets:set CLICKUP_API_TOKEN
   firebase functions:secrets:set SENDGRID_API_KEY
   ```

   A function only receives a secret if it declares it in its `secrets` option,
   so adding a secret here does not expose it to every function.

3. **Set the non-secret config** if the defaults in `src/config.ts` are wrong for
   your environment, via `functions/.env`:

   ```
   APP_BASE_URL=https://opsp.smallgiantsonline.com
   EMAIL_FROM=opsp@smallgiantsonline.com
   ```

## Local development

```
npm --prefix functions install
npm run emulators            # auth, firestore, functions
```

Point the app at the emulator by setting `NEXT_PUBLIC_USE_EMULATORS=true` in
`.env.local`. Without it, `next dev` talks to the deployed backend.

The Firestore emulator needs a JDK on PATH. Install Temurin 17 if
`firebase emulators:start` complains about Java.

## Deploy

```
npm run verify               # typecheck, build functions, unit tests
npm run deploy:functions
```

## ClickUp workspace setup

The sync reads one ClickUp task per goal, plus its subtasks. For it to place
work in the right quarter, the workspace needs two custom fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `Quarter` | dropdown or text | Which quarter a subtask counts toward. Values like `Q2`, `q2 2026`, and `Quarter 2` all parse. |
| `Actual` | number | The value rolled into the quarter actual, for quantitative goals only. |

Both names are configurable under Admin, Integrations. When `Quarter` is empty,
the subtask's due date decides the quarter instead; a subtask with neither is
skipped and reported as a warning.

Simple goals ignore `Actual` entirely: a quarter is complete when every subtask
in it is in a closed column. Targets entered in the OPSP are never overwritten
by a sync, because ClickUp reports what happened and the OPSP records what was
committed.

## Verifying the setup

Call the `health` callable from the app once deployed. It checks the caller's
auth token, domain, and Firestore user record, and returns their role. If it
succeeds, the Blaze upgrade, deploy pipeline, and callable auth path all work.
