---
name: codebase-cartographer
description: >-
  Design and generate a codebase's organizational documentation system so an unfamiliar
  repo becomes navigable for AI agents and new contributors. Produces an extremely detailed
  codebase map (an INDEX of every entry point, module, subsystem, data flow, and where each
  thing lives), a "Where things are" block wired into CLAUDE.md, plus a domain GLOSSARY, a
  ROADMAP of active work, and a CONVENTIONS guide. Use whenever the user wants to map, index,
  or document a codebase's layout — "map this codebase", "create a codebase map / architecture
  index", "document where things are", "set up CLAUDE.md so agents know the layout", "design
  our org/doc system", "I inherited this repo and don't know where anything is". Trigger even
  when only one artifact is named ("just the codebase map"). Not for: API/endpoint reference
  docs, inline docstring/JSDoc comments, a docs website (Docusaurus), a CONTRIBUTING/process
  doc, a product/feature roadmap, an end-user content glossary, or a one-off "where is this
  function" lookup.
---

# Codebase Cartographer

You are building a **navigation layer** for a codebase: a small set of documents that let an
AI agent or a new human contributor walk into an unfamiliar repo and immediately know where
everything is and how it fits together. The centerpiece is an **extremely detailed codebase
map**; the other documents orbit it.

These documents earn their keep because they are read far more often than they are written —
and increasingly the reader is an AI agent starting from a cold context window, with no memory
of the repo and a fixed token budget. Without a map, finding anything means re-exploring:
globbing, grepping, opening the wrong files, re-deriving the structure on every task — and
every one of those steps burns context. The navigation layer exists to replace that repeated
search with a cheap lookup: front-load the structure once so each future reader loads the
handful of tokens it takes to find an answer, not the whole codebase. That efficiency comes
from organization — progressive disclosure, one fact in one place, precise pointers — not from
clever tooling.

The payoff only holds if the docs are *true*. A map with dead links or confident-but-wrong
descriptions is worse than none, because the reader pays twice — once to trust it, again to
recover when it misleads — and learns to distrust the whole file. So the prime directive is:
**map the reality of the code as it exists right now, and verify every claim against the actual
files.**

## What you produce

The default doc set (the user may narrow it):

| Doc | Filename (default) | Role |
|---|---|---|
| **Codebase map** | `docs/INDEX.md` | The centerpiece. Entry points, every significant module/subsystem with its key files, data flow, the golden path, build/run/test. |
| **Glossary** | `docs/GLOSSARY.md` | Domain & project-specific terms, acronyms, ubiquitous language. Disambiguates words that mean something special here. |
| **Roadmap** | `docs/ROADMAP.md` | Active work, next up, blocked, recently shipped. The "what's the state of play" doc. |
| **Conventions** | `docs/CONVENTIONS.md` | Naming, directory layout, architectural rules, idioms actually in use, and anti-patterns. (This is the file other repos sometimes call AGENTS.md — give it this clearer, purpose-named filename.) |
| **Navigation block** | `CLAUDE.md` (a section) | A short "Where things are" pointer table at the top of CLAUDE.md linking to all of the above, plus critical gotchas. |

`CONVENTIONS.md` is **not** named `AGENTS.md` — a generic name like AGENTS.md hides its purpose; `CONVENTIONS.md` says what it holds.

## Operating principles

These shape every decision below — internalize them, don't just skim.

