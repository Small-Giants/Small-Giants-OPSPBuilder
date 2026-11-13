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
   firebase functions:secrets:set RESEND_API_KEY
   ```

   A function only receives a secret if it declares it in its `secrets` option,
   so adding a secret here does not expose it to every function.

3. **Verify the sending domain in Resend.** Email goes out through Resend, which
   rejects any `from` address on an unverified domain with a 403. Add
   `smallgiantsonline.com` under Domains in the Resend dashboard and publish the
   DKIM and SPF records it gives you before expecting mail to arrive.

4. **Set the non-secret config** if the defaults in `src/config.ts` are wrong for
   your environment, via `functions/.env`:

   ```
   APP_BASE_URL=https://opsp.smallgiantsonline.com
   EMAIL_FROM=opsp@smallgiantsonline.com
   EMAIL_FROM_NAME=Small Giants OPSP
   ```

## Local development

```
npm --prefix functions install
npm run emulators            # auth, firestore, functions
```

Point the app at the emulator by setting `NEXT_PUBLIC_USE_EMULATORS=true` in
`.env.local`. Without it, `next dev` talks to the deployed backend.

The Firestore emulator needs JDK 21 or newer on PATH. Install Temurin 21 if
`firebase emulators:start` complains about Java.

## Deploy

```
npm run verify               # typecheck, build functions, unit tests
npm run deploy:functions
```

### The runtime service account needs Firestore access

The organization disables Google's automatic Editor grant for default service
accounts, so the functions' runtime account
(`10058852488-compute@developer.gserviceaccount.com`) starts with no data
access, and every Firestore call fails with `PERMISSION_DENIED`. It has been
granted **Cloud Datastore User** (`roles/datastore.user`) on the project. A new
project, or a change of runtime account, needs the same grant. Sending push
notifications would additionally need a Firebase Cloud Messaging role.

### New callable functions need one extra step

The Google Workspace organization enforces domain restricted sharing, so the
deploy cannot grant `allUsers` the Cloud Run invoker role that callables rely
on. Without it the browser gets a 403 on the CORS preflight and the app shows
"internal". Instead, turn off Cloud Run's invoker check once per new callable;
the setting survives later deploys, and each callable still verifies Firebase
Auth through `requireCaller`:

```
gcloud run services update <function name, lowercase> --region us-central1 --no-invoker-iam-check
```

Or in the Cloud Console: Cloud Run, the service, Security, Authentication,
"Allow public access". Never do this for event or scheduled functions.

### Goal statements use Vertex AI

`writeSmartGoal` turns a goal's five SMART answers into one sentence with
Vertex AI Gemini, called as the runtime account through the `global` location.
The Vertex AI API is enabled and the runtime account holds **Vertex AI User**
(`roles/aiplatform.user`). The model defaults to `gemini-3.8-flash`; set
`GEMINI_MODEL` in the project's `.env` file to change it. Older models are
not served in this project, so check a replacement works in `global` first.

Admins edit the prompt under **Goal statement prompt** in the Admin Panel. It
is stored in `companies/default-company/ai/goal-statement` and read on every
call, so changes need no deploy. A blank value means the built-in prompt in
`src/ai/statement-instructions.ts`. The goal name and answers are always
appended by code.

## ClickUp workspace setup

### One-time setup

1. **Location.** A superadmin pastes the URL of the ClickUp List for goal
   tasks into **ClickUp goal location** in the Admin Panel. A Space URL also
   works if the Space has exactly one List.
2. **RACI fields.** Tasks in that List need People custom fields named exactly
   `Accountable`, `Responsible`, `Consulted`, and `Informed`. There is no
   Executive Sponsor field; the sponsor lives only in the OPSP.
3. **People.** An admin presses **Sync people from ClickUp** in the Admin
   Panel. Every ClickUp member (guests excluded) whose email has no user record
   yet, including deleted ones, gets a placeholder user with id
   `clickup:<member id>`. It can be given a role, department, and manager, and
   assigned to goals. Syncing never removes or duplicates anyone. Placeholders
   get no notifications.
4. **Agent.** Give the ClickUp agent the two formats below.

### What each function does

| Function | When it runs |
| --- | --- |
| `writeSmartGoal` | User presses **Write goal statement** on the goal form, or saves a goal with SMART answers and no statement. Returns one sentence the user can edit. |
| `pushGoalToClickUp` | After a department goal is saved. Creates its task: name, goal statement followed by the SMART breakdown, dates, assignees (Accountable and Responsible), and the four RACI People fields. Once the task exists it only fills fields that are empty in ClickUp; it never overwrites or removes anything, and never renames the task. People with no ClickUp account come back as a warning. |
| `syncClickUp` | Admin presses **Pull recaps from ClickUp**. |
| `scheduledClickUpSync` | 7am Arizona time every Friday. It only runs on the first Friday of the month, and skips that month if an admin already synced manually. In January it also covers the previous plan year. |
| `approveClickUpRecap` | The goal's Accountable person or an admin presses **Approve** on the goal card. |
| `refreshClickUpMembers` | Admin presses **Sync people from ClickUp**. |
| `relinkClickUpPerson` | A user signs in for the first time. If a placeholder has their email, the new account takes over its role, department, manager, and deleted state, every goal, rock, manager, and department-leader reference moves to the new account, and the placeholder is deleted. |

### Approval

A recap only applies once it is approved, either:

- in ClickUp, by a reply that starts with `Approved` in the comment's thread,
  from the goal's Accountable person or an admin; or
- in the app, with **Approve** on the goal card.

Each sync applies every approved recap that hasn't been applied yet, oldest
first. The newest unapproved recap shows on the goal card as waiting. Once a
newer recap is approved, older unapproved ones are skipped for good.

### Agent formats

The sync recognizes a recap by its first line (`OPSP Rock Plan` or `OPSP
Monthly Recap`; editable under Integrations) and reads only the `OPSP ROCKS`
and `OPSP DATA` blocks. Everything else is narrative, stored and shown on the
goal card.

**First run: the rock plan.**

```
OPSP Rock Plan

