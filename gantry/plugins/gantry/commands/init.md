---
description: Scaffold Gantry's living docs into this project and detect its conventions + test/build commands
allowed-tools: Bash(node:*), Read
---
!`node "${CLAUDE_PLUGIN_ROOT}/scripts/init.js"`

Gantry's audit docs are scaffolded and the project signals are printed above. Now finish wiring the pipeline to THIS project - keep it short:

1. From the printed "Convention/style files found" and "Detected stack(s)", confirm with me the single **test** command and the single **build/lint** command the agents should rely on. If detection found nothing, ask me for them.
2. If no convention file was found, tell me the agents will fall back to matching the surrounding code, and offer to help write a short `CONVENTIONS.md` later (do not write it now).
3. **Hook opt-in (installed plugin only).** When running as an installed plugin (`CLAUDE_PLUGIN_ROOT` is set), the output above will say "enforcement is available but NOT enabled." Ask me: "Do you want to enable the phase-enforcement hooks for this project? They will gate file edits to each phase's plan-listed files and block mid-phase commits." If I say yes, run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/init.js" --enable-hooks` - this writes `.gantry/enabled` and adds `.gantry/active-phase.json` to `.gitignore`, activating the PreToolUse guards. If I say no (or do not answer), do nothing. The hooks stay inert and nothing changes. A manual copy of Gantry (no plugin) never sees this step and never needs it.
4. Tell me the loop I now have, one line each: `/gantry:design` (optional design audit) -> `/gantry:plan` -> `/gantry:build` -> `/gantry:review`, plus `/gantry:audit` and `/gantry:verify` for keeping the docs honest.

Do not start any work. This command only sets up the pipeline.