- **Map reality, not intentions.** Describe what the code does today. If a folder is half-migrated or a module is dead, say so plainly. Aspirational architecture belongs in ROADMAP, never in the map.
- **Verify every path you write.** Before a file or directory appears in any doc, confirm it exists (read it, glob it, or stat it). A single dead link teaches the reader to distrust the whole document. On Windows, glob can silently miss files — fall back to a directory listing before declaring anything absent.
- **Augment, never clobber.** If the repo already has a README, CLAUDE.md, docs/, or any of these files, read them first and build on them. Preserve content the user wrote; merge rather than overwrite. Surface conflicts instead of silently resolving them.
- **One fact, one home — then link.** Each fact lives in exactly one doc; everything else links to it. Pin the high-traffic ones: build/run/test commands live only in the map, conventions only in CONVENTIONS, domain terms only in GLOSSARY — the CLAUDE.md block and cross-references point at those homes, they never restate them. Duplication is how docs rot: two copies drift, the reader can't tell which is current, and they pay to load the same fact twice.
- **Built so the reader loads the minimum.** These docs are read far more than written, often by an agent starting from a cold context window — so structure them for *partial* loading, not cover-to-cover reads. Keep the always-loaded layer (the CLAUDE.md block) tiny and have it deep-link to the exact section or file a task needs; give any long doc a table of contents and stable section anchors so a reader can jump instead of loading the whole thing; and split the map once it grows so no one pays for the entire codebase to understand one corner. Organization is the efficiency lever — not clever tooling.
- **Depth where it counts.** The codebase map earns real length; satellites stay lean. A glossary nobody finishes is useless. Spend your detail budget on the map.
- **Write for two readers at once.** An AI agent that needs exact paths and wiring, and a human who needs the mental model. Lead with the model, back it with paths.
- **Map the product, not the workbench.** A repo usually holds files that belong to a developer's *tooling and workflow* rather than the software the repo produces — agent/AI-harness scaffolding (session-continuity files like `NOW.md`/`IDEAS.md`/breadcrumb state, assistant config, slash-command plugins), editor settings, CI scratch, smoke-test artifacts. These describe how someone *works on* the code, not how the code *works*, and they often aren't even the same from one contributor to the next. Keep them out of the subsystem inventory. The test: "would this file exist if a different developer rebuilt the same product?" If no, it's workbench. If such files are genuinely load-bearing for contributors, isolate them in a short, clearly-labeled "Developer tooling / workflow" aside — never interleaved with real modules. When you can't tell whether something is product or tooling, **raise it at the proposal checkpoint instead of silently deciding.**
- **Write for low drift.** A standing doc rots when the code outruns it, so make rot *slow to happen and cheap to detect*: describe the **slow-changing structure** — module boundaries, data flow, entry points — not the churny detail (every file, every function), and prefer **checkable claims** — cite exact paths and `#anchors`, which the bundled `scripts/verify.js` re-checks — over prose that can quietly go wrong. Cited paths must use forward slashes; backslash paths are not machine-verified by `verify.js`. Coarse and true outlives exhaustive and stale. (`scripts/drift.js` scores how far each doc has lagged the code it cites.)

## Workflow

Work through these phases in order. Don't shortcut the discovery phase — it is where the map's
quality is decided.

### 1. Scan — get the lay of the land cheaply

Run the bundled scanner to get a structured inventory without burning a dozen tool calls:

```
python3 scripts/scan_repo.py <repo-root>
# if python3 is not found, fall back to: python scripts/scan_repo.py <repo-root>
# if neither exists, skip the scan entirely and proceed to the discovery phase — the scan is an optimization, not a prerequisite; tell the user it was skipped
```

It reports detected languages, build/manifest files, top-level directories with file counts,
candidate entry points, and any existing docs. Read its output before forming any opinion —
it tells you what kind of repo you're in and where to look.

### 2. Discover — read enough to map honestly