<short overview of the plan for the year>

OPSP ROCKS
Q1 | Launch the new pricing page | Assignees: Patrick Kuhl, Thomas Rider | Due: 2026-03-31
Q2 | Hire a contract designer | Assignees: Nicole Matt | Due: 2026-06-30
Q3 | Ship the onboarding flow | Assignees: James Richardson | Due: 2026-09-30 | Task: https://app.clickup.com/t/868h790bp
END OPSP ROCKS
```

**Every month after: the monthly recap.** It lists every rock again, with its
status, so status changes and newly added rocks are picked up.

```
OPSP Monthly Recap

<detailed narrative of what was completed in the last month>

OPSP DATA
Period: October 2026
Status: On Track
Summary: One or two sentences for the goal card.
Completed quarters: Q1, Q2
Q3 actual: 1250000
END OPSP DATA

OPSP ROCKS
Q1 | Launch the new pricing page | Assignees: Patrick Kuhl, Thomas Rider | Due: 2026-03-31 | Status: Complete
Q2 | Hire a contract designer | Assignees: Nicole Matt | Due: 2026-06-30 | Status: Complete
Q3 | Ship the onboarding flow | Assignees: James Richardson | Due: 2026-09-30 | Status: In Progress
Q4 | Add a referral program | Assignees: Thomas Rider | Due: 2026-12-15 | Status: Not Started
END OPSP ROCKS
```

Each rock line is `Quarter | Title | Assignees | Due | Status | Task`, split on
`|`. Only the quarter and title are required. The first assignee becomes the
rock's owner. Names are matched to people by email, then full name, then a
unique first name. A rock is matched to an existing one by its `Task` link,
otherwise by title, so renaming a rock without a task link creates a new one.

| Line | Effect on the goal |
| --- | --- |
| `Status` | `On Track`, `At Risk` (or `Off Track`), `Complete`, or `Not Started`. Sets the goal status. |
| `Completed quarters` | The exact set of quarters that are done, or `None`. Leave the line out to leave completion unchanged. |
| `Qn actual` | Numeric goals only. Sets that quarter's actual. `$1,250,000` and `1.25m` both parse. |
| `Period`, `Summary` | Display only. |

Rock `Status` accepts `Not Started`, `Ready`, `In Progress`, or `Complete`.
`Due` accepts `2026-03-31`, `3/31/2026`, or `March 31, 2026`.

Markdown bold and bullets are tolerated. Targets are never overwritten, and a
rock the agent stops listing is left alone. Anything the sync cannot read comes
back as a warning on the Integrations page and on the goal card. A recap is
applied once; to correct one, rerun the agent and approve the new comment.

Agent comments can come back from the API without a user id, so the recap is
recognised by its heading. Set **Agent name** under Integrations to also require
that the author's name contains a given string.

To see what the sync would read from a task without changing anything:

```
CLICKUP_API_TOKEN=pk_... npm run preview:recap -- https://app.clickup.com/t/868h790bp
```

## Verifying the setup

Call the `health` callable from the app once deployed. It checks the caller's
auth token, domain, and Firestore user record, and returns their role. If it
succeeds, the Blaze upgrade, deploy pipeline, and callable auth path all work.
