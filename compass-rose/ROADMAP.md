# Compass Rose — Improvement Plan

The development roadmap for the suite itself. It synthesizes three things: an honest read of where Compass Rose actually earns its keep (context *quality* and continuity, not raw token savings), what a **solo developer** structurally lacks that the suite stands in for (a teammate's memory, a reviewer, shared docs, a process enforcer), and a concrete attack on the one failure mode that can quietly poison all of it — **staleness**.

It is organized as: **design principles** (the spine every change must respect) → **the state model** (the foundation most other work sits on) → **five workstreams** with concrete specs → **Now / Next / Later** sequencing → **non-goals & success criteria**.

> Per the suite's own taxonomy this roadmap is the *hub*: heavy items link out to a design doc rather than carrying their full design here. Items marked **[needs design]** should spin out before they're built.

---

## Design principles

Every change below is justified against these. If a proposed feature violates one, it's probably wrong.

1. **One authoritative place per fact.** A fact stored in two files is a fact that will disagree with itself. State lives in exactly one location; everything else *references* it. This is the anti-staleness rule applied to our own schema.
2. **Living vs. standing docs.** A *living* doc (NOW, SHIPPED, the roadmap row) is updated as a step in the loop, so it never goes stale by construction. A *standing* doc (INDEX, GLOSSARY, CONVENTIONS) describes slow-changing structure and rots when code outruns it. Know which you're writing; push churny detail into living docs and out of standing ones.
3. **Automatic over disciplined.** Solo developers skip manual steps. Favor hooks and scripts that run without being remembered (the `Stop` checkpoint) over commands that rely on willpower. Where a command must be manual, make *not* running it visible (a drift flag).
4. **Catch staleness at the diff, not in a later audit.** The pipeline produces a diff at the exact moment a change is introduced. That is the cheapest possible place to detect that a standing doc just became wrong — you already have the change in hand.
5. **Coarse over exhaustive.** Staleness resistance is a writing choice. A map that says "auth lives in `src/auth/`, flow is X→Y→Z" survives months; one that lists every file rots in a day.
6. **Machine-readable where commands reason; human-readable always.** Add just enough structure that commands stop guessing from prose — never so much that a human can't read or hand-edit the file.
7. **Human gates unmistakable.** The AI must never silently advance, commit, or resolve ambiguity. Every command ends in one explicit, greppable gate label.
8. **Tool-agnostic core, thin bindings.** The methodology, the file formats, and the deterministic scripts are portable. Only the command/hook wrappers are Claude-native. Keep that seam clean so a Codex binding is a thin layer, not a rewrite.
9. **Ceremony proportional to the work.** The tool that fights drift must not *become* the drift. Every addition has to reduce friction on the common path, not add a new doc to maintain. When in doubt, fewer gates.

---

## The state model (foundational)

Today `/compass:advance` infers progress by interpreting `NOW.md`, roadmap prose, plan contents, and git state. That puts correctness at the mercy of prose interpretation. The fix is a small, explicit state machine with **one authoritative home: the roadmap row.**

### State machine

```
idea → designing → designed → planning → planned → in_progress → done
                                                        │
                                                  (per active phase)
                                          building → in_review → ready_to_commit → committed
                                                        │
                                                  review_failed ─┐ (back to building)
   any state ───────────────────────────────────────────────────── blocked
```

A feature's state is the tuple **(`status`, `active_phase`, `phase_state`)**:

- `status`: `idea | designing | designed | planning | planned | in_progress | blocked | done`
- `active_phase`: integer, meaningful only when `in_progress`
- `phase_state`: `building | in_review | review_failed | ready_to_commit | committed`, meaningful only when `in_progress`

`/compass:advance` **reads** the tuple to decide the next gated step and **writes** the new tuple after each step — so the marker is a *living* field (principle 2), kept fresh by the loop rather than by discipline.

### Roadmap row schema (the hub)

The roadmap row is the single source of truth for a feature's state and its links. Still Markdown, still hand-editable, but with a fixed key set commands can parse:

```md
- [ ] Feature name  <!-- id: short-kebab-id -->
  - status: planned
  - active_phase: 0
  - phase_state: —
  - idea: IDEAS.md "the original one-liner"
  - design: docs/designs/<id>.md
  - plan: docs/plans/<id>-plan.md
  - blocked_by: —
```

**Single-source rule (principle 1):** `status` / `active_phase` / `phase_state` live *only* here. The plan's frontmatter carries only a back-pointer `roadmap_id: <id>` — never its own status copy. `NOW.md`'s active thread carries the `roadmap_id` of the active row, not a duplicated state. Resolve the state by reading the row; everything else points at it.

**Graceful degradation (principle 6):** if the fields are absent (a hand-written roadmap, or pre-migration), commands fall back to today's prose interpretation. The schema is an optimization, not a hard dependency.

---

## Workstream A — Machine-readable state & unmistakable gates *(foundation)*

*Ideas 1, 2, 6, 10. Unblocks B and C.*

- **A1. Ship the state model + roadmap-row schema** above as a `compass` convention, with a parser in `status.js`/`doctor` and graceful prose fallback. **[needs design]** (the parser + migration of an existing roadmap).
- **A2. `advance` writes transitions.** Each gated step updates the row's `(status, active_phase, phase_state)` so the marker self-freshens. This is the linchpin that makes A worth doing.
- **A3. Gate-label convention (idea 10).** Every `compass`/`gantry` command ends with exactly one greppable line:
  ```
  === GATE: HUMAN DECISION REQUIRED ===
  === GATE: COMMIT REQUIRED ===
  === GATE: PROMOTION REQUIRED ===
  === GATE: REVIEW FAILED ===
  === GATE: BLOCKED ===
  === GATE: SAFE TO ADVANCE ===
  ```
  Unambiguous when you're tired, and machine-detectable so `status`/`doctor` can report "the last gate was X."
- **A4. Artifact templates (idea 6).** Centralize what's missing and reference what exists. New: `roadmap-row`, `shipped-entry`, the small-plan (see D). Existing (link, don't duplicate): Gantry's `DESIGN`/`PLAN`/`CURRENTNESS_AUDIT`/`RUNTIME_VERIFICATION_QUEUE`, ClauDHD's `NOW`/`IDEAS`/`SHIPPED`. Make `cartographer` emit `ROADMAP.md` in the row schema.

