---
description: Scaffold Gantry's living docs into this project and detect its conventions + test/build commands
allowed-tools: Bash(node:*), Read, Edit
---
!`node "${CLAUDE_PLUGIN_ROOT}/scripts/init.js"`

Gantry's audit docs are scaffolded and the project signals are printed above. Now finish wiring the pipeline to THIS project - keep it short:

1. From the printed "Convention/style files found" and "Detected stack(s)", confirm with me the single **test** command and the single **build/lint** command the agents should rely on. If detection found nothing, ask me for them.
2. If no convention file was found, tell me the agents will fall back to matching the surrounding code, and offer to help write a short `CONVENTIONS.md` later (do not write it now).
3. Tell me the loop I now have, one line each: `/gantry:design` (optional design audit) -> `/gantry:plan` -> `/gantry:build` -> `/gantry:review`, plus `/gantry:audit` and `/gantry:verify` for keeping the docs honest.

Do not start any work. This command only sets up the pipeline.
