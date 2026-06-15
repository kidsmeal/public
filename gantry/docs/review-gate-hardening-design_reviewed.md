# Review-gate hardening (v1 + v1.5) - Design

Status: reviewed (design-reviewed 2026-06-14; the 1 flagged decision, the round-cap value/unit, resolved by human gate below)
Intent: close the two defect classes a real A/B/C test showed Gantry's phase-review gate waving through (a new capability built but never wired to a live caller, and code that passes fixture tests but breaks on real inputs), stop the gate from looping unboundedly on over-scoped findings, and add an optional second, different-model reviewer that runs a final adversarial pass before commit. Units 1-3 plus the test artifact are prompt/doc edits (v1, the cheap gap-closers). Unit 4 is the cross-model adversary and is the one part with routing code, a config-schema change, and recurring external-model cost (v1.5).

## Problem

A controlled three-arm test (a no-gate control, a Gantry run with opus reviewers, a Gantry run with codex reviewers; same design doc and builder) exposed four gaps. Evidence, not a hunch:

1. **Built but not wired slipped through.** Two of three arms shipped a generic action engine whose dispatcher had zero non-test callers: the headline feature was dead code, unreachable from the running app, and the opus phase-reviewer passed it. A root cause sat upstream: the plan never assigned which phase wires the engine, so no step owned it.
2. **Fixture-green, real-input-broken slipped through a unit-test gate.** One arm had 35 passing harness assertions and a boot-breaking bug: the data indexer iterated a value the real content file ships as an object, so the loader threw and the app would not boot. The tests used hand-built fixtures and never hit the real shape.
3. **An over-strict reviewer can loop.** One reviewer FAILed a structurally-necessary file the plan's file list omitted, and demanded capability beyond the phase's scope, driving a phase to three review rounds before a human broke the loop. The verdict rules never tell a reviewer to scope a FAIL to the phase, and the orchestrator has no cap that pulls the human into a stuck automatic loop.
4. **A single model has model-shaped blind spots.** Defects (1) and (2) were caught by a *different* model than the one that built and (in arm two) reviewed the code. opus caught a silent data-loss bug codex's arm did not face; codex caught the boot crash and the wiring gap opus passed. Neither model alone caught the union. Gantry routes a role to one backend (0.7.0); it cannot run two reviewers and surface both.

Units 1-3 make the single primary reviewer catch the known gaps (1-3). Unit 4 adds the cross-model second reviewer for the unknown ones (4).

## Design

Four units plus a test artifact. All additive: a project on the current default config, with no adversary configured, sees a stricter, better-scoped reviewer and a planner that names its wiring, and nothing else changes.

### Unit 1: reachability, backed by planner-declared wiring (v1)

**Planner (`plugins/gantry/agents/phase-planner.md`).** Every phase that introduces a new public capability (an exported function, system, command, bus event, or user-facing control) carries a one-line wiring declaration in its phase entry:
- `Wires: <the live caller this phase adds>` when the phase makes it reachable, or
- `Wired-by: phase N` when a later phase in this plan wires it, or
- `Wired-by: deferred (<feature/reason>)` / `Wired-by: none (public surface for <reason>)` when it is intentionally not consumed within this feature.

This forces the plan to own the wiring (the root cause of finding 1). One line per relevant phase, not a new section. (Placement note for the planner edit: the per-phase field list in phase-planner.md is the `Status / Goal / Files / Verification / Exit criteria / Blockers` block; the wiring line is a new optional field in that block, only on phases that add a public capability.)

**Reviewer (`plugins/gantry/agents/phase-reviewer.md`), under Code discipline.** For each new exported function, system, command, bus event, or user-facing capability in the diff, grep for a live (non-test) caller. The verdict rule targets **silent** dead code only:
- An uncalled new capability whose phase carries no wiring declaration, and that no phase wires -> FAIL.
- An uncalled new capability the plan explicitly accounts for (`Wired-by: phase N`/`deferred`/`none (...)`) -> not a defect; the declaration is honored. If `Wired-by: phase N` names a phase that already passed without adding the caller -> FAIL (the promised wiring never landed).

Reachability is distinct from scope drift: in-scope code can still be unreachable. (Since this adds a new FAIL trigger, it joins the reviewer's existing verdict rules at phase-reviewer.md's `## Process` "Code discipline" check and the `Verdict rules` list, where the current FAIL classes are Plan adherence / Conventions / Test discipline / Cross-cutting / Exit criteria.)

### Unit 2: real-input verification (v1)