*Acceptance:* `advance` never misreads state in dogfooding; every command output ends in exactly one gate label; a fresh project's roadmap uses the schema out of the box.

---

## Workstream B — Operational commands *(the "trust it operationally" layer)*

*Ideas 3, 4. The user's top priorities. Built on A's structured state.*

- **B1. `/compass:status` v2 (idea 3) — the reorientation brief.** It must answer five questions on one screen, gathered cheaply by script and narrated thinly (the `brief.js` pattern — data in Node, model only narrates):
  1. **What am I doing?** active thread + its roadmap row.
  2. **What's the next physical action?** the single next step from the cursor / `advance`'s read of `phase_state`.
  3. **What's stale?** the staleness read from Workstream C.
  4. **What's blocking me?** rows with `status: blocked`, unresolved `[NEEDS USER DECISION]`, a `REVIEW FAILED` gate.
  5. **What's safe to ignore?** `done` rows, the parked/quick batches.
  Ends in a gate label. If this is genuinely great, the suite earns its keep every session.
- **B2. `/compass:doctor` (idea 4) — integrity + self-healing.** A read-only check (with opt-in `--fix`) over the whole workbench. Checks, grouped by severity:
  - *Integrity:* roadmap rows missing `design`/`plan` when `status ≥ planned`; plans/designs orphaned (not linked from any row); `NOW.md` pointing at a `done` or non-existent row; `phase_state: committed` but git shows the phase's files uncommitted (or the reverse); committed phases absent from `SHIPPED.md`; designs with unresolved `[NEEDS USER DECISION]`.
  - *Staleness* (Workstream C): standing docs older than the code they describe; cited paths/symbols that no longer exist; a currentness audit not reconciled since N commits; runtime-verification entries past their "close when."
  - `--fix` auto-applies only the *safe* ones: log shipped phases, re-link an orphan plan, advance a stale `status` marker, regenerate the map. Everything judgmental stays a flag.
  This turns the methodology from self-*documenting* into self-*healing*.

