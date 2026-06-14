---
description: Audit a draft design doc against the project's rubric (or a generic checklist) before planning
argument-hint: <path-to-draft> [path-to-rubric]
---
Arguments: $ARGUMENTS

From those arguments, resolve the draft path (the main path, normally a `*_design.md` / `*-design.md` or a draft) and an optional rubric path. Ignore filler words like `draft` or `rubric` between the paths. If no rubric is given, the agent looks for one and otherwise falls back to its built-in design-quality checklist. If no draft path is in the arguments, ask me for it instead of guessing.

**Dispatch the design-reviewer to its configured model backend.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/role.js resolve design-reviewer`:
- `DISPATCH: native`: spawn the **design-reviewer** subagent (use the model the resolve output names) to audit the resolved draft (with the resolved rubric if given) before it goes to planning.
- `DISPATCH: external`: run `node ${CLAUDE_PLUGIN_ROOT}/scripts/role.js run design-reviewer -- <draft> <rubric>` and treat its stdout as the agent's summary. The external reviewer reads the rubric and writes the revised doc itself; do not also spawn the subagent. On failure (CLI missing/unauthed/non-zero), report it and fall back to the native subagent.

The agent writes a revised `<draft>_reviewed.md` - fixing every resolvable violation in place and replacing the rest with `[NEEDS USER DECISION]` markers. When it returns, relay its summary (violations found / resolved / needing-decision, plus coherence flags). Then walk me through each `[NEEDS USER DECISION]` one at a time so we resolve them and update the reviewed doc. Once it reads "Ready for phase planning: yes", recommend running `/gantry:plan` on the reviewed doc.
