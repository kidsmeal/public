---
description: Turn a finalized design doc into a phased implementation plan
argument-hint: <path-to-design-doc>
---
Spawn the **phase-planner** subagent to plan the implementation of the design doc at: `$ARGUMENTS`

If no path was given, ask me for one - do not invent a design.

Tell the agent to read this project's convention files (`CLAUDE.md` / `AGENTS.md` / `CONVENTIONS.md` / `docs/CONVENTIONS.md` - whichever exist) and to detect the project's test/build command before planning.

When it returns, relay its summary verbatim: phase count, any blockers that prevent starting phase 1, and the path to the written plan. The plan is the deliverable - do not start implementing. If there are blockers, surface them so I can resolve them before we run `/gantry:build`.
