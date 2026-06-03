---
description: Run a feature through the full Gantry pipeline in order, with both review gates
argument-hint: <path-to-design-doc> [path-to-rubric]
---
Run the full Gantry pipeline on the design at `$1` (rubric: `$2` if given) by following the **gantry** orchestrator skill.

Drive the stages in order, stopping only at the human gates:
1. **Design review** (design-reviewer) - resolve any `[NEEDS USER DECISION]`, re-review if the design changed.
2. **Plan** (phase-planner) - resolve blockers, then show me the phases and get my go-ahead.
3. **Per phase, in order:** build (implementer) -> review (phase-reviewer) -> re-review after any fix -> stop for me to commit. Advance only after each phase is committed.

Both reviews are mandatory and you never commit for me. If `$1` is empty, ask me for the design doc - or, if I only have an idea, run the **design-plan-creator** skill first to author one, then continue. If the project isn't initialized, run `/gantry:init` first.
