# Compass Rose

A workbench and methodology for AI-assisted development, for [Claude Code](https://claude.com/claude-code).

Compass Rose connects three small Claude Code tools — [Codebase-Cartographer](../cartographer/README.md), [ClauDHD](https://github.com/kidsmeal/ClauDHD), and [Gantry](../gantry/README.md) — into a single idea-to-implementation pipeline, so a feature has one continuous path from a half-formed thought to a reviewed commit. Each tool solves one axis of the problem on its own — *where things are*, *where you are*, and *how work gets built* — but used separately, you move work between them by hand: copy a decision from the map into a plan, remember which plan a cursor refers to, re-check conventions at review time. Compass Rose is the connective layer that does those hand-offs for you, plus the methodology for how a unit of work moves through the three.

The idea is the same one the three tools are built on, applied one level up: rather than trusting yourself (or the model) to remember the process, build the process into the files. Compass Rose adds almost no state of its own. The three tools keep owning their Markdown; Compass Rose wires them so the output of one is the input of the next — the map feeds the plan, the plan registers on the roadmap, the roadmap is what the cursor points at, the cursor advances when a phase ships. It has zero dependencies, runs on local files and ordinary git, makes no network calls of its own, and uses the Node.js runtime Claude Code already bundles.

## The three instruments

Compass Rose does not replace the tools it connects — each stays installable and useful on its own. It assumes all three are present and makes them hand off cleanly.

| Instrument | Axis | Owns | What it provides |
|---|---|---|---|
| [Codebase-Cartographer](../cartographer/README.md) | **Space** — where things are | `docs/INDEX.md`, `GLOSSARY.md`, `CONVENTIONS.md`, `ROADMAP.md`, the CLAUDE.md "Where things are" block | The codebase map, glossary, and conventions |
| [ClauDHD](https://github.com/kidsmeal/ClauDHD) | **Time** — where you are | `NOW.md`, `IDEAS.md`, `SHIPPED.md`, plus the `Stop` / `SessionStart` hooks | The active-thread cursor and cross-session continuity |
| [Gantry](../gantry/README.md) | **Process** — how it gets built | `DESIGN` / `PLAN` docs, four gated subagents, `CURRENTNESS_AUDIT.md`, `RUNTIME_VERIFICATION_QUEUE.md` | The gated design → plan → build → review pipeline |

The three cover space, time, and process. Compass Rose's job is to keep them pointed at the one thing you're working on and to pass a unit of work from each to the next without you doing it by hand.

## What it gives you

- **One pipeline from idea to commit.** A thought captured in `IDEAS.md` has a single, named path to a reviewed commit in `SHIPPED.md`, with a defined step between each artifact instead of a manual hand-off.
- **A roadmap that is the hub.** `ROADMAP.md` stops being a backlog of vague intentions and becomes a registry of thought-through work: each entry links out to *its* design doc and *its* plan, and the cursor reads the active one off it.
- **Three lanes out of triage.** A one-file, one-sitting chore takes ClauDHD's quick lane (`/claudhd:quick`) and skips the conveyor; multi-step work with no open design questions takes the **small-planned** lane (`/compass:promote --small` — short plan + review, no design); anything with design questions or a contract change takes the **full** lane (`/compass:promote` — design → plan → review). One question routes it: does it need a *design*, just a *plan*, or *neither*?
- **Plans grounded in the map.** Gantry's design author and planner read Cartographer's `INDEX.md` and `GLOSSARY.md` first, so a design starts oriented instead of re-deriving the layout.
- **Conventions enforced end to end.** Cartographer *writes* `CONVENTIONS.md`; Gantry's implementer and reviewer treat that exact file as law. Compass Rose makes that handoff explicit, so the rules you documented are the rules the diff is held to.
- **One staleness signal.** Cartographer verifies every path it cites, Gantry's currentness audit reconciles doc claims against the code, and ClauDHD flags a stale cursor and piling-up work. Compass Rose folds the three into a single "is our self-knowledge still true?" read via `/compass:status`.
- **Machine-readable state, and a doctor.** Each roadmap row carries structured state (`status` / `active_phase` / `phase_state`) that `/compass:advance` writes and `/compass:status` reads — commands reason over data, not prose. `/compass:doctor` health-checks the workbench (broken doc links, orphan docs, schema gaps, stale standing docs) and offers to fix the safe ones.

## The pipeline

A unit of work moves left to right. Durability and horizon change as it goes: the inbox is cheap and disposable, the roadmap is durable and medium-term, the design and plan are durable per-feature, and the cursor is volatile working memory that churns every session.

```
IDEAS.md            inbox, raw                     (ClauDHD)     capture, don't think
   │ triage
   ├─ quick lane ──► /claudhd:quick → NOW.md batch   (ClauDHD)     the not-Gantry exit
   ├─ small lane ─► /compass:promote --small          (Gantry)      short plan + review, no design
   │
   └─ full lane
        │ /compass:promote
        DESIGN doc   why + constraints              (Gantry)      grilled out, codebase-grounded
        │ plan
        PLAN doc     how, N phases                  (Gantry)      verifiable, file-scoped
        │ register
        ROADMAP.md ◄─ the hub                       (Cartographer) entry links to its design + plan
        │ activate
        NOW.md       the read-head on the roadmap   (ClauDHD)     active thread + next physical action
        │ build one phase → review the diff → you commit   (Gantry)
        SHIPPED.md   what happened                  (ClauDHD)     the kept record
```

1. **Capture.** `/claudhd:idea <text>` drops a thought into `IDEAS.md` in one line. Capture is dumb on purpose — you keep working.
2. **Triage into a lane.** `/claudhd:triage` clears the inbox into one of three lanes — the test is: does it need a *design*, just a *plan*, or *neither*? **Neither** (one file, one sitting) → `/claudhd:quick`, a capped batch in `NOW.md` cleared in one focused pass (ClauDHD-native). **Just a plan** (multi-step, no design questions) → `/compass:promote --small`. **A design** → the **full lane**, `/compass:promote`.
3. **Design (full lane).** `/compass:promote` hands a promoted idea to Gantry's design author, which grills you through the open decisions — grounded in the map — and writes a design doc. It surfaces unmade decisions rather than guessing them.
4. **Plan.** `/gantry:plan` turns the finalized design into four-to-seven verifiable phases, each with a file list, a verification step, and exit criteria.
5. **Register on the roadmap.** Each piece of work is a row in `ROADMAP.md`. A row can start as a bare *named intent* — what it delivers, nothing designed yet — and pick up its *finished blueprints* (links to the design and the plan) whenever you design it. Going straight through the steps above attaches both at once; registering the intent first and designing it later, when you activate it, works just as well. The roadmap holds named intents for everything ahead and blueprints for whatever you've designed so far — design as far ahead as you like.
6. **Activate.** The active roadmap entry becomes the one thread in `NOW.md`, expanded to the next physical action. There is still only one cursor; it just points at a roadmap row. If that row is still a bare named intent, activating it designs and plans it first — `/compass:advance` notices the missing design and runs promote, then stops for you.
7. **Build, review, commit.** Gantry builds exactly one phase tests-first, reviews the uncommitted diff against the plan and conventions, and stops. You hold the commit. Then the cursor advances to the next phase, or the next roadmap entry.
8. **Record.** `/claudhd:shipped` logs the committed work to `SHIPPED.md`, the roadmap row flips to done, and the trail back — shipped commit → phase → plan → design → roadmap row → original idea — stays walkable.

## The document spine

Compass Rose assumes a single doc-lifecycle taxonomy and assigns each file one job. Keep these distinct and the whole thing stays legible.

| Document | Says | Horizon | Owned by |
|---|---|---|---|
| `IDEAS.md` | what *might* be worth doing | someday | ClauDHD |
| `ROADMAP.md` | what's next, and what's in motion | weeks–months | Cartographer |
| `DESIGN` doc | *why*, and under what constraints | per feature | Gantry |
| `PLAN` doc | *how* — the ordered phases | per feature | Gantry |
| `NOW.md` | where you are right now | this session | ClauDHD |
| `SHIPPED.md` | what happened | archive | ClauDHD |
| `INDEX` / `GLOSSARY` / `CONVENTIONS` / CLAUDE.md | the standing facts | durable | Cartographer |
| `CURRENTNESS_AUDIT` / `RUNTIME_VERIFICATION_QUEUE` | what is actually true *now* | living | Gantry |

## What the connector actually does

The three tools do the heavy lifting. Compass Rose's own job is the seams — the four or five places where one tool's output should become another's input, which today you wire by hand.

- **Map → plan.** Before Gantry's design author and planner reason about a feature, Compass Rose points them at `docs/INDEX.md` and `docs/GLOSSARY.md`, so the plan is grounded in the real layout rather than re-discovered each time.
- **Conventions → gate.** Compass Rose records the path to the `CONVENTIONS.md` Cartographer wrote and hands it to Gantry's implementer and reviewer as the law for naming, structure, and anti-patterns — closing the loop between the rules you document and the diff you ship.
- **Plan → roadmap → cursor.** When a design and plan are finalized, Compass Rose registers a roadmap row that links to both, and the active row is what `NOW.md` points at. The row carries structured state (`status` / `active_phase` / `phase_state`) as the single source of truth — `/compass:advance` writes it at each step; `/compass:status` and `/compass:doctor` read it. The roadmap is the load-bearing hub; the cursor is just the read-head positioned on it.
- **Three lanes out of triage.** The **quick** lane is ClauDHD-native: `/claudhd:quick` manages a capped (3) batch in `NOW.md` — overflow forces a decision, a fix that balloons is kicked back to `IDEAS.md`. Compass Rose owns the other two: the **small-planned** lane (`/compass:promote --small` — a short plan + review, no design, `lane: small` on the row) for multi-step work with no design questions, and the **full** lane (`/compass:promote` — design → plan → review) for anything with real design questions. One question routes it — design, just a plan, or neither — so you stop deciding ad hoc.
- **Three freshness checks → one brief.** Path verification, the currentness audit, and the drift flags are folded into a single staleness read, surfaced on demand via `/compass:status`.
- **Unmistakable human gates.** Every control-flow command ends in one greppable gate label — `=== GATE: COMMIT REQUIRED ===`, `REVIEW FAILED`, `HUMAN DECISION REQUIRED`, `BLOCKED`, or `SAFE TO ADVANCE` — so the next required action is never buried in prose.

## Quick Start

### 1. Add the marketplace

```
git clone https://github.com/kidsmeal/public.git
/plugin marketplace add public/compass-rose
```

### 2. Install — the whole bundle, or à la carte

```
# Everything: the connector plus its three dependencies (Cartographer, ClauDHD, Gantry)
/plugin install compass@compass-rose

# ...or just the pieces you want
/plugin install cartographer@compass-rose
/plugin install claudhd@compass-rose
/plugin install gantry@compass-rose
```

Installing `compass` pulls in the other three automatically — they are declared as its dependencies. The marketplace is `compass-rose`; the connector plugin is `compass`, so its commands are `/compass:*`.

The three are **also published in their own marketplaces**, if you'd rather track them independently: `claudhd@claudhd` ([kidsmeal/ClauDHD](https://github.com/kidsmeal/ClauDHD)), and `gantry@gantry` / `cartographer@cartographer` (both in this repo). Cartographer is additionally available as a single-file skill — see [its README](../cartographer/README.md).

If you install during an existing session, run `/reload-plugins` to activate everything. No restart is needed.

### 3. Verify

```
/compass:version
```

You should see a line like `Compass Rose v0.1.0`, plus a best-effort check that the three instruments are present — it names any it can't find and how to install them. The authoritative, per-project check happens at `/compass:init`.

### 4. Initialize a project

```
/compass:init
```

This bootstraps the whole workbench in the right order: Cartographer maps the repo and writes `INDEX` / `GLOSSARY` / `CONVENTIONS` / the CLAUDE.md block, you build the `ROADMAP.md` together, ClauDHD drops the `NOW` / `IDEAS` / `SHIPPED` cursor (with its native quick-fixes lane), and Gantry scaffolds its audit docs and detects your test and build commands. `/compass:init` then reports where each instrument stands and the seam files the connector commands will read (the map index, the conventions file, the roadmap) — convention over config, so there is no wiring file to maintain. One command to check the whole workbench; silent in any repo you have not initialized.

## Commands

Compass Rose adds only the connective commands. The day-to-day verbs are still the three tools' own (`/claudhd:*`, `/gantry:*`, and Cartographer's plain-language triggers).

| Command | What it does |
|---|---|
| `/compass:init` | Bootstrap the workbench: initialize the three instruments in order and wire the seams. |
| `/compass:status` | The unified brief — active thread, roadmap horizon, where you are in the pipeline, and one staleness read across all three tools. |
| `/compass:doctor` | Health-check the workbench — broken doc links, orphan/missing docs, roadmap schema gaps, stale standing docs — and offer to fix the safe ones. |
| `/compass:promote [--small]` | Take a triaged idea down the **full lane** (design → plan → review), or with `--small` the **small-planned lane** (plan → review, no design); register it on the roadmap. |
| `/compass:quick` | Pointer to ClauDHD's native quick-fixes lane — forwards to `/claudhd:quick` (add a chore, or clear the batch). |
| `/compass:advance` | Drive the active roadmap entry's next gated step (design → plan → build → review) and move the cursor when a phase ships. Stops at your decisions and commits. |
| `/compass:version` | Print the version and best-effort confirm the three instruments are installed. |

## What runs automatically

ClauDHD's `Stop` checkpoint (a pure local script, zero tokens) and its `SessionStart` brief keep running untouched — the breadcrumb is never more than one turn behind. Compass Rose adds its own `SessionStart` hook on top: at most two lines, only when a compass project is open. Line 1 is the active feature's position tuple (`status / active_phase / phase_state`). Line 2, if warranted, is one signal — blocked rows, open lint warnings, or a stale roadmap. Both hooks fire on session start; their outputs are complementary (continuity from ClauDHD, position from Compass Rose) and do not overlap. Dead silent in any repo that has no compass-managed roadmap.

## Status

Young but real. Built: the connective commands (`/compass:init`, `:status`, `:promote` + `--small`, `:advance`, `:quick`, `:doctor`, `:version`), the machine-readable roadmap-row schema + parser, the three lanes, the gate-label convention, and the doc-freshness engine (`verify.js` / `drift.js`, wired into `doctor`) — covered by a zero-dependency test suite (`npm test`).

- **[SPEC.md](SPEC.md)** — the tool-agnostic contract: spine, row schema, state machine, lanes, gates, freshness.
- **[bindings/AGENTS.md](bindings/AGENTS.md)** — run the methodology under Codex / Cursor / any `AGENTS.md` agent.
- **[examples/walkthrough.md](examples/walkthrough.md)** — one feature traced through every artifact.
- **[ROADMAP.md](ROADMAP.md)** — the full plan, design principles, and what's still open.

## The methodology

The tools are how; this is why. Compass Rose is an opinionated way of working, and the constraints are the point.

- **Discipline lives in the files, not in willpower.** Every gate, cursor, and audit is a Markdown file plus git, so the process survives a closed tab, a cold session, and a switched branch.
- **One cursor, one focus.** There is always exactly one active thread. The roadmap can hold many intents; only one is live. The quick-fixes lane exists precisely so small work does not become a second cursor.
- **Nothing reaches a commit unreviewed, and nothing commits itself.** Gantry's gates are hard stops, and the human holds every commit. Stopping mid-build always lands on a clean, reviewable boundary.
- **Design whenever, register everything.** The roadmap names what is coming; design as far ahead as ideas take you — the one-at-a-time discipline is on building, not on thinking.
- **Honest over tidy.** The audits correct the record rather than reorganize it, and the freshness check assumes docs rot and looks for it.

## Non-goals

- **Not a replacement for the three tools.** Compass Rose orchestrates them; it does not reimplement them. Each stays usable on its own, and you can adopt the pipeline incrementally.
- **Not a monolith.** It is wiring and method, deliberately thin. The tools keep owning their files; pull Compass Rose out and the three still work.
- **Not an autopilot.** The gates and the single cursor remain. It removes the manual hand-offs between stages, not the decisions and commits that are yours.
- **Not a cross-repo workspace.** It inherits ClauDHD's per-repo scope: one workbench per repo, scoped to the work you do there. A feature spanning several repos gets one Compass Rose per repo.

## Requirements

- Claude Code (provides Node).
- git, for the cursor, the audits, and the shipped log.
- The three instruments installed: [Codebase-Cartographer](../cartographer/README.md), [ClauDHD](https://github.com/kidsmeal/ClauDHD), and [Gantry](../gantry/README.md).

## License

MIT. See [LICENSE](LICENSE).
