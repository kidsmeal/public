---
description: Run a feature through the full Gantry pipeline in order, with both review gates
argument-hint: <path-to-design-doc> [path-to-rubric]
---
Arguments: $ARGUMENTS

From those arguments, resolve the design doc path (the main path, normally a `*_design.md` / `*-design.md` or a draft) and an optional rubric path. Ignore filler words like `design` or `rubric` between the paths. Use the resolved paths, not the raw argument tokens.

Run the full Gantry pipeline on the resolved design (with the resolved rubric if given) by following the **gantry** orchestrator skill.

Drive the stages in order, stopping only at the human gates:
1. **Design review** (design-reviewer) - resolve any `[NEEDS USER DECISION]`, re-review if the design changed.
2. **Plan** (phase-planner) - resolve blockers, then show me the phases and get my go-ahead.
3. **Per phase, in order:** build (implementer) -> review (phase-reviewer) -> re-review after any fix -> stop for me to commit. Advance only after each phase is committed.

Both reviews are mandatory and you never commit for me. If no design doc is in the arguments, ask me for one - or, if I only have an idea, run the **design-plan-creator** skill first to author one, then continue. If the project isn't initialized, run `/gantry:init` first.
