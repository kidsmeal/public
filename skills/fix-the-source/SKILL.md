---
name: fix-the-source
description: Before fixing a failure, find the part of the system that produced it and fix that, instead of the place where it was noticed. Use when fixing a bug, a blocked or stuck agent, a failing check, a repeated question, a flaky step or a manual workaround; when about to add a special case, retry, allowlist entry, exception or one-off script; when a fix did not hold or the same kind of problem comes back; or when the user says "solve through improvement", "root cause", "fix it properly" or "why does this keep happening".
---

# Fix the source

Most fixes land where a problem was noticed: the failing ticket, the denied command, the broken test, the question in the inbox. That makes this instance pass and leaves whatever produced it running, so the same problem comes back in a new place. Fix the part that made the bad thing instead, then clean up what it already made.

## Steps

1. **Name what is wrong, concretely.** The bad state, where it showed up, one piece of evidence (log line, file, ticket, output), and whether it has happened before (the same signature in logs, tickets or past fixes).
2. **Find where it was made.** Walk back from where it was noticed to the first step that created it: the template, prompt, rule, config, planner, generator, default or habit. The place it failed is downstream; keep walking until you reach something that will make it again. Stop at the first producer the evidence supports and whose fix prevents the repeat; tracing further costs more than the failure. If the evidence does not settle which part made it, report your best candidate as unverified instead of fixing a guess. If your fix only edits outputs (data rows, tickets, generated files), the thing that made them is still running.
   Question the request too. The command a worker needs, the check it must pass or the change someone asks for can itself be a bad output of an earlier step. A failure can have more than one producer; after finding one, ask why the failing step was needed at all.
3. **Count the copies.** Search for other things the same producer already made: queued work, other files, other tickets, past logs. If there are none and the producer will not run again (a one-off hand edit, a typo), fix the instance and stop here. People editing files by hand is not a producer that keeps running unless the same mistake has happened before. The remaining steps are for producers that keep producing.
4. **Look for an existing answer.** Before building anything, check how the same job is already done: elsewhere in the codebase, in sibling projects, in the team's docs, or in how the user does it by hand (a pattern, a tool, a convention, a working sibling). Reuse beats new machinery.
5. **Fix the producer.** Change it so it stops making the bad thing. Often the smallest change is a rule, an input it was missing, or deleting it. List what else consumes its output; a change there can break them. When the producer is not yours to change (a vendor, a model, another team), the guard where its output enters your system is the fix, plus a report to its owner.
6. **Repair what it already made.** Apply the fix to the copies found in step 3 that sit inside your task. Copies in shared systems, external trackers, production data or anything irreversible: list them and ask before changing them.
7. **Guard the boundary.** Where the producer hands its output on, add a check that refuses the bad shape, so a regression fails at creation instead of downstream. Keep the check as cheap as the failure: an assert, a schema, a lint rule, a required field. Prefer a check that makes the bad shape impossible to create over one that reports it afterward; a comment or a "be careful" note is not a guard. Reuse an existing check when one covers the shape. Skip the guard when the fix already makes the bad shape impossible (a deleted step, a required input), and say so.
8. **Verify.** Reproduce the original symptom and show it gone, run the tests that cover the producer and its other consumers, and check one repaired copy. Anything you could not run is unverified in the report.

## Is it a patch?

A fix is a patch when it lands downstream of the producer: answering the instance, widening a permission, adding a retry, catching the error, a manual step, a one-off script, or correcting the outputs while the producer keeps making them. A patch is fine as a stopgap while the real fix lands. Call it a patch when you ship it, and name the producer it leaves running.

Stop and re-trace when:
- the second fix for the same symptom fails, or the symptom comes back in a new place;
- you are about to add the third special case to the same list;
- a person keeps answering the same question the same way.

## Keep it small

The source fix is usually smaller than the patch pile it replaces. If the fix needs a new subsystem, re-check step 4. Sometimes the improvement is deletion: a part that never did its job can go.

## Report

When you finish, report in this shape:

- **Symptom:** what was wrong, with the evidence.
- **Produced by:** the part that made it, and the evidence that it did.
- **Copies:** how many others it already made, and where.
- **Existing answer:** what was reused, or "none".
- **Fix:** the change to the producer.
- **Repaired:** the copies fixed.
- **Guard:** the check that refuses the bad shape.
- **Verified:** what you ran and what it showed; what stays unverified.
- **Patches left:** any stopgap shipped, and what it leaves running.
