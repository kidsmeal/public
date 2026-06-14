---
description: Scaffold Gantry's living docs into this project and detect its conventions + test/build commands
allowed-tools: Bash(node:*), Read
---
!`node "${CLAUDE_PLUGIN_ROOT}/scripts/init.js"`

Gantry's audit docs are scaffolded and the project signals are printed above. Now finish wiring the pipeline to THIS project - keep it short:

1. From the printed "Convention/style files found" and "Detected stack(s)", confirm with me the single **test** command and the single **build/lint** command the agents should rely on. If detection found nothing, ask me for them.
2. If no convention file was found, tell me the agents will fall back to matching the surrounding code, and offer to help write a short `CONVENTIONS.md` later (do not write it now).
3. **Offer the enforcement hooks. This is the part that makes the phase boundary mechanical instead of a promise, so do not skip past it.** When running as an installed plugin (`CLAUDE_PLUGIN_ROOT` is set), the output above says enforcement is available but not enabled. Put the choice to me plainly: without this, Gantry's "stay in the phase" and "no commit mid-phase" rules are contract-level only (the phase-reviewer catches violations on the diff after the fact); with it, two PreToolUse hooks enforce them in the moment (an edit to a file outside the active phase's list is blocked, and a `git commit`/`git push` mid-phase is blocked), opt-in and fail-open so a bad hook can never brick the repo. Then ask: "Enable the phase-enforcement hooks for this project?" If I say yes, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/init.js" --enable-hooks` (writes `.gantry/enabled`, gitignores the transient sentinel). If I say no or do not answer, do nothing - the hooks stay inert. A manual copy of Gantry (no plugin) never sees this step and never needs it.
4. From the printed "Model backends" section, mention it in one line: roles default to the native in-session Claude subagent, and `/gantry:models` can route the reviewers or planner to an external model (e.g. `codex`, if it showed `[found]`). Note that the implementer stays on the Claude Code harness so the enforcement hooks always fire. Do not change any backend now unless I ask.
5. Tell me the loop I now have, one line each: `/gantry:design` (optional design audit) -> `/gantry:plan` -> `/gantry:build` -> `/gantry:review`, plus `/gantry:audit` and `/gantry:verify` for keeping the docs honest.

Do not start any work. This command only sets up the pipeline.
