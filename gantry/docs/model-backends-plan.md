# Per-role model backends - Implementation Plan
Source design: (none - built directly from a design discussion; this plan documents the work for review)
Conventions read: gantry's existing scripts (`sentinel-core.js`/`sentinel.js` core+CLI split, fail-safe defaults, `node --test` suite) and command/skill prose style
Verification command(s): `node --test`

## Summary
Let each Gantry role run on a configurable model backend defined in `.gantry/models.json`, so reviewers and the planner can be delegated to an external model (e.g. codex / GPT-5.5) while the implementer stays on the Claude Code harness. Built as one phase: a pure routing core plus a CLI, wired into every agent-spawn site, with setup via `/gantry:init` and a new `/gantry:models` command.

## Blockers / Open Questions
None. The load-bearing assumption (PreToolUse hooks fire inside a nested headless `claude -p`, and a headless implementer can be guarded via injected `--settings`) was validated live before implementation.

## Phase 1: Model-backend routing, end to end
**Status:** built
**Goal:** Route each role to a configured backend (native / claude-headless / cli / openai-compat), enforce that the implementer can only run on a harness backend, and wire the dispatch into every command and the orchestrator skill, defaulting to all-native so existing behavior is unchanged.
**Files:** `plugins/gantry/scripts/role-core.js`, `plugins/gantry/scripts/role.js`, `test/role-core.test.js`, `test/role.test.js`, `plugins/gantry/scripts/init.js`, `test/init.test.js`, `plugins/gantry/commands/models.md`, `plugins/gantry/commands/review.md`, `plugins/gantry/commands/design.md`, `plugins/gantry/commands/plan.md`, `plugins/gantry/commands/build.md`, `plugins/gantry/commands/quick.md`, `plugins/gantry/commands/init.md`, `plugins/gantry/skills/gantry/SKILL.md`, `README.md`, `docs/model-backends-plan.md`, `.gitignore`, `examples/model-backends/README.md`, `examples/model-backends/2026-06-14-codex-cross-model-phase-review.md`
**Verification:** `node --test` passes, including the new `test/role-core.test.js` covering config resolution, the implementer harness guard (rejects cli/openai-compat, allows native/claude-headless), invocation construction for each backend type, and the guard-settings builder.
**Exit criteria:**
- An absent or unparseable `.gantry/models.json`, or an invalid role/backend assignment (typo, unknown backend, missing model), resolves to native; `resolve` warns and falls back rather than breaking the pipeline. The implementer harness guard is the one deliberate hard stop: a well-formed but off-harness implementer assignment is refused (non-zero exit), never silently downgraded. `.gantry/models.json` is gitignored (per-machine config), so a fresh clone has no config and runs all-native.
- `role.js resolve <role>` prints `DISPATCH: native` or `DISPATCH: external`; an implementer assigned to a non-harness backend exits non-zero with a clear refusal.
- `role.js run <role>` composes the prompt from the agent `.md` body, runs the backend, and relays its stdout; a headless implementer gets the two phase-enforcement guards injected via `--settings`.
- Every agent-spawn site (review, design, plan, build, quick, and the orchestrator skill) dispatches through `role.js`; `/gantry:init` scaffolds the config and detects available CLIs; `/gantry:models` views/edits assignments; the README command table lists `/gantry:models`.
**Blockers:** none.

## Cross-cutting concerns
- **Enforcement-hook contract (public contract).** The implementer must run inside the Claude Code harness or the PreToolUse guards (`file-list-guard.js`, `commit-guard.js`) cannot see its edits. `resolveRole` fails closed for any implementer backend that is not `native` or `claude-headless`, and `role.js` injects the guards into a headless implementer via a relative-path `--settings` file. Affects `role-core.js` (the guard), `role.js` (the injection), and `build.md`/`SKILL.md` (which rely on it). No change to the guard scripts or sentinel themselves - this work only routes work to them.
- **Default behavior unchanged.** All roles default to native, so projects that never touch `.gantry/models.json` get the exact pre-existing pipeline. This is the migration/rollback story: delete `.gantry/models.json` to revert to stock.