The scanner tells you *where* to look; now you read code to learn *how it works*. This is the
phase that separates a real map from a directory listing. For stack-specific shortcuts (where
entry points and modules live in JS/TS, Python, Go, Rust, Java/Kotlin, C#, Godot, etc.), read
`references/discovery_playbook.md`.

Resolve these questions by reading actual files — not by guessing from names:

- **Entry points.** Where does execution start? (`main`, CLI bins, server bootstrap, app root, request handlers, the main scene.) There is usually more than one.
- **The module/subsystem inventory.** What are the *architectural* units — not just folders, but the real responsibilities the code is divided into? For each: its job, its key files (path + one-line role), its public surface, and what it depends on.
- **Cross-cutting systems.** Config, logging, auth, persistence, state management, dependency injection / singletons / autoloads, error handling, the event/message bus. These thread through everything and new contributors trip on them.
- **The golden path.** Trace one representative end-to-end flow (a request, a frame, a CLI command) through the layers. This single trace teaches the architecture better than any prose.
- **The data model.** The core entities/types/schemas and where they're defined.
- **Externals.** Databases, third-party APIs, services, queues, env vars, secrets.
- **Build / run / test.** How do you start it, test it, build it, deploy it — the exact commands.
- **Conventions in force.** Naming, layout, and idioms the code *actually* follows (so CONVENTIONS.md documents reality, not a wishlist).

Read broadly but cheaply: skim many files for their role, read a few key ones deeply (entry points and the golden path deserve a real read). If the repo is large, spawn parallel exploration subagents — one per subsystem — and have each report back a structured summary.

### 3. Propose — checkpoint before writing

Don't surprise the user with a pile of generated files. Present, briefly:

- the doc set you'll create (and which already exist and will be augmented vs. created fresh),
- the **outline of the codebase map** — its section list and the module inventory you found,
- the proposed filenames and doc home (default `docs/`, but match the repo's existing convention),
- **anything that looks like workbench rather than product** — harness/session-continuity files, assistant config, installed-plugin scaffolding, scratch artifacts — named explicitly with your recommendation (exclude / isolate in a tooling aside / document as product). Don't fold these into the map silently; let the user decide, since they know which files are their personal tooling.

Get a quick confirmation or correction. This is also where the user can tell you their mental
model differs from what the code suggests — invaluable signal you can't get from files alone.

### 4. Generate — write the docs

Write each document against its guide. **Do not improvise the structure** — the guides encode
what "extremely detailed" actually means and keep output consistent across repos.

- **Codebase map (`INDEX.md`)** → follow `references/codebase_map_guide.md` exactly. This is the centerpiece; give it the depth it asks for.
- **Glossary, Roadmap, Conventions, and the CLAUDE.md block** → follow `references/satellite_docs.md`, which has a template and guidance for each.

Seed the ROADMAP from real signal — `TODO`/`FIXME` markers, open issues, recent git history,
and anything the user tells you — not from imagination. It's the one doc you can't read off the
code, so in an interactive session **offer to build it together** with a few quick questions
(see `references/satellite_docs.md` § ROADMAP.md), and never source it from short-horizon
session files like `NOW.md`; in a headless run, fall back to the weak-signal seed.

### 5. Wire and verify — make it trustworthy

The docs are only done once they're connected and correct:

- **Wire CLAUDE.md.** Add or update the "Where things are" block so every doc is reachable from the front door. If CLAUDE.md doesn't exist, create a minimal one whose first real section is this block.
- **Cross-link.** Each satellite links back to the map; the map links out to deeper docs. Link liberally — a reader should never hit a dead end.
- **Verify every path.** Walk every file/directory reference in every doc and confirm it exists. Fix or remove anything stale. State to the user that you did this — it's the step that makes the map trustworthy.
- **Leave update guidance.** End the map with a short "keep this current" note naming what events should trigger an update (new subsystem, new entry point, moved module), so the map doesn't rot — and point at `scripts/verify.js` (do the cited paths/anchors still resolve?) and `scripts/drift.js` (how far has each doc lagged the code it cites?) as the checks that catch drift between updates.

## Refreshing an existing map

When the docs already exist and you're *updating* rather than creating, don't regenerate from
scratch — find what drifted and fix only that, so you keep the parts that are still true (and any
human edits in them).

1. **Find the drift.** Run the bundled freshness checks: `node scripts/verify.js <repo>` flags every cited path or `#anchor` that no longer resolves; `node scripts/drift.js <repo>` scores how many commits have touched the files each doc cites since the doc was last updated, flagging the stale ones. (When Compass Rose is installed, `/compass:doctor` surfaces both for you.)
2. **Regenerate only what's flagged.** For a doc or section the checks flag, re-read the current code for that area and rewrite just that part. Leave clean docs and sections untouched — augment, never clobber.
3. **Re-verify.** Run `verify.js` again; it should come back clean. Tell the user what you refreshed and why.

## Adapting to the repo

- **Existing docs win on naming.** If the repo already uses `ARCHITECTURE.md` or `docs/dev/`, adopt that rather than imposing `INDEX.md`/`docs/`. Consistency with what's there beats your default.
- **Monorepos.** Produce a top-level map that orients across packages, then a short per-package map for each significant package. Don't cram a monorepo into one flat file.
- **Large single repos.** When the map would run long, don't pour everything into one `INDEX.md`. Keep INDEX a slim top-level directory and move each heavy subsystem into its own `docs/map/<subsystem>.md` that INDEX links to — so a reader loads the thin index and opens only the slice they need. See `references/codebase_map_guide.md` § *When the map gets big*.
- **Small repos.** Scale down honestly — a 20-file tool doesn't need five docs. A strong map plus the CLAUDE.md block may be the whole job. Don't manufacture a glossary for a project with no jargon.
- **Respect the user's chosen scope.** If they asked for "just the codebase map," produce that one artifact well and offer the rest rather than generating it unasked.

The detailed templates and rubrics live in `references/` — read the relevant one at the moment
you need it rather than loading everything up front.
