# Goal Tracking

How the three-layer goal system works, for the people using it.

## The three layers

| Layer | What it is | Who owns it | How it is scored |
| --- | --- | --- | --- |
| Annual Priority | The handful of things the company must achieve this year | Leadership | Boolean. Met only when **every** department goal beneath it is met. |
| Department Goal | What a department commits to in service of a priority | The department | Percentage, from quarterly check-ins. |
| Individual Goal | What one person commits to | The person | Percentage. Visible to their manager, but does not change the department number. |

An annual priority with no department goals underneath it can never be met.
That is deliberate: it surfaces priorities nobody has actually taken on.

## Writing a goal

Every goal is described with five SMART prompts, each capped at 300 characters.
The cap is per field, not per goal, so there is room to be specific in each
answer without writing an essay. The five answers are joined into the one-line
description shown in list views.

## Measuring success

Pick one of two measurement types when you create the goal.

**Simple.** Each quarter you complete is worth 25%. Four quarters complete is
100%. Use this when the work is a sequence of deliverables rather than a number.

**Numeric target per quarter.** Enter an annual target and the system splits it
evenly across the four quarters. Override any quarter to weight it differently.
A $10m revenue goal can be $2m in Q1, Q2, and Q4 with $4m in Q3 — the split just
has to add back to the annual number.

Numeric goals also need to say how quarters add up:

- **Cumulative** — revenue, units sold, hires made. The year is the sum of the
  four quarters.
- **Point in time** — NPS, headcount, margin. The latest reported quarter *is*
  the annual number, not the sum.

Getting this wrong is the single most common source of nonsense dashboards, so
the form asks explicitly rather than guessing.

## Quarterly check-ins

Goals linked to ClickUp are checked in by the monthly recap (see below), so
their quarters are read-only for everyone but admins. For a goal with no
ClickUp link, open it and expand it to record the quarter's actual value and
mark it complete. The rollups above it update immediately.

A goal is flagged **at risk** when the quarter is more than halfway through and
the actual is tracking below target. Nobody sets that by hand.

## ClickUp

ClickUp is where the work happens: time estimates, time tracking, notes,
documentation, and progress updates. The OPSP is the record of what was
committed. Nobody updates a linked goal's progress in the OPSP.

### Who is named where

- **Department goals** have the full RACI plus an Executive Sponsor. They are
  the only goals that get a ClickUp task, and the sponsor stays in the OPSP.
- **Annual priorities** have the RACI without a sponsor.
- **Individual goals** have one owner.
- **Rocks** have an owner, anyone else working on them, and a due date.

**Sync people from ClickUp** on the User Management page adds every ClickUp member who
has no account yet to the user list, marked "ClickUp · not signed in", so a goal
can name someone who has never signed in. They can be given a role, department,
and manager like anyone else. When that person signs in with the same email,
they become that user: same role, department, manager, goals, and rocks. The
sync never removes or duplicates people; removing someone is done by hand.

### The yearly cycle

1. **Plan.** The team lead meets the team and leaves with a SMART breakdown of
   each goal.
2. **Create.** The lead creates the department goal in the OPSP. Saving it
   creates the ClickUp task in the location a superadmin set in the Admin
   Panel, writes the SMART breakdown as the task description, assigns the
   Accountable and Responsible people, and fills the Accountable, Responsible,
   Consulted, and Informed People fields. Editing the goal later updates the
   task the same way.
3. **Work.** The team works only in the ClickUp task: subtasks, docs,
   comments, whatever suits them.
4. **Rock plan.** Once the quarterly rocks are planned in the task, the ClickUp
   agent posts an **OPSP Rock Plan** comment listing each rock with its
   quarter, assignees, and due date.
5. **Monthly recap.** Each month after that, the agent posts a shorter **OPSP
   Monthly Recap** with progress, status, and the current rock list. A rock
   added mid-year shows up in that list and is imported.
6. **Approve.** The goal's Accountable person (or an admin) checks the comment
   and either replies **Approved** to it in ClickUp or presses **Approve** on
   the goal card in the OPSP. Nothing is applied until then.
7. **Sync.** Approved recaps are applied on the first Friday of each month, or
   sooner if an admin presses **Pull recaps from ClickUp** under Admin,
   Integrations. A manual sync during the month skips that month's scheduled
   run.

Applying a recap sets the goal's status, which quarters are complete, and, for
numeric goals, the quarter actuals. It adds new rocks and updates existing
ones, matched by title or ClickUp task link. A rock the agent stops listing is
left alone rather than deleted.

The sync **never overwrites a target**, because ClickUp reports what happened
and the OPSP records what was promised. If a recap is wrong, don't approve it.
Fix the task and rerun the agent; the newer recap replaces it. See
`functions/README.md` for the format the agent must follow.

## Notifications

You get told when a goal is assigned to you, when you are added as a
contributor, when a goal you are on goes at risk or completes, and when a
quarter check-in is coming due.

Change what reaches you, and through which channel, under the bell menu,
Notification settings. Turning on **Weekly digest only** holds email and push
and sends one Monday summary instead; the in-app inbox keeps working normally.

Push notifications are per browser. Enable them on each machine you use.
