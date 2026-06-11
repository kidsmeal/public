---
description: Review the uncommitted diff for one phase against the plan and the project's conventions
argument-hint: <path-to-plan> <phase-number>
---
Spawn the **phase-reviewer** subagent (read-only) to review the current uncommitted diff against the plan.

- Plan file: `$1`
- Phase: `$2`

If either argument is missing, ask me.

Relay the agent's verdict verbatim - PASS / FAIL / PASS-WITH-NOTES - and its specific findings, including the Docs impact section listing any standing docs (`docs/INDEX.md`, `docs/GLOSSARY.md`, `docs/CONVENTIONS.md`) the diff made stale. Stale docs flagged here must be refreshed this phase. If the Docs impact section is non-empty, append each flagged doc to `CURRENTNESS_AUDIT.md`'s `## Open doc flags` section: `- [ ] <doc path>: <one line, what the diff invalidated> (phase N, <feature or plan name>)`; if no audit file exists, skip and note that `/gantry:init` would enable it.
- On **FAIL**: do not commit. Send the Required fixes back to the implementer via `/gantry:build $1 $2`, then re-review. Repeat up to 2 cycles; if still failing, stop and hand it to me.
- On **PASS-WITH-NOTES**: if there are **Fix-now notes**, send them to the implementer as a scoped fix pass on the same phase, then re-review before presenting for commit. Only **Deferred notes** (pending APIs, plan-blessed placeholders, later-phase consumers) may survive into the commit unchanged. Do not present a diff with outstanding fix-now notes for commit.
- **Before the commit gate, log every Deferred note so none is dropped.** Append each to `CURRENTNESS_AUDIT.md`'s `## Deferred review notes` section: `- [ ] <note, with file:line>: <why deferred> (phase N, <feature or plan name>)`. If no audit file exists, append them to the plan's own phase section instead and tell me that `/gantry:init` would enable persistent tracking. A deferred note must land in writing somewhere durable — never only in chat.
- On **PASS** (or PASS-WITH-NOTES with only deferred notes remaining, now logged): tell me it is safe to commit and let me gate the commit. Never commit on my behalf unless I explicitly say so.
