---
description: Drive the active roadmap entry's next gated step (design -> plan -> build -> review) and move the cursor when a phase ships
argument-hint: [phase number, if you want a specific one]
---
!`node "${CLAUDE_PLUGIN_ROOT}/scripts/advance.js" $@`

Step 0: read the advance.js output above. It names exactly one next step, one gate, and one prescribed row transition. If it reports a conflict, stop at `=== GATE: HUMAN DECISION REQUIRED ===` and show the conflict verbatim.

If the structured output is absent (no schema rows), fall back to determining position from `NOW.md` and roadmap prose, then follow the pipeline steps below.

Drive that step, stopping at every human gate:

1. **No design yet** (a named intent): run `/compass:promote` for it first - design, plan, register - then stop for me.
2. **Designed and planned, nothing built:** run `/gantry:build` on the first phase (or phase `$1` if I named one). Tests-first where a framework exists, inside the plan's file list, no spilling into the next phase, no commit.
3. **A phase just built:** run `/gantry:review`, read-only, over the uncommitted diff against the plan and conventions (`CONVENTIONS.md`, falling back to the surrounding code). On FAIL, route the findings back through `/gantry:build` and re-review before any commit. On PASS, stop for me to commit.
4. **A phase just committed:** update `NOW.md` - check off the step, write the next physical action - and tell me the next phase, or that the entry is done.

After every step, apply the prescribed row transition via `node "${CLAUDE_PLUGIN_ROOT}/scripts/advance.js" --apply` (or `--apply --set key=value` for exceptional cases like a FAIL review). Never hand-edit the state fields. The mapping, for reference:

- after build → `status: in_progress`, `active_phase: N`, `phase_state: in_review`
- after a PASS review → `phase_state: ready_to_commit`
- after I commit → `phase_state: committed`, then advance to `active_phase: N+1`, `phase_state: building` — or `status: done` if that was the last phase
- on a FAIL review → `phase_state: review_failed`
- if blocked → `status: blocked` plus a one-line `blocked_by`

`NOW.md` and the plan reference this row by `id`; never copy the state into them (one source of truth, or it drifts).

You never commit, push, or advance past one phase on your own. When an entry's last phase is committed, recommend `/claudhd:shipped` to log it and offer to flip its roadmap row to done. If `NOW.md` has no active thread, show me the roadmap and ask which entry to make active.

End your response with exactly one gate label as the final line, matching the outcome — so what I have to do next is unmistakable:

- `=== GATE: COMMIT REQUIRED ===` — a phase passed review; it's yours to commit.
- `=== GATE: REVIEW FAILED ===` — the review found issues; fixes go back through build.
- `=== GATE: HUMAN DECISION REQUIRED ===` — an unresolved design question is blocking.
- `=== GATE: BLOCKED ===` — waiting on something external.
- `=== GATE: SAFE TO ADVANCE ===` — built and ready to review, or moved cleanly to the next step.
