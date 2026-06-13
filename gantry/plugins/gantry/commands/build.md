---
description: Implement exactly one phase of a plan, tests-first, then stop for review
argument-hint: <path-to-plan> <phase-number>
---
Before spawning the implementer, run and wait for:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/sentinel.js write $1 $2
```

This writes the active-phase sentinel (`.gantry/active-phase.json`) with the phase's file list before the implementer's first edit, so the file-list guard is active from the first tool call. If the project has not opted in (no `.gantry/enabled` marker), the guard is inert and this call is a harmless no-op; run it regardless.

Spawn the **implementer** subagent to implement exactly ONE phase.

- Plan file: `$1`
- Phase: `$2`

If either argument is missing, ask me - do not guess the phase.

The implementer works tests-first (where a test framework exists), stays inside the plan's file list, will not commit, and will not advance past the one phase. When it returns, relay its report verbatim: files changed, test status, each exit criterion, scope drift, and any blockers it hit. Set the phase's `**Status:**` line in the plan to `built` (the implementer never edits the plan; you do). Then stop and recommend `/gantry:review $1 $2` before I commit. Do not start the next phase, and do not commit.
