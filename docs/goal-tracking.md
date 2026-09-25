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

Every goal is described with five SMART prompts, each capped at 100 characters.
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

Open a goal and expand it to record the quarter's actual value, mark it
complete, and leave a note. The rollups above it update immediately.

A goal is flagged **at risk** when the quarter is more than halfway through and
the actual is tracking below target. Nobody sets that by hand.

## ClickUp

ClickUp remains the place where the work actually happens: time estimates, time
tracking, notes, documentation. The OPSP is the record of what was committed.

Link a goal to a ClickUp task by pasting the task URL into the goal form. Press
the sync button on the goal, or sync everything from Admin, Integrations, to
pull task progress into the quarters.

The sync **never overwrites a target**. It only fills in actuals and completion,
because ClickUp reports what happened and the OPSP records what was promised.

For the sync to place work in the right quarter, ClickUp subtasks need either a
`Quarter` custom field or a due date. See `functions/README.md` for the field
setup.

## Notifications

You get told when a goal is assigned to you, when you are added as a
contributor, when a goal you are on goes at risk or completes, and when a
quarter check-in is coming due.

Change what reaches you, and through which channel, under the bell menu,
Notification settings. Turning on **Weekly digest only** holds email and push
and sends one Monday summary instead; the in-app inbox keeps working normally.

Push notifications are per browser. Enable them on each machine you use.