*Acceptance:* `status` answers all five questions in one screen, cheaply, every session; `doctor` catches each listed class and auto-fixes the safe subset.

---

## Workstream C — Staleness as a first-class signal *(the core conceptual addition)*

*Extends idea 4's "stale currentness audit" into a real engine. The pipeline constantly changes files — so it is the ideal place to detect, at the source, when a standing doc just became wrong (principles 2 & 4).*

- **C1. Diff-impact signal (highest leverage).** Gantry's `phase-reviewer` already reads every uncommitted diff. Extend it to emit a **Docs impact** section: scan the diff for moved/renamed/added/deleted paths and symbols that appear in `INDEX`/`GLOSSARY`/`CONVENTIONS`, and list which standing docs the change just invalidated. `advance`/`doctor`/`status` surface it. Staleness gets flagged **within one phase of being introduced**, using the diff that's already in hand. **[needs design]** (lives in the `gantry` repo; `compass` consumes it).
- **C2. git-timestamp drift scoring.** A small script: for each standing doc (or each map section, when the map is split), count commits to the paths it describes since the doc's own last-touched commit. High count → "probably stale," flagged per-section. Mechanical, cheap, no file reading. Consumed by `status` (Q3) and `doctor`.
- **C3. Checkable claims.** Extend `cartographer`'s existing "verify every cited path exists" to also verify cited *anchors/symbols*, and bias the generated docs toward path/symbol references over prose. The more a doc asserts things the filesystem/git can falsify, the more rot becomes a failing check instead of a silent lie.
- **C4. Regenerate, don't maintain.** Treat the map as a **build artifact**. Give `cartographer` an incremental `--refresh` mode; have `doctor` recommend regeneration when the drift score is high. The solo-realistic answer to rot is cheap rebuild at natural checkpoints, not hand-maintenance that never happens.
- **C5. Codify living-vs-standing.** Bake principle 2 into `cartographer`'s guidance and `compass:init`: which docs are auto-fresh vs. need refresh, and the rule to keep high-churn detail out of standing docs.

*Acceptance:* a rename that invalidates the map is flagged at the next phase review, not discovered weeks later; `status` always has an honest "what's stale" line.

---

## Workstream D — Right-size the workflow *(reduce ceremony, fit reality)*

*Ideas 5, 8. A lot of real work is bigger than a quick fix but smaller than a full design.*

- **D1. A middle lane — "small planned change" (idea 8).** Between the quick lane and the full Gantry lane: **design skipped, short plan required, review required, still linked to roadmap/NOW.** Triggered by `/compass:promote --small` (or `/compass:plan-small`). The triage decision function becomes explicit:
  - open design questions / public-contract change / real ambiguity → **full lane**
  - multi-file or ordered steps, but no design questions → **small-planned lane**
  - one file, one sitting, no verification risk → **quick lane**
