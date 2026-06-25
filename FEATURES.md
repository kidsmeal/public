# Compass Rose ecosystem: feature plan

> **Sunset note (2026-06-24).** Compass Rose and Codebase Cartographer are removed. The cartobench A/B (see `TOOL_VALIDATION_FINDINGS.md`) killed cartographer's agent-navigation premise: the agent opened the generated docs 0 times in 48 runs. With one leg gone the connector had no job left. Kept: Gantry and ClauDHD, the two tools actually reached for while building. The compass-targeted items below (F1, F3, F5, F6, F7) are dead. F2 (gantry) and F4 (claudhd) stand. F8 reopens rather than ships: it retired ClauDHD's roadmap because compass owned that axis, and compass no longer does. The one salvage from cartographer, a coarse architecture-and-gotchas note the planner reads, now lives in `/gantry:init`. The rest of this doc is kept as the historical record of what the suite was before the cut.

Handoff doc for an implementing agent. Produced 2026-06-10, follows FIXES.md (the bug/drift batch). These are new features, reviewed against both project roadmaps so nothing here duplicates existing backlog. Design decisions are already made and written into each item; a few are flagged as veto points for the human. If the code contradicts a premise here, stop and flag rather than improvise.

## Prerequisites

- The FIXES.md batch is already applied in both working trees (uncommitted). This plan builds on top of it. Before starting, run `npm test` in `compass-rose/`, `cartographer/`, `gantry/`, and `ClauDHD/` and confirm green. If the fixes have since been committed, fine; if the tree is dirty with them, also fine. If a suite is red, stop and report.
- Read `compass-rose/SPEC.md` fully first. Also read `compass-rose/ROADMAP.md` "Design principles" (the ten principles); every item below was justified against them and your implementation must not violate them. The two that bite hardest: data-gathering in Node with the model only narrating, and each tool owns its axis (ClauDHD never learns about compass; compass never reimplements an instrument's job).

## Repo layout (this machine)

- `C:\Users\atk67\Documents\Github` is one git repo (the `public` monorepo) containing `compass-rose/`, `gantry/`, `cartographer/`.
- `C:\Users\atk67\Documents\ClauDHD` is a separate git repo.

## Ground rules

Same as FIXES.md: zero new runtime dependencies, CommonJS, `node --test` only, double quotes and semicolons, Windows-safe (`/\r?\n/`, `path.join`, `execFileSync` arg arrays), prose edits match each repo's voice (no em-dashes, no "not X, but Y", no rhetorical three-beat lists, no filler), do not commit or push, run the suites after each feature, report per-repo summaries at the end.

Work the features in order: F2, F5, F6, F7 (small, independent), then F1 (the big one), then F3, then F4, then F8. Each feature must leave all suites green before the next starts.

---

## F2. Persist the docs-impact flag (gantry)

**Why.** Gantry's phase-reviewer emits a Docs impact section in its verdict, but a verdict is chat text. If the flagged doc isn't refreshed in that same phase, the flag evaporates and staleness is rediscovered weeks later, which is the exact failure the check exists to prevent. Route it to the ledger Gantry already owns.

**Design decisions (made).**
- The phase-reviewer agent stays read-only. The WRITE belongs to the layer above: the gantry orchestrator skill and the `/gantry:review` command, after relaying a verdict whose Docs impact section is non-empty.
- Destination: `CURRENTNESS_AUDIT.md`, new section `## Open doc flags`. Entry format: `- [ ] <doc path>: <one line, what the diff invalidated> (phase N, <feature or plan name>)`.
- `/gantry:audit` reconciles: verify each open flag against the code, refresh or confirm the doc, then check the box and move the line into the audit's existing reconciled record.
- Degradation: no `CURRENTNESS_AUDIT.md` in the project means relay-only plus a one-line suggestion to run `/gantry:init`. Never create the file just for a flag.

**Changes.**
1. `gantry/templates/CURRENTNESS_AUDIT.md`: add the `## Open doc flags` section with a one-line comment explaining who writes it and who clears it.
2. `gantry/plugins/gantry/skills/gantry/SKILL.md`, Stage 3, after the verdict-relay step: instruct appending non-empty Docs impact findings to the audit's Open doc flags section (with the degradation rule).
3. `gantry/plugins/gantry/commands/review.md`: same instruction, one sentence.
4. `gantry/plugins/gantry/commands/audit.md`: add the reconcile-open-flags step.
5. compass surface (small): `compass-rose/plugins/compass/scripts/doctor.js` gains a warn-level check, "N unchecked entries in CURRENTNESS_AUDIT.md Open doc flags". Parse: lines matching `- [ ]` under that heading. Add a case to `compass-rose/test/doctor.test.js`.

**Acceptance.** A review verdict with docs-impact findings leaves a durable trail in the audit file; `/gantry:audit` clears it; doctor counts open flags.

---

## F5. Version-pinned dependencies (compass)

**Why.** Compass already behaviorally assumes gantry >= 0.3.0 (docs-impact) and claudhd >= 0.6.1 (quick cap). Claude Code plugin dependencies support semver constraints (verified against the official plugin-dependencies doc). Pin them so an instrument lagging behind is a named fact instead of a silent behavior gap.

**Changes.**
1. `compass-rose/plugins/compass/.claude-plugin/plugin.json`: convert `"dependencies": ["cartographer", "claudhd", "gantry"]` to object entries with version ranges. Read each instrument's CURRENT version from its own plugin.json in this checkout and pin `>=` that version (expected: gantry >=0.3.0, claudhd per `ClauDHD/plugins/claudhd/.claude-plugin/plugin.json`, cartographer per its plugin.json). Verify the exact object shape against the plugin-dependencies doc format: `{ "name": "...", "version": ">=x.y.z" }`.
2. `compass-rose/plugins/compass/scripts/version.js`: where it best-effort locates each instrument, also read that instrument's plugin.json version and compare against the required range. Implement only a `>=x.y.z` comparator (split on dots, compare numerically); do not write a general semver engine. Output per instrument: found version, required range, ok or BEHIND.
3. Test: `compass-rose/test/version.test.js` (new) covering the comparator (equal, ahead, behind, malformed version string degrades to "unknown", never throws).

**Acceptance.** `/compass:version` names any instrument older than the pinned minimum.

---

## F6. Done-row archival (compass)

**Why.** Done rows accumulate in ROADMAP.md's Now/Next sections forever; the hub gets noisy, which is its own staleness vector. Archival is a safe, mechanical doctor `--fix` action.

**Design decisions (made).**
- Rows move, never delete. Destination: a `## Shipped` section at the bottom of ROADMAP.md (create if absent). The row moves intact: title line with its `<!-- id: ... -->` comment plus all field sub-bullets, checkbox flipped to `[x]` if not already.
- The script side only detects; the move itself is a command-level `--fix` action (the model edits, shows the diff), consistent with doctor.js's never-writes rule.

**Changes.**
1. `compass-rose/plugins/compass/scripts/doctor.js`: info-level finding when a row with `status: done` sits in a section other than Shipped (the parser already records each row's section). Fix text: "archive to ## Shipped (doctor --fix)".
2. `compass-rose/plugins/compass/commands/doctor.md`: add the archival action to the safe-fix list, with the exact move semantics above.
3. `compass-rose/test/doctor.test.js`: fixture with a done row under Now, assert the finding; done row already under Shipped, assert no finding.

**Acceptance.** doctor flags misplaced done rows; `--fix` moves them whole; the trail (id, links) survives the move.

---

## F7. Walkthrough as golden fixture (compass)

**Why.** `compass-rose/examples/walkthrough.md` is the canonical live example of every schema, and nothing stops it drifting from the parser.

**Changes.**
1. Read `examples/walkthrough.md` and identify how the roadmap-row content appears (it will be inside fenced blocks, since it shows file contents; the parser deliberately skips fenced rows in real roadmaps, so the test must extract fence CONTENTS and parse those directly).
2. New `compass-rose/test/walkthrough.test.js`: extract the fenced block(s) that show ROADMAP.md content (anchor the extraction on the nearest preceding heading or file-name mention; keep the extraction tolerant but assert it found at least one block so silent non-matches fail the test). Run `parseRoadmap` on the contents. Assert: the row parses with an id, a valid status, and zero `unknownStatus`/`unknownPhaseState` flags, and lint produces no warnings inconsistent with the stage the walkthrough depicts.
3. If the walkthrough's example rows are themselves out of date with the schema, fix the walkthrough (that is the point of the test) and note it in the report.

**Acceptance.** The suite fails if walkthrough and parser ever disagree again.

---

## F1. advance.js: the deterministic dispatcher (compass) — the centerpiece

**Why.** `/compass:advance` currently asks the model to infer pipeline position from NOW.md, roadmap prose, the plan, and git state. The state model exists precisely to kill prose interpretation, but the dispatcher still interprets prose. Finish the arc: a script reads the tuple plus cheap git evidence and decides; the model executes and narrates. This adds the missing row to SPEC §7's deterministic-engine table and makes the "zero wrong-step advances" success criterion mechanical.

**Design decisions (made).**
- New `compass-rose/plugins/compass/scripts/advance.js`, zero deps, reuses the `roadmap.js` parser. Read-only by default; `--apply` writes a prescribed transition (see writer below).
- Inputs: root resolution like the sibling scripts (`COMPASS_PROJECT_DIR`-style env if the siblings use one, else `CLAUDE_PROJECT_DIR`, else cwd; match whatever status.js does), optional `--id <row-id>` (default: `activeFeature()` from roadmap.js), optional `--phase N`.
- Evidence gathered (cheap, git via execFileSync arrays, each call individually allowed to fail soft): working tree dirty or clean (`git status --porcelain`), and whether the design/plan files the row links actually exist.
- The decision table, from (status, phase_state, evidence) to a single next step. Implement exactly this and print which rule fired:
  - status idea/designing, or full-lane row with no design link: next = PROMOTE (run /compass:promote), gate HUMAN DECISION REQUIRED.
  - status designed, no plan: next = PLAN (/gantry:plan), gate SAFE TO ADVANCE.
  - status planned (or small-lane with plan, nothing built): next = BUILD phase max(active_phase,1), gate SAFE TO ADVANCE.
  - in_progress + building: next = BUILD (continue/finish phase), gate SAFE TO ADVANCE.
  - in_progress + in_review: next = REVIEW (/gantry:review), gate SAFE TO ADVANCE.
  - in_progress + review_failed: next = BUILD (fix findings, then re-review), gate REVIEW FAILED.
  - in_progress + ready_to_commit: next = WAIT FOR COMMIT, gate COMMIT REQUIRED.
  - in_progress + committed: next = ADVANCE (bump active_phase, phase_state building; or status done if the plan has no further phase: detect by reading the plan file's phase headings if the link resolves, else report "cannot count phases" and leave the done call to the human), gate SAFE TO ADVANCE.
  - status blocked: next = UNBLOCK, gate BLOCKED, print blocked_by.
  - status done: next = NOTHING (suggest /claudhd:shipped if not yet logged), gate SAFE TO ADVANCE.
- Conflict detection, report-only, never auto-resolved (gate HUMAN DECISION REQUIRED when any fires): ready_to_commit but the tree is clean (probably already committed); committed but the tree is dirty (unknown work in flight); building/in_review but the tree is clean (nothing actually built); design/plan link missing on disk while status implies it exists.
- Output: plain text in the status.js style. Sections: position (id, title, tuple, lane), evidence, conflicts (if any), next step + the exact command, expected gate label, and the prescribed row transition (the after-state tuple).
- Graceful degradation: no ROADMAP.md, or rows without schema fields, prints one line saying structured state is absent and exits 0; the command then falls back to today's prose interpretation.
- The writer: `roadmap.js` gains `setFields(text, id, fields)` returning new text. Line-targeted: locate the row by id comment, update existing `- key: value` sub-bullet lines in place, append missing keys after the last existing field bullet of that row, touch nothing else (preserve indentation, CRLF if present, surrounding prose, fence content untouched). `advance.js --apply --id X --set status=in_progress --set phase_state=building` (or a single `--transition` flag applying the prescribed after-state; pick the simpler CLI and document it in the header).
- `compass-rose/plugins/compass/commands/advance.md` rewrite of the dispatch part only: step 0 runs advance.js and trusts its read; on a reported conflict, stop at `=== GATE: HUMAN DECISION REQUIRED ===` and show the conflict verbatim; after each completed step, apply the prescribed transition via `--apply` rather than hand-editing. The tuple-mapping prose (current lines 14-21) stays as the human-readable contract; the gate-label list at the bottom stays.

**Tests** (`compass-rose/test/advance.test.js`, table-driven):
- every decision-table row maps to its expected next step and gate;
- each conflict rule fires on its fixture and not on clean fixtures;
- setFields: updates in place, appends missing keys, preserves CRLF and unrelated content byte-for-byte outside the targeted lines, no-op when id not found (returns null or throws, pick one and test it);
- degradation: schema-less roadmap exits 0 with the fallback line.

**Acceptance.** For any tuple+evidence fixture the script names one step, one gate, one transition; the command layer never infers position when the schema is present.

---

## F3. SessionStart unified brief (compass) — VETO POINT

**Why.** Reorientation is the suite's biggest claimed daily value and it currently relies on remembering to type `/compass:status`, which violates the automatic-over-disciplined principle. The README already names this as a later candidate; this builds it.

**Human veto note: the decision baked in here is a SECOND SessionStart hook (compass's own, two-line budget) rather than extending ClauDHD's brief. Rationale: ClauDHD stays compass-unaware (principle 10), and the outputs are complementary, continuity vs position. If the human disagrees, stop and ask before building.**

**Design decisions (made).**
- New `compass-rose/plugins/compass/hooks/hooks.json` registering a SessionStart hook running `scripts/sessionbrief.js` via `${CLAUDE_PLUGIN_ROOT}` (copy the wiring style and timeout from `ClauDHD/plugins/claudhd/hooks/hooks.json`).
- `sessionbrief.js` prints AT MOST two lines, and only when `ROADMAP.md` exists and contains at least one schema-bearing row that is not done. Otherwise print nothing and exit 0 (dead silent in non-compass repos; this is the no-noise contract).
- Line 1: `compass: <row title> [<id>] - <status>/<active_phase>/<phase_state>` for the active feature (reuse `activeFeature()`).
- Line 2, only when warranted: either `blocked: <n> row(s)` or one staleness flag from the cheap signals already available (roadmap lint issue count, or the doctor-style commit-age lite check capped to one git call). No cartographer invocation here, it is too slow for a hook. If nothing is warranted, line 2 is omitted.
- Budget: the script must complete in well under a second; at most two git calls, fail soft on all of them.

**Tests** (`compass-rose/test/sessionbrief.test.js`): silent when no roadmap; silent when roadmap has no schema rows; exact line-1 format for a live row; line 2 appears for a blocked row and is absent otherwise.

**Acceptance.** Opening a session in a compass project shows position in two lines without any command; opening one anywhere else shows nothing.

---

## F4. Statusline binding (claudhd) — has one genuine open question

**Why.** Claude Code's statusline can run a script per render; brief.js already computes the active thread, quick count, and drift flags locally for zero tokens. A cursor that never leaves the screen is the purest form of this product for its audience.

**Open question the agent must resolve FIRST: how a plugin ships a statusline command with a stable path.** The plugin cache path changes per version, so writing the cache path into settings.json rots on update. Check the official Claude Code statusline and plugin docs (statusline configuration, whether plugins can provide a statusline natively or via `${CLAUDE_PLUGIN_ROOT}` in settings). If there is a native plugin statusline mechanism, use it. If not, the fallback design below applies, with its limitation documented honestly.

**Design decisions (fallback, if no native mechanism).**
- New `ClauDHD/plugins/claudhd/scripts/statusline.js`: reads the statusline stdin JSON, resolves the project dir from it (per the statusline protocol docs), and prints ONE line: the active thread's short name, `q:<n>` when the quick batch is non-empty, and `stale` when the cursor exceeds the staleness threshold (import `CURSOR_STALE_HOURS` and `QUICK_CAP` from `constants.js`, added by the fixes batch). File reads only, NO git calls, no locks; target under 50ms. Missing or non-claudhd NOW.md prints nothing.
- New command `ClauDHD/plugins/claudhd/commands/statusline.md`: resolves the current plugin root at install time, writes the statusLine entry into the project's `.claude/settings.json` (merge, do not clobber existing settings), and states plainly that a plugin update can change the path and re-running the command repairs it.
- README: short section under the existing automation docs.

**Tests** (`ClauDHD/test/statusline.test.js`): output for a normal cursor; quick count appears only when non-zero; stale flag honors the constant; silent on missing NOW.md or missing marker; malformed stdin JSON degrades to silence, never throws.

**Acceptance.** The statusline shows the cursor in any initialized project; nothing is printed (and nothing crashes) anywhere else.

---

## F8. Retire the /claudhd:roadmap candidate (ClauDHD) — VETO POINT

**Why.** ClauDHD's ROADMAP.md still lists a `/claudhd:roadmap` template + command as a Next candidate. ROADMAP.md ownership now lives with Cartographer (template) and Compass (schema + parser); building it in ClauDHD would violate the each-tool-owns-its-axis principle all three roadmaps endorse.

**Human veto note: this edits the owner's own backlog prose. The decision (kill it as covered-by-compass) was recommended and the human asked for it to be in the plan, but apply it last and call it out separately in the final report.**

**Change.** In `ClauDHD/ROADMAP.md`: remove the `/claudhd:roadmap` bullet from Next and add one line under Non-goals, in the file's existing voice, stating that a project-level roadmap is Cartographer/Compass territory now (template in the cartographer plugin, row schema in compass), and standalone ClauDHD users who want one should take Cartographer's template. Keep the worktree-fleet candidate untouched.

---

## Out of scope

- compass-rose's own ROADMAP.md content updates (stale statuses, fenced rows). Owner's prose; the human does this separately.
- Any cross-repo workspace, daemon, database, or second cursor. Hard non-goals in all three roadmaps.

## Done means

- F1 through F8 applied in the stated order, suites green in all four packages after each feature.
- Nothing committed. Per-repo change summary, the F4 open-question resolution (what the docs said, what was chosen), and both veto-point outcomes reported back to the human.