**Implementer (`plugins/gantry/agents/implementer.md`), in the tests-first / verification step (Process steps 5 and 7).** When a phase adds code that consumes project data, config, or content, the verification must load the **real** shipped file(s) and run the consuming code path against them at least once (a node import/smoke feeding the real artifact through the function, a parse-then-consume of the real file), not a fixture stand-in. A green fixture-only run is not sufficient evidence for real-input code. Only when a real run genuinely requires a browser or device does it fall back to a stated manual real-input check with an explicit pass condition.

**Reviewer (`plugins/gantry/agents/phase-reviewer.md`), under Test discipline.** If the phase's code consumes project data/config/content, confirm the verification exercised the real artifacts, not only fixtures. Where a real-input run is cheap from the shell, the reviewer runs it itself; if it throws, that is a FAIL with the cited error. Fixture-only verification for shell-runnable real-input code is, at minimum, a partial.

Note on the reviewer's command budget: phase-reviewer.md's Hard rules currently cap the reviewer at running only the plan's named verification command "once, as evidence ... No ad-hoc scripts." The real-input smoke run this unit asks the reviewer to perform is a new allowed command and must be added as an explicit exception to that Hard rule, or the reviewer's own contract forbids the check this unit requires.

### Unit 3: scope-calibrated FAILs and an informed round cap (v1)

**Calibration (`plugins/gantry/agents/phase-reviewer.md`, verdict rules).** A FAIL must name a defect in what THIS phase shipped against its plan. The reviewer does not FAIL for work beyond the phase's scope:
- A capability the design locks but no authored content yet uses, or a handler family the plan defers -> a deferred note naming the later phase/feature that closes it.
- A structurally-necessary file the plan's Files list omitted but the change genuinely requires -> a fix-now note recommending the one-line plan amendment, not a FAIL.
The reachability, real-input, scope-drift, test-discipline, and convention checks are unaffected: those stay FAILs because they are defects in the shipped diff.

**Round cap (`plugins/gantry/skills/gantry/SKILL.md`, `plugins/gantry/commands/review.md`).** Resolved (human gate): the existing cap value and unit are kept UNCHANGED. The orchestrator already stops after **2 fix cycles** (a cycle = one fix + one re-review; `/gantry:quick` uses one). This unit does not re-tune that number, and it adopts the existing "cycle" unit rather than introducing a "round." The grill's "N=3" is dropped: silently re-tuning a shipped value of a published tool is not in scope here, and a phase that legitimately needs more is handled by the human choosing "keep iterating" at the escalation, so 2 cycles is a pull-the-human-in point, not a hard ceiling. The ONLY change this unit makes to the cap is making that existing stop informed (below).

The cap change is informed escalation regardless of the number: when the loop hits the cap without a clean verdict, the orchestrator stops and escalates to the human with the finding trajectory (shrinking = a deep phase worth continuing, recurring = stuck) and the three options (keep iterating, amend the plan, overrule with a logged reason). It never auto-passes; a real defect cannot slip through the cap. (This sharpens the existing "stop and hand it to the user with the outstanding findings" behavior in SKILL.md step 4 and review.md - the escalation message gains the trajectory read and the explicit three options.) When configured, the adversary's loop (Unit 4) is capped separately under the same rule.

### Unit 4: the cross-model adversary reviewer (v1.5)

A reviewer role may name a second backend that runs once, after the primary reviewer reaches a clean verdict, as an adversarial final pass on the same clean diff. The human sees both verdicts at the commit gate.

**Config (`.gantry/models.json`).** The role assignment gains an optional `adversary` object shaped like a role assignment:

```json
"phase-reviewer": {
  "backend": "native", "model": "opus",
  "adversary": { "backend": "codex", "model": "gpt-5.5" }
}
```

Absent `adversary` (every existing config) = single-reviewer behavior, unchanged. `adversary` is honored only on the two reviewer roles; on `implementer`/`phase-planner` it is ignored with a warning (never an off-harness implementer by a side door). For v1.5 the orchestrator acts on the `phase-reviewer` adversary only; a `design-reviewer` adversary is parsed and shown by `/gantry:models` but does not yet fire (reserved for v2), so configuring it is not an error.

**Routing (`plugins/gantry/scripts/role-core.js`).** `resolveRole` gains an optional resolved `adversary` descriptor on its return object: when the assignment carries an `adversary` on a reviewer role, resolve it through the same path as the primary (known backend type, a model required for any non-native type, fail-safe to "no adversary" on any malformed entry rather than throwing). The adversary is a reviewer, so the `HARNESS_SAFE_TYPES` implementer lock never applies. All existing return fields are unchanged; `DEFAULT_CONFIG` is untouched; every existing `role-core.test.js` case keeps passing.

