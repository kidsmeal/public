# Design-review adversary activation (v2) - Design

Status: draft
Intent: give the design gate the same optional cross-model second opinion the phase gate already has, so a configured `design-reviewer` adversary actually runs an adversarial final pass on the reviewed design before planning, instead of being parsed-and-shown but dormant.

## Problem

v1.5 shipped the cross-model adversary but wired only the `phase-reviewer`'s into the orchestrator. The `design-reviewer` adversary is fully resolved and surfaced — `role-core.js` resolves an adversary for both reviewer roles identically, and `role.js` (`resolve` / `run --adversary` / `show`) already handles `design-reviewer` with no special-casing — but no stage ever invokes it, so configuring one is inert. `models.md` and the v1.5 design both say so explicitly: "reserved for v2."

That leaves the most leveraged review gate as the one that cannot get a second opinion. A wrong premise is cheapest to catch at the design gate and most expensive to miss there: a flawed design propagates through the plan and every phase built from it. The same model-shaped blind spots that motivated the phase adversary (the v1.5 problem statement, finding 4) apply at least as strongly one stage earlier.

## Design

Three prose edits, one small code edit, and a test artifact. All additive: a project with no `design-reviewer` adversary configured sees byte-for-byte today's design gate.

The defining constraint, and why this was deferred rather than copied from the phase adversary: **the design-review adversary's fix loop is structurally different from the phase one.** The phase adversary runs on a clean *diff*, and a FAIL routes the fixes back to the *implementer* via the sentinel `add-files` + `/gantry:build` path. The design gate has no diff, no implementer, and no sentinel. A design adversary that raises findings has found design holes the primary `design-reviewer` missed, and the only actor who can resolve a design hole is the human — exactly the actor Stage 1 already routes `[NEEDS USER DECISION]` markers to. So the loop folds into the one Stage 1 already has, rather than inventing new machinery.

### Unit 1: orchestrator wiring (`plugins/gantry/skills/gantry/SKILL.md`, Stage 1)

After the primary `design-reviewer` reaches a clean result (all `[NEEDS USER DECISION]` markers resolved and the reviewed doc reads "Ready for phase planning: yes"), and before the gate to Stage 2 opens, run `node ${CLAUDE_PLUGIN_ROOT}/scripts/role.js resolve design-reviewer` and inspect the `ADVERSARY:` line:

- `ADVERSARY: none` (no adversary, or one identical to the primary that resolve already skipped): skip this step entirely. The design gate is unchanged from today.
- Any other `ADVERSARY:` line: run it once on the reviewed doc — `node ${CLAUDE_PLUGIN_ROOT}/scripts/role.js run design-reviewer --adversary -- <reviewed-doc> [rubric]`. Outcomes:
  - **Adversary clean** (no new violations; reads ready): present both summaries and open the gate to Stage 2.
  - **Adversary raises findings** (new violations or `[NEEDS USER DECISION]`-class issues the primary missed): fold them into Stage 1's existing resolve-and-re-run loop. Walk the user through the adversary's findings one at a time exactly as Stage 1 already does for `[NEEDS USER DECISION]` markers, update the reviewed doc with the resolutions, then **re-run the primary `design-reviewer`** on the updated doc to confirm it still reads "Ready: yes" (mirroring Stage 1 step 3 — design edits can introduce new problems), then re-run the adversary on the updated doc. The gate to Stage 2 opens only when both the primary reads "Ready: yes" and the adversary is clean, or the human overrules a specific adversary finding with a logged reason. This loop is capped under the **same informed-escalation rule as Stage 3** (2 cycles, then present the finding trajectory and the three options: keep iterating, revise more deeply, or overrule with a logged reason). It never auto-passes a real design defect.
  - **Adversary backend absent or `role.js run` exits non-zero (fail-open):** warn the user, then open the gate to Stage 2 on the primary-clean design. The primary already cleared it; a missing optional second reviewer must never block the pipeline. This mirrors Stage 3 step 5's fail-open exactly — do not spawn a native fallback for the adversary.

There is no implementer, no sentinel, and no `/gantry:build` in this loop. The "fix" is human-resolved design edits to the reviewed doc, the mechanism Stage 1 already owns.

### Unit 2: hand-driven command surface (`plugins/gantry/commands/design.md`)

`/gantry:design` runs the `design-reviewer` standalone, outside the full orchestrator. It mirrors the same adversary pass so driving the design gate by hand gets the same second opinion. After the primary writes `<draft>_reviewed.md` and it reads "Ready for phase planning: yes", run `role.js resolve design-reviewer`; if an adversary is configured, run `role.js run design-reviewer --adversary -- <reviewed-doc> [rubric]`, relay both summaries, and apply the same resolve-and-re-run guidance and the same fail-open rule. Kept proportionate to a command doc (terser than the SKILL.md stage), but the outcomes and the fail-open behavior are identical.

