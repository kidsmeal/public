# Compass Rose ecosystem: fix list

Handoff doc for an implementing agent. Produced 2026-06-10 from a four-repo audit (one reviewer per repo plus cross-seam verification). Every item below was confirmed against the code, not just reported. If a line number has drifted, trust the code and apply the intent; note the discrepancy in your report.

## Repo layout (this machine)

- `C:\Users\atk67\Documents\Github` is ONE git repo (the `public` monorepo, branch main). It contains `compass-rose/`, `gantry/`, `cartographer/` as subdirectories. They are not separate repos.
- `C:\Users\atk67\Documents\ClauDHD` is a separate git repo.
- The contract everything must honor: `compass-rose/SPEC.md`. Read it first, fully, before touching anything. Key sections: the roadmap-row schema (§2), the state machine (§3), the lanes (§4), the gate labels (§5), the freshness contract (§6).

## Ground rules

1. Zero new runtime dependencies anywhere. Plugin scripts are dependency-free CommonJS. Tests use node's built-in runner (`node --test`) only.
2. Match existing code style: double quotes, semicolons, terse comments that state constraints, not narration.
3. Prose edits (README, SKILL.md, command .md files): match the repo's existing voice exactly. Hard rules: no em-dashes, no "not X, but Y" constructions, no three-beat rhetorical lists, no filler intensifiers, no tagline closers. State the fact and move on.
4. This is a Windows machine. Split lines with `/\r?\n/`, build paths with `path.join`, invoke git via `execFileSync("git", [args])` arrays. The existing code already does all three; keep it that way.
5. After each batch, run the test suites: `npm test` in `compass-rose/`, `cartographer/`, `ClauDHD/` (and `gantry/` once C1 exists). All must be green before moving on.
6. Do not commit or push anything. Leave the working trees dirty for human review, with a summary of what changed per repo.
7. Work the batches in order: A (mechanical), then B (small design fixes, decisions already made), then C (tests and CI).

---

## Batch A: mechanical fixes

### A1. drift.js skips ROADMAP.md, verify.js checks it

- File: `cartographer/plugins/cartographer/scripts/drift.js` lines 24-27.
- `DOC_CANDIDATES` omits `"docs/ROADMAP.md", "ROADMAP.md"` while `verify.js` lines 22-25 includes both. Add them to drift.js (before `"CLAUDE.md"`), matching verify.js order.
- Add a case to `cartographer/test/drift.test.js`: a ROADMAP.md citing an existing file appears in the drift results.

### A2. roadmap.js never validates phase_state values

- File: `compass-rose/plugins/compass/scripts/roadmap.js`.
- Status is validated against `STATUSES` (line ~100, sets `unknownStatus`) and lane against `LANES` (lint, line ~144), but the `phase_state` case (line ~108) just lowercases. `phase_state: frobnicate` passes silently.
- Per SPEC §3 the valid values are: `building, in_review, review_failed, ready_to_commit, committed`. There may already be a `PHASE_STATES` constant at the top of the file; if not, add one.
- Mirror the status handling: set an `unknownPhaseState` flag in parse, and push a warn in `lint()` (`unknown phase_state "..."`), alongside the existing line-147 missing-phase_state check.
- Add a test to `compass-rose/test/roadmap.test.js` (unknown phase_state flagged; valid one not flagged).

### A3. Gantry version drift

- `gantry/README.md` line 43 says you should see `Gantry v0.2.0`. The plugin is 0.3.0 (`gantry/plugins/gantry/.claude-plugin/plugin.json` line 5, `gantry/.claude-plugin/marketplace.json` line 14). Fix the README.
- Also grep the two skill files (`gantry/plugins/gantry/skills/*/SKILL.md`) for any `version` frontmatter still at 0.2.0 and sync to 0.3.0.

### A4. Design author and planner don't read GLOSSARY.md

- compass-rose's README promises the design author and planner read `docs/INDEX.md` and `docs/GLOSSARY.md` first. Neither names the glossary.
- `gantry/plugins/gantry/skills/design-plan-creator/SKILL.md` line ~18: add `docs/GLOSSARY.md` to the map-grounding read list (alongside INDEX/ARCHITECTURE, keep the "if present" degradation).
- `gantry/plugins/gantry/agents/phase-planner.md` line ~20: add `docs/GLOSSARY.md` to the named convention/orientation docs list.