**Dispatch (`plugins/gantry/scripts/role.js`).** `resolve <role>` prints an `ADVERSARY:` line after the primary dispatch block (the adversary's backend, type, model, native-vs-external) or `ADVERSARY: none`. `run <role> --adversary [-- <inputs>]` runs the adversary backend on the same agent `.md` body (so it applies the identical Unit 1-3 checklist) plus a one-line note that it is the adversarial final pass on an already-primary-passed diff. A native adversary still dispatches via the Task tool (role.js refuses to `run` a native role); only an external adversary runs through `role.js run`.

The `show` subcommand (the one `/gantry:models` actually invokes - models.md runs `role.js show`, not `resolve`) gains an adversary line per reviewer role so a configured adversary, including a dormant `design-reviewer` one, is visible there. Without this, the "parsed and shown by `/gantry:models`" claim above has no surface that prints it. `role-core.js`'s `resolveRole` already iterates per role in `cmdShow`, so the adversary descriptor it now returns is what `show` prints.

**Orchestration (`plugins/gantry/skills/gantry/SKILL.md`, `plugins/gantry/commands/run.md`, `plugins/gantry/commands/review.md`).** The per-phase loop is unchanged through the primary's clean verdict. Then, if a `phase-reviewer` adversary is configured, run it once on that clean diff. Outcomes:
- Adversary clean: present both verdicts; the commit gate opens (both clean).
- Adversary FAIL / fix-now notes: relay to the implementer in fix mode (the existing FAIL path, sentinel `add-files` for cited paths), then re-run the adversary on the fix, under its own round cap. The primary is not re-run on an adversary-only fix (it already passed the pre-fix diff; the fix is scoped to the adversary's cited paths; the cap and the human gate backstop the small risk a fix file reintroduces a primary-class issue). Note: the existing FAIL fix path also passes through `plugins/gantry/commands/build.md` (it re-spawns the implementer via `/gantry:build`), so the adversary fix relay reuses build.md's implementer-spawn step. build.md needs no new logic, but it is part of the loop this unit drives and is named here for completeness.
- The commit gate opens only when both the primary and the adversary are clean, or the human overrules a specific finding with a logged reason. A primary-PASS / adversary-FAIL disagreement is the signal to look closely, which is the point.

With no adversary configured, none of Unit 4 fires; the pipeline is byte-for-byte today's behavior.

### Unit 5: verification artifacts (v1 + v1.5)

The v1 units are prompt/doc-only, so their phases need a real check beyond "the text reads right": add assertions to `test/consistency.test.js` (the repo's `node --test` suite, at the repo root - the same pattern as the existing version-sync and README-command-table checks) confirming the Reachability and real-input checks appear in `phase-reviewer.md`, the wiring declaration in `phase-planner.md`, the real-input rule in `implementer.md`, and the round cap in the orchestrator skill. These read the agent/skill `.md` files under `plugins/gantry/` and assert the new section text is present, mirroring how the existing tests assert version/command consistency. Unit 4's routing change gets real unit tests in `test/role-core.test.js` (adversary on a reviewer resolves; on implementer/planner is ignored; malformed fails safe; default config yields no adversary) and `test/role.test.js` (`resolve` shows the adversary line; `run --adversary` builds the second invocation; `show` lists a configured adversary).

## Contracts touched

- **`plugins/gantry/agents/phase-reviewer.md`**: reachability (U1), real-input (U2), scope calibration (U3), plus the Hard-rule exception that lets the reviewer run the real-input smoke (U2). Prompt-only.
- **`plugins/gantry/agents/phase-planner.md`**: per-phase wiring declaration (U1). Prompt-only.
- **`plugins/gantry/agents/implementer.md`**: real-input verification (U2). Prompt-only.
- **`plugins/gantry/skills/gantry/SKILL.md`, `plugins/gantry/commands/run.md`, `plugins/gantry/commands/review.md`, `plugins/gantry/commands/build.md`**: the round cap (U3), the adversary final-pass step, and the adversary fix relay through build.md's implementer spawn (U4). Orchestrator doc edits. The round-cap edit keeps the existing 2-cycle cap unchanged and only makes the stop informed (see U3).
- **`.gantry/models.json` schema (additive)**: optional `adversary` on a reviewer role; documented in **`plugins/gantry/commands/models.md`** with the opus-primary + codex-adversary example.
- **`plugins/gantry/scripts/role-core.js`**: additive `adversary` field on `resolveRole`'s return; all existing fields unchanged. Pure module, no IO. New `test/role-core.test.js` cases.
- **`plugins/gantry/scripts/role.js`**: `resolve` `ADVERSARY:` line, `run --adversary` flag, `show` adversary line, reusing the existing `loadConfig`/`readAgent`/`composePrompt`/`spawnSync`-shim path. New `test/role.test.js` cases.
- **`test/consistency.test.js`**: section-presence assertions for the prompt changes (U5), at the repo-root `test/` directory.
- No schema migration, no network, no new runtime dependency. The implementer's harness lock and the file-list/commit hooks are untouched. Every existing test keeps passing.

## Edge cases

- **Reachability false positive (legitimate staging)**: handled by U1's two halves; only an undeclared, unwired capability is flagged.
- **`Wired-by: phase N` where phase N already shipped without the caller**: FAIL (the promised wiring never landed) - the case the test actually hit.
- **Real-input check, greenfield (no real artifact yet)**: the fixture is the real input; the check is satisfied.
- **Real-input run needs a browser/device**: falls back to a stated manual real-input check with a pass condition.
- **Round cap on a deep vs stuck phase**: the informed escalation shows the trajectory; the human chooses; the cap never auto-passes.
- **Adversary backend not installed on this machine** (codex absent): fail open - warn and let the primary-passed diff proceed to the gate. A missing optional second reviewer must never block a commit. (Mechanism: `role.js run` exits non-zero on ENOENT - role.js itself fails CLOSED there, calling `fail()`. The fail-OPEN-to-the-gate behavior lives in the orchestrator: run.md/review.md already "report it and fall back" on a non-zero `role.js run` exit. The adversary path inherits that same orchestrator fallback, and because the primary already passed, falling back means "proceed to the gate," not "spawn a native adversary." Correct the earlier "Mirrors role.js's ENOENT handling" framing accordingly: it mirrors the orchestrator's fallback-on-nonzero, not role.js's exit code.)
- **Adversary identical to primary** (same backend+model): warn at resolve time and skip the adversary; the primary already covered it.
- **Adversary on a non-reviewer role**: ignored with a warning; `role-core` never reads `adversary` for `implementer`/`phase-planner`.
- **Adversary fix re-introduces a primary-class issue**: low risk (fix scoped to cited paths), backstopped by the adversary cap and the human reading both verdicts. v1.5 does not re-run the primary on an adversary-only fix; a "re-run primary when the adversary fix touches files outside the primary-reviewed set" tightening is noted for later if it proves real.

## Out of scope (v2, not this build)

- The **design-review** adversary firing (the config is parsed and shown, but the orchestrator does not run a design-review adversary).
- Automated merge/dedup of the two reviewers' findings (the human arbitrates both verdicts at the gate).
- Per-phase model/effort tiering (xhigh on risky phases, lower on docs).
- Planner wiring beyond the one-line declaration (full dependency-graph validation), and the design-reviewer cross-doc-contradiction rule.
- Any change to the implementer's backend rules or the commit/file-list hooks.

## Open questions

All resolved in a grill (2026-06-14) and baked into the units above; recorded so the reviewer does not re-open them. (The one item flagged in design review, the round-cap value/unit colliding with the existing 2-cycle cap, is resolved in Unit 3: keep the shipped 2-cycle cap, add only informed escalation.)
- Pull the planner-wiring line into v1: **decided in** (makes U1 deterministic, attacks the root cause).
- Reachability strictness: **silent-dead-code only** (no caller AND no plan declaration).
- Real-input hardness: **required wherever shell-runnable**, run by implementer and reviewer.
- Round cap: keep the existing **2 fix cycles** unchanged; v1 adds only informed escalation (trajectory + the three options). (Supersedes the grill's "N=3", per the design review: do not silently re-tune a shipped value.)
- Build v1 and v1.5 together (vs ship v1 first to measure): **decided together** (a build-for-the-thing choice; we forgo the "did the primary alone suffice" measurement knowingly).
- Adversary scope: **every configured phase**, one pass on the clean diff; **re-run adversary only** on its fix; gate opens only when **both** are clean (or a logged human overrule); a **native** adversary is allowed but warned if identical to the primary; the **design-review** adversary is parsed but dormant (v2).

No open question blocks planning.
