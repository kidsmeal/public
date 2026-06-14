---
description: A lighter build-and-review lane for a small self-contained change, no design doc or plan
argument-hint: <what to change, in your own words>
---
Arguments: $ARGUMENTS

This is Gantry's lite lane for a small, self-contained change where the full design -> plan -> phased build is overkill, but you still want the diff reviewed before it commits. It keeps the floor (a tests-first build, a diff review before commit, and you holding the commit) and drops the ceremony (no design grill, no design-review gate, no multi-phase plan, no audit docs, no phase-enforcement hooks). It is prompt-level, not hook-enforced. For anything with real stakes, shared state, a schema, a public contract, or more than a couple of files, stop and recommend `/gantry:run` instead.

If `$ARGUMENTS` is empty, ask me what to change. If the change looks larger or riskier than the lite lane is meant for, say so and recommend `/gantry:run` rather than proceeding here.

Both agents below run on their configured backend: for each, run `node ${CLAUDE_PLUGIN_ROOT}/scripts/role.js resolve <role>` and either spawn the named subagent (`DISPATCH: native`) or run `node ${CLAUDE_PLUGIN_ROOT}/scripts/role.js run <role> -- $ARGUMENTS` and use its stdout (`DISPATCH: external`), falling back to native on any failure. Quick mode is prompt-level with no sentinel, so a headless implementer's injected guards stay inert here, matching this lane's "no hooks" contract.

1. **Build.** Dispatch the **implementer** in quick mode: pass it the change description above as the spec (there is no plan file). It reads the relevant code first, works tests-first where a test framework exists, implements only the described change, stays scoped to it, and reports files touched, test status, and any scope drift. It does not commit.
2. **Review.** Dispatch the **phase-reviewer** (read-only) over the uncommitted diff, in quick mode: the spec to check against is the change description, plus the project's conventions and test discipline. Relay its verdict verbatim.
3. **One fix cycle.** On FAIL or fix-now notes, send the findings back to the implementer once, then re-review. If it still fails, stop and hand it to me with the outstanding findings - do not grind.
4. **Commit gate.** On PASS (or PASS-WITH-NOTES with only deferred notes), present the clean diff and the verdict, then stop for me to commit. Gantry never commits for you.