### A5. compass init.js miscounts conventions files

- File: `compass-rose/plugins/compass/scripts/init.js` line ~25.
- The conventions-candidates list includes `"AGENTS.md"` and `"CLAUDE.md"`. Neither is a conventions file per the spec (CLAUDE.md is the "where things are" block, AGENTS.md is a generic binding). Remove both; keep `CONVENTIONS.md` and `docs/CONVENTIONS.md`.
- Check whether any output text or test references the removed candidates and adjust.

### A6. Docs-impact check is invisible above the reviewer

- `gantry/plugins/gantry/agents/phase-reviewer.md` lines ~49-53 fully specify a docs-impact check (which standing docs the diff made stale). The orchestrator and command never mention it, so it gets dropped when relaying.
- `gantry/plugins/gantry/skills/gantry/SKILL.md`, Stage 3, the "relay the verdict" step: add one sentence that the verdict includes a Docs impact section listing standing docs (`docs/INDEX.md`, `docs/GLOSSARY.md`, `docs/CONVENTIONS.md`) the diff made stale, and that it must be relayed and acted on this phase.
- `gantry/plugins/gantry/commands/review.md` line ~12: append the same expectation to "relay the agent's verdict".

### A7. scan_repo.py invocation assumes `python`

- File: `cartographer/plugins/cartographer/skills/codebase-cartographer/SKILL.md` line ~79 says `python scripts/scan_repo.py`; the script's shebang is python3 and bare `python` is unreliable on Windows.
- Change the instruction to: try `python3`, fall back to `python`; if neither exists, skip the scan entirely, proceed to the discovery phase, and tell the user the scan was skipped. The scan is an optimization, not a prerequisite.
- Note: the root `codebase-cartographer.skill` zip contains a copy of this file; it gets regenerated in B5, so edit only the plugin-form file here.

### A8. Forward-slash citation rule is unwritten

- `cartographer/plugins/cartographer/scripts/refs.js` line ~29 (`looksLikePath`) only recognizes forward-slash paths, so a doc citing `src\auth\login.ts` is never verified. The behavior is fine; the rule is undocumented.
- Add one line to the doc-authoring guidance (`cartographer/plugins/cartographer/skills/codebase-cartographer/references/satellite_docs.md`, or SKILL.md if there is a clearer authoring-rules section): cited paths must use forward slashes; backslash paths are not machine-verified.

---

## Batch B: small design fixes (decisions baked in; if the code contradicts a premise, stop and flag it)

### B1. The PROMOTION gate has no emitter

- `=== GATE: PROMOTION REQUIRED ===` is defined in SPEC §5 and bindings/AGENTS.md but no command in any repo emits it. ClauDHD is compass-unaware by design and must stay untouched, so the owner is the forwarder.
- File: `compass-rose/plugins/compass/commands/quick.md`. Add an instruction: when an item fails the quick test (needs a design, multiple phases, or a review-worthy diff), or a batch item balloons mid-pass, end the response with exactly `=== GATE: PROMOTION REQUIRED ===` as the final line and point at `/compass:promote` (or `--small`). Match the gate-emission phrasing style used in `compass-rose/plugins/compass/commands/advance.md` lines 26-32.

### B2. Gantry standalone never writes the roadmap tuple

- SPEC §3: "Whatever drives a step writes the new tuple back to the row." compass `advance.md` lines 14-21 does this, but if Gantry drives (`/gantry:run`) in a repo that has a roadmap, the row silently rots.
- File: `gantry/plugins/gantry/skills/gantry/SKILL.md`. After the per-phase commit gate step, add a short paragraph: if the project has a `ROADMAP.md` containing a row for this feature (match by its design or plan path, or by `<!-- id: ... -->`), update the row's `status` / `active_phase` / `phase_state` to match the step just completed, using the same mapping as compass advance (after build: in_progress / N / in_review; after PASS: ready_to_commit; after the human commits: committed then advance, or done if last phase; on FAIL: review_failed). If there is no roadmap or no matching row, skip silently. Keep it to one paragraph; Gantry must not grow a dependency on compass.

