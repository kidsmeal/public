---
description: Implement exactly one phase of a plan, tests-first, then stop for review
argument-hint: <path-to-plan> <phase-number>
---
Spawn the **implementer** subagent to implement exactly ONE phase.

- Plan file: `$1`
- Phase: `$2`

If either argument is missing, ask me - do not guess the phase.

The implementer works tests-first (where a test framework exists), stays inside the plan's file list, will not commit, and will not advance past the one phase. When it returns, relay its report verbatim: files changed, test status, each exit criterion, scope drift, and any blockers it hit. Then stop and recommend `/gantry:review $1 $2` before I commit. Do not start the next phase, and do not commit.
