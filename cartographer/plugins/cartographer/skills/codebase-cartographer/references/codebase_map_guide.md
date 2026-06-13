# Codebase Map Guide (`INDEX.md`)

The codebase map is the centerpiece of the navigation layer. Its job: a reader who has never
seen this repo can, in five minutes, locate any system and understand how the pieces connect.

"Extremely detailed" does **not** mean long-winded. It means **complete coverage at a
predictable granularity**: every entry point, every significant module, every cross-cutting
system, the golden path, and the build/run/test commands — each described tersely, with an
exact path the reader can jump to. A reader should never have to ask "but where does X live?"
and come up empty.

## Table of contents

- [The granularity rule](#the-granularity-rule)
- [Required sections](#required-sections)
- [The INDEX.md template](#the-indexmd-template)
- [Writing each section well](#writing-each-section-well)
- [Depth rubric — when is the map done?](#depth-rubric)
- [Common failure modes](#common-failure-modes)

## The granularity rule

Pick a consistent unit of description and apply it everywhere: **one row per file that a
reader would plausibly need to open**, with a one-line role. Not every file — skip generated
code, trivial barrels/re-exports, and test fixtures. But every file that *owns a
responsibility* gets a row. Consistency is what makes the map scannable: the reader learns the
shape once and trusts it everywhere.

For each entry, the role line answers "why would I open this?" — not "what language is it."
`Maps effect_type → handler Callable` is a good role. `A GDScript file` is not.

## Required sections

Every map has these, in this order. Omit a section only if the repo genuinely has nothing for
it (a library may have no "entry points" in the app sense — say so rather than inventing one).
When the map has more than a handful of sections, open it with a one-line **table of contents**
of anchor links, so a reader can jump straight to one section instead of loading the whole file.

1. **Orientation** — 2–4 sentences: what this codebase *is*, its primary language/framework, and the one-line mental model. Then how to run it.
2. **Entry points** — every place execution begins.
3. **Architecture at a glance** — the golden-path trace + a layer/dependency sketch.
4. **Modules & subsystems** — the bulk of the map; one subsection per architectural unit.
5. **Cross-cutting systems** — config, logging, auth, persistence, state, errors, events.
6. **Data model** — core entities/types/schemas and where defined.
7. **External dependencies & integrations** — services, DBs, APIs, env vars.
8. **Build, run, test** — exact commands.
9. **Docs & where to go deeper** — links to the satellite docs and any deep-dive docs.
10. **Keeping this current** — the update triggers.

## The INDEX.md template

Use this structure. Tables are the default for inventories — they scan fast and force the
path+role discipline. Prose is for the orientation and golden-path sections where a mental
model matters more than a list. Keep the section headings stable and anchor-friendly — other
docs (and the CLAUDE.md block) deep-link to them, so renaming a heading silently breaks those
jumps.

```markdown
# Codebase Map

> Fast lookup for where everything lives. Update when adding or moving a system —
> see [Keeping this current](#keeping-this-current).

**Contents:** [Orientation](#orientation) · [Entry points](#entry-points) · [Architecture](#architecture-at-a-glance) · [Modules & subsystems](#modules--subsystems) · [Cross-cutting](#cross-cutting-systems) · [Data model](#data-model) · [Build/run/test](#build-run-test) · [Deeper docs](#docs--where-to-go-deeper)

## Orientation

<2–4 sentences: what this is, primary stack, the one-line mental model.>

**Run it:** `<command>`  |  **Test it:** `<command>`  |  **Build it:** `<command>`

## Entry points

| Purpose | Path | Notes |
|---|---|---|
| <e.g. CLI entry> | `src/cli/main.ts::main` | parses args, dispatches to commands |
| <e.g. HTTP server> | `src/server/index.ts::bootServer` | boots Express, mounts routers |

## Architecture at a glance

**Golden path — <name one representative flow>:**

`<entry>` → `<layer A: file>` → `<layer B: file>` → `<layer C: file>` → `<result>`

<2–5 sentences walking that trace, naming the file at each hop.>

**Layers / dependencies:** <one short paragraph or a small diagram of how the big pieces
depend on each other — what may import what.>

## Modules & subsystems

### <Subsystem name>

<One sentence: what it's responsible for.>

| File | Role |
|---|---|
| `path/to/file` | <one-line role> |
| `path/to/other` | <one-line role> |

<Optional: one line on its public surface / how other code calls in.>

### <Next subsystem>
...

## Cross-cutting systems

| Concern | Where | Notes |
|---|---|---|
| Config | `path` | env vars, precedence |
| Logging | `path` | logger setup, levels |
| Auth | `path` | how a request is authenticated |
| Persistence | `path` | DB client, migrations |
| State / DI / singletons | `path` | global services and their roles |
| Error handling | `path` | central handler, error types |
| Events / messaging | `path` | bus, topics, subscribers |

## Data model

| Entity / type | Defined in | Notes |
|---|---|---|
| `<Type>` | `path` | <what it represents> |

## External dependencies & integrations

| Service / dependency | Used for | Wired in | Config |
|---|---|---|---|
| <e.g. Postgres> | primary store | `path` | `DATABASE_URL` |

## Build, run, test

| Task | Command |
|---|---|
| Install | `<cmd>` |
| Run (dev) | `<cmd>` |
| Test | `<cmd>` |
| Build | `<cmd>` |
| Lint / typecheck | `<cmd>` |

## Docs & where to go deeper

| Doc | Purpose |
|---|---|
| `docs/GLOSSARY.md` | domain terms |
| `docs/CONVENTIONS.md` | naming, layout, idioms, anti-patterns |
| `docs/ROADMAP.md` | active work & state of play |
| `<any deep-dive>` | <purpose> |

## Keeping this current

Update this map when you: add or move a subsystem, add an entry point, introduce a
cross-cutting system, or change the build/run/test commands. The map is only useful while
it's true.
```

## Writing each section well

**Orientation** — Resist the urge to editorialize. State the stack and the mental model. The
mental model is the single sentence you'd tell a new hire: "It's a tower-defense game where
heroes defend a wall against waves; runtime state lives in one autoload." That sentence
orients every later section.

**Entry points** — Find them by reading manifests and bootstrap files, not by guessing.
`package.json` `bin`/`scripts`, `pyproject.toml` `[project.scripts]`, `main.go`, `fn main()`,
`public static void main`, `if __name__ == "__main__"`, the framework's app root, the game's
main scene. List *all* of them; a repo often has a server, a CLI, and a worker. Cite each one
down to the function with a **symbol citation** — `src/server/index.ts::bootServer` — so
`verify.js` fails when the function is renamed, not just when the file moves. (The symbol must
appear verbatim in the file; the check is a word-bound text match, so it works in any language.)

**Architecture at a glance** — The golden-path trace is the highest-leverage paragraph in the
whole map. Pick the flow that most defines the app, and name the actual file at every hop —
and where a hop lands on a specific function or class, use a symbol citation
(`src/router/dispatch.ts::dispatch`) so the trace stays checkable, not just the filenames. A
reader who follows it once understands the layering without being told the layering.

Use symbol citations **only** where a wrong claim costs the reader the most: entry points and
golden-path hops. Don't sprinkle `::symbol` through file tables or role-line prose — every
symbol citation is one more thing that flags on an innocent rename, and the role line's job is
the mental model, not the identifier.

**Modules & subsystems** — This is most of the map. Divide by *responsibility*, which often
but not always matches folders. If one folder holds three unrelated jobs, give it three
subsections. If one subsystem spans three folders, unify it under one. Each subsystem: a
one-sentence charter, then the file table. Keep role lines parallel in voice.

**Cross-cutting systems** — These are what new contributors get wrong, because they're
invisible until you need them. Where do env vars get read? How does a request know who the
user is? What's the global state and who mutates it? Pin each to a file.

**Data model** — Just the core entities and where they're defined. Don't reproduce schemas;
point to them.

**Build, run, test** — Exact, copy-pasteable commands. If they differ by OS, note it. This is
the section readers use most on day one.

## When the map gets big — split it

One `INDEX.md` is ideal while it stays scannable. Once it grows past roughly 300–400 lines —
usually when *Modules & subsystems* starts to dominate — a single flat file makes every reader
load the whole codebase just to learn one corner of it. At that point, split it:

- Keep `INDEX.md` as a **slim top-level directory**: orientation, entry points, the golden path, the build/run/test commands, and a *one-line-per-subsystem* table where each row links to that subsystem's own file.
- Move each heavy subsystem's detail into `docs/map/<subsystem>.md`, structured like a Modules subsection (charter + file table) but free to go deeper.

Now a reader loads the thin INDEX, sees the whole shape, and opens only the subsystem file
their task touches — the same progressive-disclosure move the navigation layer makes
everywhere: the always-loaded layer stays small, depth is one click away.

Keep the split honest. Don't shard a small map to look tidy — below the threshold the extra
hop costs more than it saves. And make sure the INDEX subsystem table still answers "where
does X live?" on its own, so the common lookups never have to open the deeper file at all.

## Depth rubric

The map is done when **all** of these are true. If any fails, keep going.

- [ ] A reader can answer "where does X live?" for every X you discovered, using only the map.
- [ ] Every entry point is listed.
- [ ] Every significant module has a subsection with a file table; no "misc" catch-alls hiding real systems.
- [ ] The golden path names a real file at every hop, and those files exist.
- [ ] Every cross-cutting concern is pinned to a path (or explicitly marked "none").
- [ ] Build/run/test commands are exact and were confirmed against the manifest, not assumed.
- [ ] **Every path in the document was verified to exist.** This is non-negotiable.
- [ ] Role lines say *why you'd open the file*, not what type it is.
- [ ] A long map opens with a table of contents and uses stable, anchor-able headings.
- [ ] If *Modules & subsystems* outgrew the file, the map is split into a slim INDEX + per-subsystem files rather than one oversized file.

## Common failure modes

- **The directory-listing trap.** Re-stating the folder tree with no insight. The map's value is in roles, wiring, and the golden path — the parts you can't get from `ls`.
- **Aspirational drift.** Documenting the architecture someone *wishes* existed. If the code doesn't match, the map is lying. Note messy reality; route wishes to ROADMAP.
- **Uniform shallowness.** Spreading attention evenly so nothing is actually explained. The golden path and the top 2–3 subsystems deserve more depth than a config loader.
- **Path rot on arrival.** Writing paths from memory or from the scanner without opening them. Verify before you write, every time.
- **Catch-all sections.** A "utils" or "misc" bucket usually hides a real subsystem that deserves its own subsection. Look closer before lumping.
- **Mapping the workbench.** Treating tooling/harness artifacts as product subsystems — session-continuity files (`NOW.md`, `IDEAS.md`, breadcrumb state), installed agent/plugin scaffolding, assistant config, editor settings, smoke-test scratch. They describe how the developer *works on* the repo, not how the product works, and they pollute the architecture picture. Exclude them from the subsystem inventory; at most give them a short labeled "Developer tooling / workflow" aside. When in doubt, ask at the proposal checkpoint rather than folding them in.