- **D2. Quick-fix hard limits (idea 5).** Tighten the lane so it can't become avoidance:
  - cap at **3** (lower the current 5; expose as a `userConfig` so it's tunable). `quick.js` already enforces a cap — change the default and surface it.
  - **1 file per item**, no schema/API/public-contract change, no broad refactor — enforced at *clear* time in `quick.md`, and caught by the phase-reviewer if one sneaks into a diff. (Be honest: a script can't judge "is this a refactor"; the gate is the clear-pass rule plus review.)
  - any failed verification **promotes** the item to the small or full lane rather than lingering.

*Acceptance:* the lane decision is a stated rule, not an ad-hoc call; "quick" stays small and self-contained; mid-size work has a home that isn't a full design doc.

---

## Workstream E — Portability & evidence *(reach and adoption)*

*Ideas 7, 9.*

- **E1. Extract the tool-agnostic spec (idea 7).** Pull the methodology, file formats, state model, gate labels, and lane rules into a `SPEC.md` any agent can follow. Crucial enabler already true: the deterministic engine (`checkpoint.js`, `brief.js`, `status.js`, the planned `doctor`/drift scripts, `scan_repo.py`) is **plain Node/Python with no Claude dependency** — it's the portable core. Only the `.md` command wrappers and hooks are Claude-native.
- **E2. A Codex / generic-agent binding (idea 7).** Map the workflow onto: `AGENTS.md` as the conventions/instructions carrier, the existing scripts run directly (or from CI), a "review mode" mapping for the gate, and the same Markdown files (NOW/SHIPPED/roadmap) for continuity — optionally an MCP/thread tool where a host supports it. A binding, not a fork.
- **E3. A worked example (idea 9).** Ship `examples/walkthrough.md`: one fictional feature traced through every artifact — raw idea → design → plan → roadmap row → NOW cursor → a phase build → a phase review that finds something → shipped log — with the real file contents at each step. Doubles as the canonical live example of the schemas, and lets a reader decide whether the ceremony is worth it before adopting.

*Acceptance:* the engine runs headless so a non-Claude binding is thin; a newcomer can read one walkthrough and understand the whole loop.

---

## Now / Next / Later

Sequenced by dependency and leverage, written in the proposed row schema as a live dogfood of Workstream A.

```md
## Now
- [ ] Foundation: state model + roadmap-row schema + gate labels + templates  <!-- id: foundation -->
  - status: planned
  - active_phase: 0
  - design: (this file, "The state model" + Workstream A)
  - plan: —
  - blocked_by: —

## Next
- [ ] /compass:status v2 — the five-question reorientation brief  <!-- id: status-v2 -->
  - status: designed
  - design: (Workstream B1)
  - blocked_by: foundation
- [ ] /compass:doctor — integrity + self-healing checks  <!-- id: doctor -->
  - status: designed
  - design: (Workstream B2)
  - blocked_by: foundation

## Later
- [ ] Staleness engine: diff-impact signal + drift scoring  <!-- id: staleness -->
  - status: designing
  - design: (Workstream C — needs its own doc)
  - blocked_by: doctor, status-v2
- [ ] Middle lane + quick-fix hard limits  <!-- id: lanes -->
  - status: designed
  - design: (Workstream D)
  - blocked_by: foundation
- [ ] Tool-agnostic SPEC + Codex binding + worked example  <!-- id: portability -->
  - status: designing
  - design: (Workstream E — needs its own doc)
  - blocked_by: lanes
```

**Rationale for the order:** A is foundational — B and C are far more reliable once state is structured rather than inferred. B is the user's top-three and the most-felt daily value, so it comes right after the foundation. C is the highest *conceptual* win but leans on B's surfaces (`status`/`doctor`) to be visible, so it follows. D can slot in anytime after A; it's independent quality-of-life. E is last because it should freeze a stable core before binding a second tool to it.

---

## Non-goals & risks

- **No database, no index server, no daemon.** Stay Markdown + git + local scripts. Legibility and zero-lock-in are the whole point; a stale file you can open and fix beats an opaque cache.
- **Schema must degrade gracefully.** Every command keeps working on a hand-written, schema-less doc. Structure is an optimization, never a prerequisite.
- **`status`/`doctor` must stay cheap.** Data-gathering in Node, model only narrates (the `brief.js` discipline). If these grow into heavy model passes, they cost more than they save.
- **Don't become the drift.** The biggest risk for the solo/ADHD audience: polishing the roadmap instead of shipping. Every addition must *remove* friction from the common path. Prefer automatic (hooks, `advance` writing state) over one more manual chore.
- **One source of truth, always.** No fact stored in two files. This is the rule we're adding the schema to enforce; we must not violate it while building the schema.

## Success criteria

- `advance` reads state from the structured marker, never misattributing the step (zero wrong-step advances in dogfooding).
- `status` answers all five questions in one screen, cheaply, every session.
- `doctor` catches each listed integrity/staleness class and auto-fixes the safe subset.
- A standing-doc invalidation is flagged within one phase of being introduced, not discovered later.
- The deterministic engine runs headless, so a Codex/CI binding is a thin layer.
- The common path has *fewer* manual steps after these changes than before — net friction goes down, not up.