### B3. Nothing catches "shipped but row not done"

- The pipeline docs say the roadmap row flips to done when work ships, but the flip only exists as an offer inside compass advance. Run `/claudhd:shipped` standalone and nothing flips, and doctor has no check for the mismatch.
- File: `compass-rose/plugins/compass/scripts/doctor.js`. Add a warn-level check: for each parsed roadmap row whose status is not `done`, if a `SHIPPED.md` exists at the project root and its text contains the row's `id`, its design path, its plan path, or its exact title, report `appears in SHIPPED.md but row is not done`. Substring match is fine; warn-level only, doctor never auto-fixes this one.
- Add a case to `compass-rose/test/doctor.test.js` (fixture with a shipped-but-in_progress row).

### B4. refs.js extracts citations from inside fenced code blocks

- File: `cartographer/plugins/cartographer/scripts/refs.js`. Extraction runs on every line; an example path inside a ``` fence becomes a citation and verify.js flags it as broken. SPEC §2 already establishes the principle that content inside fences is example, not live.
- Track fence state while iterating lines (a line starting with ``` or ~~~ toggles it; honor the optional language tag) and skip extraction inside fences. Inline single-backtick code spans stay extracted; that is the citation syntax.
- Add tests to `cartographer/test/refs.test.js`: a path inside a fence is not extracted; the same path inline in backticks is. Confirm `verify.test.js` and `drift.test.js` still pass, since both consume extractRefs.

### B5. Two sources of truth for the cartographer skill

- Root `cartographer/codebase-cartographer.skill` (a zip) duplicates `cartographer/plugins/cartographer/skills/codebase-cartographer/` with no sync mechanism or canonical note.
- Decision: the plugin-form directory is canonical; the .skill is a generated release artifact.
- First inspect the existing .skill (list the zip contents) to learn its exact internal layout. Then add a small build script (suggested: `cartographer/tools/build-skill.js`, or a documented one-liner using PowerShell `Compress-Archive` if a script adds no value) that regenerates the .skill from the plugin skill directory with the same internal layout. No npm dependencies.
- Regenerate the .skill now (it must pick up the A7 edit). Add two lines to `cartographer/README.md`: which form is canonical, and how to regenerate the artifact.

### B6. claudhd shipped.js writes without the opt-in gate

- File: `ClauDHD/plugins/claudhd/scripts/shipped.js`. checkpoint.js and brief.js both gate on the `<!-- claudhd` marker in NOW.md before acting; shipped.js never reads NOW.md, so in a foreign repo it will create SHIPPED.md or stamp its marker into a pre-existing one.
- Before touching SHIPPED.md, read NOW.md and require the same marker (copy the gating pattern from checkpoint.js, around line 66-71). If missing, print one line ("not a ClauDHD project here; run /claudhd:init first") and exit 0.
- Add a case to `ClauDHD/test/shipped.test.js`.

### B7. Duplicated magic constants in claudhd

- `QUICK_CAP = 3` is defined independently in `quick.js` and `brief.js` (brief.js line ~141 has a "keep in sync" comment admitting it). The 72-hour stale-cursor threshold is hardcoded in `brief.js` line ~153 and documented nowhere.
- Create `ClauDHD/plugins/claudhd/scripts/constants.js` exporting `QUICK_CAP` and `CURSOR_STALE_HOURS`; require it from both scripts; delete the duplicates and the sync comment. Add one line to the README documenting the staleness threshold. Tests must stay green.

### B8. harvest fails silently when transcripts aren't found

- File: `ClauDHD/plugins/claudhd/scripts/harvest.js` (transcript root resolution, line ~32; the "no transcripts found" exit, lines ~62-67).
- Extend the no-transcripts message to say where it looked and that `CLAUDE_CONFIG_DIR` can point it at a non-standard Claude Code data directory. Message only; do not change resolution logic.

### B9. compass locates sibling plugins by fragile cache-walking

