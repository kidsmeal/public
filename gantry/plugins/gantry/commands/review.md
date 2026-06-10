---
description: Review the uncommitted diff for one phase against the plan and the project's conventions
argument-hint: <path-to-plan> <phase-number>
---
Spawn the **phase-reviewer** subagent (read-only) to review the current uncommitted diff against the plan.

- Plan file: `$1`
- Phase: `$2`

If either argument is missing, ask me.

Relay the agent's verdict verbatim - PASS / FAIL / PASS-WITH-NOTES - and its specific findings, including the Docs impact section listing any standing docs (`docs/INDEX.md`, `docs/GLOSSARY.md`, `docs/CONVENTIONS.md`) the diff made stale. Stale docs flagged here must be refreshed this phase.
- On **FAIL**: do not commit. Offer to send the Required fixes back through `/gantry:build $1 $2`, or to fix them directly.
- On **PASS** or **PASS-WITH-NOTES**: tell me it is safe to commit and let me gate the commit. Never commit on my behalf unless I explicitly say so.