### Unit 3: adversary prompt note, role-appropriate (`plugins/gantry/scripts/role.js`)

`role.js` appends a one-line note to the adversary's prompt (currently `role.js:219-221`): "the **diff** above has already passed the primary reviewer." That wording is correct for the `phase-reviewer` adversary but wrong for the `design-reviewer` adversary, whose input is a design doc, not a diff. Make the note role-appropriate: for a `design-reviewer` adversary it should read in terms of the design doc having already passed the primary design review; for `phase-reviewer` it keeps the diff wording. This is the one code edit in the feature. The rest of the routing and CLI (`role-core.js`, the `resolve`/`run --adversary`/`show` surfaces) already handle `design-reviewer` and are untouched.

### Unit 4: test artifact (`test/consistency.test.js`, `test/role.test.js`)

- `consistency.test.js`: assert SKILL.md Stage 1 and design.md carry the adversary step, pinning literal anchors (`design-reviewer`, `--adversary`, `ADVERSARY`, the fail-open phrasing, "both clean"/the both-clean gate condition), mirroring how the Phase 6 anchors already pin the `phase-reviewer` adversary in Stage 3. Assert `models.md` no longer claims the `design-reviewer` adversary "does not fire" / is "reserved for v2", so the dropped caveat cannot silently return.
- `role.test.js`: assert the adversary prompt note is role-appropriate — a `design-reviewer --adversary` run does not emit diff-specific wording, and a `phase-reviewer --adversary` run keeps it. Extend the existing `mkdtemp` + `GANTRY_PROJECT_DIR` spawn pattern.

## Contracts touched

- **Orchestrator control-flow contract (SKILL.md Stage 1, design.md).** Additive doc instructions. With no `design-reviewer` adversary configured the new step never fires, so the design gate is byte-for-byte today's. No data migration. Rollback: revert the prose; the routing code still resolves and shows a `design-reviewer` adversary, it simply goes uninvoked again (back to dormant).
- **`role.js` adversary prompt note (Unit 3).** Prose-in-code wording change to the note appended for an adversary run, branched by reviewer role. No change to argv, dispatch, exit codes, or the descriptor shape. Existing `role.test.js` cases for the `phase-reviewer` adversary keep passing (the diff wording is preserved for that role).
- **`.gantry/models.json` schema:** no change. The `adversary` field already exists and is already valid on `design-reviewer` (v1.5 resolves it). Only the prose in `models.md` describing its behavior changes — from "parsed and shown but dormant" to the active design-gate behavior.
- **No change** to the `phase-reviewer` adversary, `role-core.js`, the routing/dispatch code, `run.md`, or `review.md`.

## Edge cases

- **Adversary backend missing/unauthed:** fail-open to Stage 2 on the primary-clean design (Unit 1), same as Stage 3.
- **Adversary identical to the primary** (same backend and model): already skipped at resolve time with a warning by `role.js` (`adversarySameAsPrimary` → `ADVERSARY: none (identical to primary - skipped)`). The orchestrator sees a `none` line and skips. Inherited, not re-implemented.
- **Primary stops on `[NEEDS USER DECISION]` first:** the adversary runs only after the primary is clean, so the two loops compose — resolve the primary's decisions, then the adversary runs on the already-clean doc.
- **Adversary keeps surfacing new findings each pass:** capped at 2 cycles, then informed escalation with the three options (Unit 1), same rule as Stage 3. No infinite loop.
- **`/gantry:run` invoked on an already-approved `_reviewed` doc:** the Hard rule "if invoked with an already-approved design, start at Stage 2" already skips Stage 1 wholesale; the design adversary is skipped with it, correctly, because the user asserted the design is final.
- **Human overrules an adversary finding:** logged reason, gate opens (mirrors Stage 3).

## Out of scope

- Any change to the `phase-reviewer` adversary or Stage 3 step 5 (shipped, untouched).
- Any change to routing/dispatch code in `role-core.js` or the `resolve`/`run`/`show` mechanics in `role.js` (the plumbing is done; Unit 3 is only the prompt-note wording).
- Any new config schema, schema-version field, or `models.json` migration.
- Making the adversary mandatory or default-on. It stays opt-in per project; the shipped default is a single native reviewer.
- `run.md` / `review.md` (those govern the phase build/review gate, not the design gate).

## Open questions

The fix-loop routing — the one decision that deferred this to v2 — is resolved (human gate, this session): the adversary's findings fold into Stage 1's existing resolve-and-re-run loop; the primary re-runs to reconfirm after the user's edits, then the adversary re-runs; the gate opens only when both are clean or the human overrules with a logged reason; capped under the same informed-escalation rule as Stage 3. No open question blocks planning.
