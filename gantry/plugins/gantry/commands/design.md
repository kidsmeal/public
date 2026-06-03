---
description: Audit a draft design doc against the project's rubric (or a generic checklist) before planning
argument-hint: <path-to-draft> [path-to-rubric]
---
Spawn the **design-reviewer** subagent to audit the draft design before it goes to planning.

- Draft: `$1`
- Rubric / rules file (optional): `$2` - if omitted, the agent looks for one and otherwise falls back to its built-in design-quality checklist.

If `$1` is empty, ask me for the draft path instead of guessing.

The agent writes a revised `<draft>_reviewed.md` - fixing every resolvable violation in place and replacing the rest with `[NEEDS USER DECISION]` markers. When it returns, relay its summary (violations found / resolved / needing-decision, plus coherence flags). Then walk me through each `[NEEDS USER DECISION]` one at a time so we resolve them and update the reviewed doc. Once it reads "Ready for phase planning: yes", recommend running `/gantry:plan` on the reviewed doc.
