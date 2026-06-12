# Phase enforcement hooks - Design review (design-reviewer)

- **Date:** 2026-06-12
- **Project:** Gantry (a Claude Code plugin; plain Node.js, zero deps)
- **Design doc:** `gantry/docs/phase-hooks-design.md` -> reviewed in place at `gantry/docs/phase-hooks-design_reviewed.md`
- **Stage:** design gate, run twice (initial audit, then a re-review after the flagged decisions were resolved)
- **Feature:** two PreToolUse hooks (file-list guard, commit/push guard) that make Gantry's phase boundary and no-commit rule mechanical instead of prompt-level.

## What the stage produced

### Round 1 - initial audit of the draft

Verdict line: **"Ready for phase planning: no - pending 6 user decisions."**

Violations found: 9. Resolved in place: 3. Flagged `[NEEDS USER DECISION]`: 6.

The six flags, trimmed to the catch:

1. **Subagent hook reachability.** The whole file-list guard rests on the unverified claim that a plugin-native PreToolUse hook fires for tool calls made *inside* the implementer subagent. If it does not, the guard does nothing. "Do not build on the assumption unverified."
2. **Self-blocking sentinel write (deadlock).** The design had "the pipeline" write and clear the sentinel via Write/Bash and run git at the gate, but those calls are subject to the very hooks being added. An agent-driven sentinel write that the file-list guard then blocks is a deadlock.
3. **Allow-list source of truth.** The allow-list was a hardcoded literal with audit docs at repo root, but init.js puts them in `docs/` when that dir exists, and `ROADMAP.md` is a leftover the repo never scaffolds. The guard cannot match a path the sentinel lists at the wrong location.
4. **Matched-tool field names.** The matcher included `MultiEdit`/`NotebookEdit`, but `NotebookEdit` names its target `notebook_path`, not `file_path`. The guard would read `undefined` and silently pass every notebook write.
5. **Plugin-vs-manual detection.** The opt-in step gated on "detect whether running as a plugin," but init.js had no such detection and keyed on env set in both cases.
6. **Session id availability.** The staleness rule needs the current session id from the hook payload, which was not confirmed to exist.

A correction the reviewer made in place, worth calling out: the draft's framing said the repo had **no test framework**. The reviewer checked and found one (`node --test`, `test/*.test.js`, a `test` script in package.json) and added test-coverage requirements to the affected units. The author's premise was wrong; the gate caught it before the plan inherited it.

### Round 2 - re-review after the 6 decisions were resolved

Verdict line: **"Ready for phase planning: no - pending 1 user decision."**

All 6 prior resolutions confirmed holding. Three new problems surfaced, introduced by the resolutions themselves: 2 fixed in place, 1 newly flagged.

- Fixed: a **fail-CLOSED path** in the Windows root resolution (a wrong-but-valid project root would relativize to a non-matching path and *deny* a legitimate edit instead of failing open). Fixed to treat "target escapes root" or "no resolvable root" as fail-open.
- Fixed: **write/clear ordering** stated as an explicit sequencing constraint (sentinel must exist before the implementer spawns; must clear before the human is told to commit).
- Newly flagged `[NEEDS USER DECISION]`: **fix-mode scope contradiction.** `implementer.md` line 29 authorizes a fix at a reviewer-cited file even if the plan's file list omitted it, but `sentinel.js write <plan> <phase>` computes the file list from the plan alone. So under the guard, a fix pass to a cited-but-unlisted file would be denied even though the implementer was explicitly authorized. The draft's claim that the fix loop "re-edits the same files" was false.

## Why it was useful

The design gate failed the design twice, pre-code, on problems that would each have cost real
time downstream:

- The **deadlock** (Gantry's own plumbing tripping its own new guards) would have surfaced as a
  baffling mid-build failure. It was caught as a contradiction in the doc and fixed by moving all
  sentinel I/O into a dedicated `sentinel.js` invoked via Bash, which neither guard intercepts.
- The **test-framework premise** was simply wrong, and the planner would have built hooks with no
  test coverage on a repo that tests everything else.
- The **fix-mode contradiction** is the subtle one: the feature would have built, passed its own
  tests, and then quietly broken the FAIL->fix loop for every future Gantry user the first time a
  reviewer cited an unlisted file. Caught before a line of code.

## Resolution

The single remaining decision (fix-mode scope) was resolved by the human as **option B**: widen the
sentinel with the reviewer's cited paths on FAIL (via `sentinel.js add-files`), leaving
`implementer.md` untouched. Authorization model: an edit is allowed iff the plan listed the file or
the reviewer cited it in writing. With that, the design reads ready for phase planning.

## Diff

Design stage produces docs, not code. The reviewed doc carries the full record: each `Resolved
(...)` block in `gantry/docs/phase-hooks-design_reviewed.md` is one of the catches above and how it
was closed. No source files changed in this stage.
