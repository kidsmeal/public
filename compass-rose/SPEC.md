# Compass Rose — specification

The tool-agnostic contract behind Compass Rose. The Claude Code commands (`/compass:*`, `/claudhd:*`, `/gantry:*`) are *one* binding of this spec; anything in here can be followed by a human or by another agent harness (see [bindings/](bindings/)). The pieces are plain Markdown files plus a few zero-dependency scripts — no service, no database, no lock-in.

## 1. The document spine

A unit of work flows through files, each with one job and one owner. Keep them distinct and the system stays legible.

| Document | Says | Horizon | Owner |
|---|---|---|---|
| `IDEAS.md` | what *might* be worth doing | someday | cursor (ClauDHD) |
| `ROADMAP.md` | what's next and what's in motion — the hub | weeks–months | map (Cartographer) |
| design doc | *why*, and under what constraints | per feature | pipeline (Gantry) |
| plan doc | *how* — the ordered phases | per feature | pipeline (Gantry) |
| `NOW.md` | where you are right now | this session | cursor (ClauDHD) |
| `SHIPPED.md` | what happened | archive | cursor (ClauDHD) |
| `docs/INDEX.md` + `GLOSSARY` / `CONVENTIONS` / the CLAUDE.md "where things are" block | the standing facts | durable | map (Cartographer) |
| `CURRENTNESS_AUDIT` / `RUNTIME_VERIFICATION_QUEUE` | what is actually true *now* | living | pipeline (Gantry) |

**One source of truth:** a fact lives in exactly one file; everything else links to it. The roadmap row is the single source of truth for a feature's *state*; the plan and `NOW.md` reference it by `id`, they do not copy it.

## 2. The roadmap-row schema

The roadmap is the hub. Each row is structured enough for a program to reason over, still plain enough to hand-edit:

```md
- [ ] Feature name  <!-- id: short-kebab-id -->
  - status: planned
  - active_phase: 0
  - phase_state: —
  - lane: full
  - idea: IDEAS.md "the original one-liner"
  - design: docs/designs/<id>.md
  - plan: docs/plans/<id>-plan.md
  - blocked_by: —
```

- Fields are `- key: value` sub-bullets under a `- [ ] name` row carrying an `<!-- id: ... -->` marker.
- `—`, `-`, `none`, `n/a`, empty all mean "no value".
- **Graceful degradation:** a roadmap with no fields still parses as a list of named intents; consumers fall back to prose. The schema is an optimization, never a prerequisite.
- Rows inside fenced code blocks are examples, not live state — skip them.

## 3. The state machine

A feature's state is the tuple **(`status`, `active_phase`, `phase_state`)**:

```
idea → designing → designed → planning → planned → in_progress → done   (or: blocked)
                                              │
                                        (per active phase, when in_progress)
                                building → in_review → ready_to_commit → committed
                                              └── review_failed ──┘ (back to building)
```

- `status`: `idea | designing | designed | planning | planned | in_progress | blocked | done`
- `phase_state` (only while `in_progress`): `building | in_review | review_failed | ready_to_commit | committed`
- Whatever drives a step **writes the new tuple back to the row**, so the marker self-freshens rather than relying on memory.

## 4. The three lanes

Triage routes each promoted idea by one question — does it need a *design*, just a *plan*, or *neither*?

| Lane | When | Artifacts | `lane:` |
|---|---|---|---|
| **quick** | one file, one sitting, no review-worthy diff | a capped batch in `NOW.md` (cap 3) | — (not a roadmap row) |
| **small-planned** | multi-step / multi-file, **no** open design questions | a short plan + review, **no** design | `small` |
| **full** | open design questions, a contract change, real ambiguity | design → plan → review | `full` |

A quick fix that balloons, or a small-lane item that surfaces a design question, is kicked back up a lane rather than forced through.

## 5. Gate labels

Every control-flow step ends with exactly one greppable line, so the next required human action is never buried:

```
=== GATE: HUMAN DECISION REQUIRED ===   an unresolved decision blocks progress
=== GATE: COMMIT REQUIRED ===           a reviewed phase is yours to commit
=== GATE: PROMOTION REQUIRED ===        a quick fix outgrew its lane
=== GATE: REVIEW FAILED ===             findings to fix before commit
=== GATE: BLOCKED ===                   waiting on something external
=== GATE: SAFE TO ADVANCE ===           clear to continue
```

The human holds every commit; nothing advances, commits, or resolves ambiguity on its own.

## 6. The freshness contract

Standing docs rot when code outruns them. Four mechanisms keep them honest:

- **Checkable claims.** Docs cite exact paths and `#anchors` (not prose), so a verifier can mechanically confirm they still resolve.
- **Diff-impact at review.** The reviewer, holding the uncommitted diff, flags which standing docs the change just invalidated — staleness caught within one phase of being introduced.
- **Drift scoring.** Per standing doc, count commits to the files it cites since the doc was last updated; a high count means it probably lags.
- **Refresh, don't hand-maintain.** Treat the map as a build artifact: regenerate the parts a check flags, leave the rest.

## 7. The deterministic engine (the portable core)

These scripts are plain Node/Python with **no Claude dependency** — runnable by any agent or by CI. They are what makes a non-Claude binding thin:

| Script | Does | From |
|---|---|---|
| `roadmap.js` | parse/validate the row schema, find the active feature, lint | compass |
| `status.js` | gather repo + roadmap signals for the reorientation brief | compass |
| `doctor.js` | integrity + staleness report (read-only) | compass |
| `verify.js` | check every cited path/anchor still resolves | cartographer |
| `drift.js` | per-doc git drift score | cartographer |
| `scan_repo.py` | repo inventory for the first map pass | cartographer |
| `checkpoint.js` / `brief.js` | per-turn breadcrumb / session brief | claudhd |

The model-driven parts (grilling out a design, judging a diff, narrating the brief) are prompts; everything mechanical is a script.

## 8. Principles

1. One authoritative place per fact.
2. Living docs (cursor, roadmap row) update as a step in the loop; standing docs (map) need refresh — keep churny detail out of them.
3. Automatic over disciplined: prefer hooks/scripts over steps that rely on willpower.
4. Catch staleness at the diff, not in a later audit.
5. Coarse over exhaustive — write the slow-changing structure.
6. Machine-readable where commands reason; human-readable always.
7. Human gates unmistakable.
8. Each tool owns its axis; the connector wires, it doesn't absorb.
9. Ceremony proportional to the work — don't become the drift.

## 9. Bindings

- **Claude Code** (reference binding): the `/compass:*`, `/claudhd:*`, `/gantry:*` commands, the `Stop`/`SessionStart` hooks, and the four Gantry subagents. Install per the [README](README.md).
- **Codex / generic agents:** [bindings/AGENTS.md](bindings/AGENTS.md) — a drop-in instructions file that maps this spec onto any harness that reads `AGENTS.md` and can run shell + the scripts above.

See [examples/walkthrough.md](examples/walkthrough.md) for one feature traced through every artifact.
