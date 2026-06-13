---
description: Implement exactly one phase of a plan, tests-first, then stop for review
argument-hint: <path-to-plan> <phase-number>
---
Arguments: $ARGUMENTS

Resolve a plan file and a phase number from those arguments before doing anything else, tolerating filler:
- **Plan file**: the plan path in the arguments (a path, normally ending in `_plan.md` or `-plan.md`).
- **Phase**: the phase number (the integer). Ignore a literal `phase` token if it appears, so `<plan> phase 3`, `<plan> 3`, and `phase 3` all resolve to the same plan and phase 3.
- If a phase number is given with no plan path, locate the plan yourself (the `*_plan.md` / `*-plan.md` the project is currently building) and confirm it with me before continuing.
- If you cannot determine BOTH a plan file and a phase number, ask me - do not guess the phase.

Use the resolved plan path and phase number (called `<plan>` and `<phase>` below), NOT the raw argument tokens, in every command and subagent call.

Before spawning the implementer, run and wait for:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/sentinel.js write <plan> <phase>
```

This writes the active-phase sentinel (`.gantry/active-phase.json`) with the phase's file list before the implementer's first edit, so the file-list guard is active from the first tool call. If the project has not opted in (no `.gantry/enabled` marker), the guard is inert and this call is a harmless no-op; run it regardless.

Spawn the **implementer** subagent to implement exactly ONE phase, passing it the resolved `<plan>` and `<phase>`.

The implementer works tests-first (where a test framework exists), stays inside the plan's file list, will not commit, and will not advance past the one phase. When it returns, relay its report verbatim: files changed, test status, each exit criterion, scope drift, and any blockers it hit. Set the phase's `**Status:**` line in the plan to `built` (the implementer never edits the plan; you do). Then stop and recommend `/gantry:review <plan> <phase>` before I commit. Do not start the next phase, and do not commit.