- Files: `compass-rose/plugins/compass/scripts/doctor.js` (`loadCartographerFreshness`, lines ~36-55) and `version.js` (`findCacheRoot`).
- Both walk up the tree assuming Claude Code's plugin-cache layout; if it changes, they fall back silently and the failure is undebuggable.
- Add an env override checked before the walk: `COMPASS_PLUGIN_CACHE` (path to the cache root). One comment line each explaining it. Keep the existing fallback behavior untouched.

---

## Batch C: tests and CI

### C1. Gantry has zero tests; the monorepo has zero CI

- Create `gantry/package.json` mirroring the sibling dev packages (private, `"test": "node --test"`, no deps) and a `gantry/test/` directory:
  - `init.test.js`: run `scripts/init.js` against temp-dir fixtures (empty project; a node project with package.json scripts) and assert the scaffolded files and the key output lines. Follow the fixture patterns in `compass-rose/test/doctor.test.js`.
  - `version.test.js`: smoke test that it prints the version from plugin.json.
- The monorepo root (`C:\Users\atk67\Documents\Github`) has no `.github/`. Add `.github/workflows/test.yml` at the MONOREPO root that runs `npm test` in `compass-rose/`, `cartographer/`, and `gantry/`. Mirror `ClauDHD/.github/workflows/test.yml` for the matrix (ubuntu/windows/macos, node 20/22/24). ClauDHD keeps its own CI; do not add one there.
- On the windows leg, set `git config --global core.autocrlf false` before running tests (ClauDHD's test helpers do this per-repo; the monorepo workflow should match). Apply the same line to ClauDHD's workflow if it lacks it.

### C2. compass status.js and init.js are untested

- Add `compass-rose/test/status.test.js` and `compass-rose/test/init.test.js` using the same temp-fixture style as `doctor.test.js`. Cover: artifact detection (which seam files exist), roadmap signals reaching the status output, init's report when instruments' files are present vs absent. Keep them as behavior tests against the exported functions or the CLI output, whichever each script supports.

### C3. The roadmap template has no contract test

- The single most load-bearing cross-repo contract (cartographer's `templates/ROADMAP.md` must parse under compass's roadmap.js) is held together by eyeballing.
- Add a test in `cartographer/test/` asserting the template's example row carries exactly the spec's field names (`status`, `active_phase`, `phase_state`, `lane`, `idea`, `design`, `plan`, `blocked_by`) and the `<!-- id: ... -->` comment format. Hardcode the expected strings in the test; SPEC §2 is the contract, so literals are correct here. (A live cross-repo parse isn't possible in CI since the repos check out separately; the literal contract test is the honest version.)

### C4. checkpoint.js is untested and its parser has a diverged twin

- `ClauDHD/plugins/claudhd/scripts/checkpoint.js` runs on every Stop hook and has no dedicated tests (only indirect coverage via brief.js). Its `activeThread()` has a diverged copy in `idea.js` (lines ~43-58) which additionally requires a `**bold**` line and returns "?" without one.
- Extract a shared helper (suggested: `ClauDHD/plugins/claudhd/scripts/nowfile.js`) with one `activeThread(text)` used by both. Make the bold tag optional: fall back to the first non-empty line of the Active thread section that isn't the "Rule:" line.
- Add `ClauDHD/test/checkpoint.test.js`: happy path; missing NOW.md (exits silently); NOW.md without the claudhd marker (no write); NOW.md missing the Active thread section (breadcrumb still written, with the fallback note); detached HEAD (global breadcrumb written, per-branch skipped).

---

## Out of scope (human decisions, do not attempt)

- compass-rose's own `ROADMAP.md` keeps all its rows inside fenced code blocks, so the repo defining the schema has no live rows. Converting it is editorial work on the owner's prose; leave it.
- Whether drift-scoring the ROADMAP is meaningful long-term (A1 just makes the two scripts consistent, which is the cheap correct move now).

## Done means

- All items A1-A8, B1-B9, C1-C4 applied.
- `npm test` green in compass-rose/, cartographer/, gantry/, ClauDHD/.
- Nothing committed. A per-repo summary of changes, plus any flagged discrepancies, reported back to the human.
