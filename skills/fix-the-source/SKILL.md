---
name: fix-the-source
description: Before fixing a failure, find the part of the system that produced it and fix that, instead of the place where it was noticed. Use when fixing a bug, a blocked or stuck agent, a failing check, a repeated question, a flaky step or a manual workaround; when about to add a special case, retry, allowlist entry, exception or one-off script; when the same kind of problem comes back; or when the user says "solve through improvement", "root cause", "fix it properly" or "why does this keep happening".
---

# Fix the source

Most fixes land where a problem was noticed: the failing ticket, the denied command, the broken test, the question in the inbox. That makes this instance pass and leaves whatever produced it running, so the same problem comes back in a new place. Fix the part that made the bad thing instead, then clean up what it already made.

## Steps

1. **Name what is wrong, concretely.** The bad state, where it showed up, and one piece of evidence (log line, file, ticket, output).
2. **Find where it was made.** Walk back from where it was noticed to the first step that created it: the template, prompt, rule, config, planner, generator, default or habit. The place it failed is downstream; keep walking until you reach something that will make it again. If your fix only edits outputs (data rows, tickets, generated files), the thing that made them is still running.
3. **Count the copies.** Search for other things the same producer already made: queued work, other files, other tickets, past logs. If there are none and the producer will not run again (a one-off hand edit, a typo), fix the instance and stop here. The remaining steps are for producers that keep producing.
4. **Look for an existing answer.** Before building anything, check whether the project, the codebase or the user already solves this elsewhere (a pattern, a tool, a convention, a working sibling). Reuse beats new machinery.
5. **Fix the producer.** Change it so it stops making the bad thing. Often the smallest change is a rule, an input it was missing, or deleting it.
6. **Repair what it already made.** Apply the fix to the copies found in step 3.
7. **Guard the boundary.** Where the producer hands its output on, add a check that refuses the bad shape, so a regression fails at creation instead of downstream. Keep the check as cheap as the failure: an assert, a schema, a lint rule, a required field.

## Is it a patch?

A fix is a patch when it lands downstream of the producer: answering the instance, widening a permission, adding a retry, catching the error, a manual step, a one-off script, or correcting the outputs while the producer keeps making them. A patch is fine as a stopgap while the real fix lands. Call it a patch when you ship it, and name the producer it leaves running.

Stop and re-trace when:
- the second fix for the same symptom fails, or the symptom comes back in a new place;
- you are about to add the third special case to the same list;
- a person keeps answering the same question the same way.

## Keep it small

The source fix is usually smaller than the patch pile it replaces. If the fix needs a new subsystem, re-check step 4. Sometimes the improvement is deletion: a part that never did its job can go.

## Example

An agent pipeline: a planner writes tickets, workers run them, a harness runs their commands.

| | Patch view | Source view |
|---|---|---|
| Symptom | A worker is denied a GUI command its acceptance check names, 7 retries in a row | Same |
| Where noticed | The worker's shell permissions | Same |
| Where made | | The planner copied checks meant for a person at a desktop into tickets a headless worker runs |
| Copies | | 6 more queued tickets with the same kind of check |
| Existing answer | | The project already tests headless and saves screenshots from a small capture script |
| Fix | Allowlist the GUI command, then the next form of it, then the next | Give the planner the list of commands a worker can run; checks must name one of them, or be a visual check for a person; rewrite the 6 queued tickets; ticket creation refuses a check no worker can run |

## Report

When you finish, report in this shape:

- **Symptom:** what was wrong, with the evidence.
- **Produced by:** the part that made it.
- **Copies:** how many others it already made, and where.
- **Existing answer:** what was reused, or "none".
- **Fix:** the change to the producer.
- **Repaired:** the copies fixed.
- **Guard:** the check that refuses the bad shape.
- **Patches left:** any stopgap shipped, and what it leaves running.
