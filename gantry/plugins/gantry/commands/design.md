---
description: Audit a draft design doc against the project's rubric (or a generic checklist) before planning
argument-hint: <path-to-draft> [path-to-rubric]
---
Arguments: $ARGUMENTS

From those arguments, resolve the draft path (the main path, normally a `*_design.md` / `*-design.md` or a draft) and an optional rubric path. Ignore filler words like `draft` or `rubric` between the paths. If no rubric is given, the agent looks for one and otherwise falls back to its built-in design-quality checklist. If no draft path is in the arguments, ask me for it instead of guessing.

Spawn the **design-reviewer** subagent to audit the resolved draft (with the resolved rubric if given) before it goes to planning.

The agent writes a revised `<draft>_reviewed.md` - fixing every resolvable violation in place and replacing the rest with `[NEEDS USER DECISION]` markers. When it returns, relay its summary (violations found / resolved / needing-decision, plus coherence flags). Then walk me through each `[NEEDS USER DECISION]` one at a time so we resolve them and update the reviewed doc. Once it reads "Ready for phase planning: yes", recommend running `/gantry:plan` on the reviewed doc.
