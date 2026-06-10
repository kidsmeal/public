---
name: gantry
description: Use to run a feature through the full Gantry pipeline in the correct order with both review gates - phrases like "run this through gantry", "gantry pipeline", "plan and build this with reviews", "drive the gated build end to end", or the /gantry:run command. Orchestrates design-plan-creator (if needed) -> design-reviewer -> phase-planner -> per phase (implementer -> phase-reviewer, re-reviewing after any fix), pausing only at the human gates (unresolved decisions, plan blockers, every commit). Not for quick one-off edits.
version: 0.3.0
---

# Gantry pipeline orchestrator

This skill drives a feature through Gantry's subagents **in order**, so you do not call each one by hand. It chains the agent invocations automatically and stops only at the real human gates: an unresolved design decision, a plan blocker, an uncontained scope drift, a phase still failing review, and every commit. Everywhere else it advances on its own.

Two reviews are built in and neither is skippable:
- **Review gate 1 - the design review.** The design-reviewer audits the design before anything is planned.
- **Review gate 2 - the phase review, plus a re-review after any fix.** The phase-reviewer audits each phase's diff before commit, and any code the implementer writes to fix a failed review is itself re-reviewed before the commit gate. A fix is unreviewed code until the reviewer sees it again.

## Before you start
1. **Get the design.** Take the design doc path from the user or the command args. If they only have an idea and no design doc, run the **design-plan-creator** skill first to author one, then continue. The orchestrator needs at least a draft design to work from.
2. **Confirm the project is initialized.** `CURRENTNESS_AUDIT.md` and `RUNTIME_VERIFICATION_QUEUE.md` should exist and the project's conventions + test command should be known. If not, run `/gantry:init` first.
3. Keep inter-stage chatter terse: relay each agent's summary, say which gate you are at, and move.

## Stage 1 - Design review (review gate 1)
1. Spawn the **design-reviewer** on the draft (and the project's rubric if one exists). Relay its summary.
2. If it reports `[NEEDS USER DECISION]` markers: **stop.** Resolve each with the user, one at a time, and update the reviewed doc with the resolutions.
3. If resolving those decisions materially changed the design, spawn the **design-reviewer once more** on the updated doc to confirm it now reads "Ready for phase planning: yes". This second pass catches problems the resolutions introduced.
4. Skip this stage only if the input is already an approved `_reviewed` doc and the user confirms it is final.
5. **Gate:** do not proceed to planning until the reviewed design is clean.

## Stage 2 - Plan
1. Spawn the **phase-planner** on the finalized/reviewed design. Relay its summary: phase count, blockers, plan path.
2. If it reports blockers: **stop** and resolve them with the user (a blocker is a human decision, never a guess). Update the inputs and re-plan if needed.
3. Present the phase list and get the user's go-ahead to start phase 1. The user should see the plan before any code is written.

## Stage 3 - Phased build with review (review gate 2, repeated per phase)
For each phase, in dependency order:
1. Spawn the **implementer** with the plan path and the phase number. Relay its report.
2. If the implementer reports a blocker or a scope drift it could not contain: **stop**, resolve with the user, then re-run the phase or adjust the plan. Never let scope expand silently.
3. Spawn the **phase-reviewer** with the plan path and phase number, over the uncommitted diff. Relay the verdict in full, including the Docs impact section — it lists standing docs (`docs/INDEX.md`, `docs/GLOSSARY.md`, `docs/CONVENTIONS.md`) the diff made stale, and those must be refreshed this phase before moving on. If the Docs impact section is non-empty, append each flagged doc to `CURRENTNESS_AUDIT.md`'s `## Open doc flags` section: `- [ ] <doc path>: <one line, what the diff invalidated> (phase N, <feature or plan name>)`. If no `CURRENTNESS_AUDIT.md` exists in the project, skip the append and note that running `/gantry:init` would enable persistent tracking.
4. **Re-review loop (the second review):**
   - On **FAIL**: send the reviewer's Required fixes back to the **implementer** as a scoped fix pass on the same phase. Then spawn the **phase-reviewer again** over the new diff. Repeat until PASS or PASS-WITH-NOTES, capped at **2 fix-and-re-review cycles**. If it still fails after that, **stop** and hand it to the user with the outstanding findings - do not keep grinding.
   - Rule: any time the implementer touches code after a review, that new diff **must** be re-reviewed before the commit gate.
5. **Commit gate:** on PASS / PASS-WITH-NOTES, present the clean diff and verdict to the user and **stop for them to commit.** Gantry never commits.
6. After the user confirms the commit, if the project has a `ROADMAP.md` containing a row for this feature (match by the design or plan path in the row, or by `<!-- id: ... -->`), update the row's `status`, `active_phase`, and `phase_state` to match the step just completed — using the same mapping as compass advance: after build set `in_progress / N / in_review`; after a PASS review set `phase_state: ready_to_commit`; after the human commits set `phase_state: committed` then advance `active_phase` to N+1 / `phase_state: building`, or `status: done` if that was the last phase; on FAIL set `phase_state: review_failed`. If there is no roadmap or no matching row, skip silently. Gantry does not depend on compass; this is a plain file write.
7. Advance to the next phase. Never start phase N+1 before phase N is reviewed and committed.

## The only places you stop and ask
- An unresolved `[NEEDS USER DECISION]` from the design review.
- A plan blocker.
- A scope drift or blocker the implementer could not contain.
- A phase still failing review after the fix-cycle cap.
- Every commit.

Everywhere else, advance automatically through the agent order. Do not make the user invoke each agent by hand - that is the whole reason this skill exists.

## Hard rules
- Run the stages strictly in order. Never plan an unreviewed design, never build an unplanned phase, never present an unreviewed diff for commit.
- Both reviews are mandatory: the design review before planning, and a phase review (plus a re-review after any fix) before every commit. Skipping a review to save a step defeats the purpose.
- One phase at a time. Never start phase N+1 before phase N is committed.
- Never commit, push, or run destructive git on the user's behalf.
- If invoked with an already-approved design, start at Stage 2 - but never skip Stage 3's per-phase reviews.

## Doc-lifecycle taxonomy (what feeds what)
Roadmap says what to do next, **design** says why and under what constraints (made by design-plan-creator, audited by design-reviewer), **plan** says how in phases (made by phase-planner), the implementer builds it, the phase-reviewer guards the commit, and the currentness audit + runtime verification queue keep the record honest afterward.
