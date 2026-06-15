---
description: Review the uncommitted diff for one phase against the plan and the project's conventions
argument-hint: <path-to-plan> <phase-number>
---
Arguments: $ARGUMENTS

Resolve a plan file and a phase number from those arguments before doing anything else, tolerating filler:
- **Plan file**: the plan path (a path, normally ending in `_plan.md` or `-plan.md`).
- **Phase**: the phase number (the integer). Ignore a literal `phase` token if present, so `<plan> phase 3`, `<plan> 3`, and `phase 3` all resolve the same.
- If a phase number is given with no plan path, locate the plan the project is currently building and confirm it with me.
- If you cannot determine BOTH a plan file and a phase number, ask me - do not guess.

Use the resolved plan path and phase number (`<plan>` and `<phase>` below), NOT the raw argument tokens, in every command and subagent call.

**Dispatch the phase-reviewer to its configured model backend.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/role.js resolve phase-reviewer`:
- If it prints `DISPATCH: native`: spawn the **phase-reviewer** subagent (read-only) via the Task tool to review the current uncommitted diff against the plan, passing it the resolved `<plan>` and `<phase>` (use the model the resolve output names).
- If it prints `DISPATCH: external`: run `node ${CLAUDE_PLUGIN_ROOT}/scripts/role.js run phase-reviewer -- <plan> <phase>` and treat its stdout as the reviewer's verdict. The external reviewer gathers the diff itself; do not also spawn the subagent. If the run fails (CLI missing, not authed, non-zero exit), report that and fall back to the native subagent so the gate is never skipped.

The reviewer is read-only and produces a verdict either way; everything below treats that verdict identically.

Relay the agent's verdict verbatim - PASS / FAIL / PASS-WITH-NOTES - and its specific findings, including the Docs impact section listing any standing docs (`docs/INDEX.md`, `docs/GLOSSARY.md`, `docs/CONVENTIONS.md`) the diff made stale, each tagged mechanical or judgment. Handle them by tag: a **mechanical** flag (doc still references a moved/renamed/deleted path) you fix immediately yourself - plain text edit, no design decision - and report as refreshed. A **judgment** flag goes to the ledger: append it to `CURRENTNESS_AUDIT.md`'s `## Open doc flags` section as `- [ ] <doc path>: <one line, what the diff invalidated> (phase N, <feature or plan name>)`, for `/gantry:audit` to reconcile; if no audit file exists, skip and note that `/gantry:init` would enable it.
- On **FAIL**: do not commit. Before re-spawning the implementer for the fix pass, run: `node ${CLAUDE_PLUGIN_ROOT}/scripts/sentinel.js add-files <space-separated list of the reviewer's cited file paths>` (this widens the active sentinel so the fix pass can touch exactly those files). Then send the Required fixes back to the implementer via `/gantry:build <plan> <phase>`, and re-review. Repeat up to 2 cycles; if still failing, read the finding trajectory - shrinking findings across cycles means the phase may be worth continuing; recurring findings signal a stuck loop - then stop and present the outstanding findings to me with the three options: (1) keep iterating (extend the cap for this phase, I take responsibility for the added cycles); (2) amend the plan (the findings reveal the plan is incomplete; I revise it and we re-run the phase); (3) overrule the reviewer (I judge the finding a false positive and log an explicit reason before the commit gate opens). Never auto-pass because the cap was reached.
- On **PASS-WITH-NOTES**: if there are **Fix-now notes**, before re-spawning the implementer run `node ${CLAUDE_PLUGIN_ROOT}/scripts/sentinel.js add-files <reviewer's cited file paths>` the same way, then send them to the implementer as a scoped fix pass on the same phase, and re-review before presenting for commit. Fix-now passes share the same 2-cycle cap as FAIL fixes; past the cap, stop and hand me the outstanding notes. Only **Deferred notes** (pending APIs, plan-blessed placeholders, later-phase consumers) may survive into the commit unchanged. Do not present a diff with outstanding fix-now notes for commit.
- **Before the commit gate, log every Deferred note so none is dropped.** Append each to `CURRENTNESS_AUDIT.md`'s `## Deferred review notes` section: `- [ ] <note, with file:line>: <why deferred> (phase N, <feature or plan name>)`. If no audit file exists, append them to the plan's own phase section instead and tell me that `/gantry:init` would enable persistent tracking. A deferred note must land in writing somewhere durable — never only in chat.
- On **PASS** (or PASS-WITH-NOTES with only deferred notes remaining, now logged): run `node ${CLAUDE_PLUGIN_ROOT}/scripts/sentinel.js clear` to close the commit gate, then tell me it is safe to commit and let me gate the commit. Never commit on my behalf unless I explicitly say so.
- Keep the phase's `**Status:**` line in the plan current: `review failed` on FAIL, `ready to commit` when presenting for commit, `committed` once I confirm the commit. The reviewer is read-only and the implementer never edits the plan; this write is yours.
