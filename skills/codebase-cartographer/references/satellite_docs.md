# Satellite Docs Guide

The codebase map (`INDEX.md`) is the centerpiece; these four documents orbit it. Each has one
job. Keep them lean — their value is in being *complete enough to trust* and *short enough to
finish*. Read the relevant section here when you're about to write that doc.

- [The CLAUDE.md "Where things are" block](#claudemd-where-things-are) — the front door
- [GLOSSARY.md](#glossary) — domain terms
- [CONVENTIONS.md](#conventions) — naming, layout, idioms, anti-patterns
- [ROADMAP.md](#roadmap) — state of play

---

## CLAUDE.md: "Where things are" {#claudemd-where-things-are}

This is the highest-leverage artifact after the map itself, because CLAUDE.md is the first
thing read on every task. The block's only job is to route the reader to the right doc fast —
it is a **table of pointers, not a place for content**. Anything substantive belongs in the
doc it points to.

Place it near the top of CLAUDE.md (after any one-line project description). If CLAUDE.md
already exists, insert or update this section without disturbing the rest. If it doesn't
exist, create a minimal CLAUDE.md whose first real section is this block.

```markdown
## Where things are
- **Codebase map** — overview, entry points, golden path: `docs/INDEX.md`
  - <deep-link the hottest systems straight to their anchor or file, e.g.>
    combat: `docs/INDEX.md#combat` · persistence: `docs/map/persistence.md`
- **Glossary** (domain terms & acronyms): `docs/GLOSSARY.md`
- **Conventions** (naming, layout, idioms): `docs/CONVENTIONS.md`
- **Roadmap** (active work, next up, blocked): `docs/ROADMAP.md`
- **Build / run / test:** `docs/INDEX.md#build-run-test`  ← linked, not restated

## Critical gotchas
- <the 3–6 things that will bite someone who doesn't know them — non-obvious build quirks,
  platform traps, "never edit X by hand", state that lives somewhere surprising>
```

Guidance:
- **List only docs that exist.** Don't point at a glossary you didn't create.
- **Gotchas are gold.** This is where you capture the hard-won knowledge that isn't anywhere
  else: the flag that silently breaks things, the folder you must never rename by hand, the
  cache that needs clearing. Pull these from the discovery phase and from the user. A reader
  who skips everything else will still read the gotchas.
- **Keep it a pointer table.** The moment it starts holding real explanations, those
  explanations are now duplicated and will drift. Move them into the target doc and link.
- **Deep-link, don't just name.** Point at the exact section anchor or subsystem file a task
  will need (`docs/INDEX.md#hero-system`), not merely the doc. This block is loaded on *every*
  task, so a precise jump means the agent opens one slice instead of a whole document. It
  relies on stable headings in the target — the map guide enforces those.
- **Reference high-traffic facts, never copy them.** Build/run/test commands and the like have
  a single home (the map); link to that anchor here instead of restating them, so the copies
  can't drift and the reader never loads the same fact twice.

---

## GLOSSARY.md {#glossary}

A glossary disambiguates the words that mean something *specific* in this project. Its value is
proportional to how much private jargon the domain has — a generic CRUD app may need almost
none; a game or a trading system may need pages. **Only include terms a newcomer would
misread or not know.** Don't define "database."

What earns an entry:
- Domain nouns with project-specific meaning (a "Fragment", a "Wave", a "Tenant").
- Acronyms and abbreviations used in code or docs.
- Words overloaded from their normal meaning ("Collapse" meaning something other than a stack collapse).
- Internal codenames for systems, features, or releases.

```markdown
# Glossary

Project-specific terms and acronyms. If a word means something special here, it's defined below.

## A

**<Term>** — <one-to-three sentence definition>. <Optional: where it lives in code, e.g.
"Implemented in `systems/foo.gd`."> <Optional: link related terms.>

## B
...
```

Guidance:
- **Alphabetize**, or group by domain area if that's more natural — but pick one and be consistent.
- **Link into the code** where a term maps to a concrete file or type; that turns the glossary into a second index.
- **Define, don't lecture.** One to three sentences. If a term needs a page, it needs its own doc, and the glossary should link to it.
- Cross-link related terms so a reader chasing one word discovers the cluster it belongs to.

---

## CONVENTIONS.md {#conventions}

The rules of the road: how this codebase names things, lays out files, and structures code —
plus the anti-patterns it has decided to avoid. The point is that a contributor (human or AI)
can produce code that looks like it belongs, without a reviewer re-explaining the house style
every time.

Document **conventions actually in force**, discovered by reading the code — not your personal
preferences or a generic style guide. If the code is inconsistent, document the *dominant*
pattern and note the exception rather than pretending uniformity.

```markdown
# Conventions

How this codebase is organized and styled. Follow these so new code looks like it belongs.

## Naming
| Construct | Convention | Example |
|---|---|---|
| <files> | <rule> | <example> |
| <types/classes> | <rule> | <example> |
| <functions> | <rule> | <example> |
| <constants> | <rule> | <example> |

## Directory layout
<How the tree is organized — by type? by feature? — and the rule for where a new file goes.>

## Architectural rules
- <e.g. "Controllers stay thin; feature logic lives in dedicated modules.">
- <e.g. "UI components own their own refresh; callers only toggle visibility.">

## Idioms in use
- <recurring patterns a contributor should mirror — error handling style, how async is done,
  how config is read, the testing pattern.>

## Anti-patterns (avoid)
| Anti-pattern | Why |
|---|---|
| <thing> | <reason> |
```

Guidance:
- **Filename is `CONVENTIONS.md`**, not `AGENTS.md` — name it for what it holds.
- **Show, don't just tell.** Every naming rule gets an example; examples are what people copy.
- **Anti-patterns are as useful as patterns** — they encode decisions already made, so they don't get re-litigated in review.
- Keep it to what's *distinctive*. Don't restate language defaults everyone already follows.

---

## ROADMAP.md {#roadmap}

The state-of-play doc: what's being worked on, what's next, what's blocked, what just shipped.
It answers "what's the current focus and what's safe to touch?" — context that code and git
history convey only slowly.

Seed it from **real signal**, never invention:
- `TODO` / `FIXME` / `HACK` markers in the code,
- open issues / tickets (if a tracker is reachable),
- recent commit history (what's been moving),
- and whatever the user tells you about current priorities.

Mind the **horizon**. A roadmap is medium-term — weeks to months. Don't source it from, or alias
it to, a short-horizon *session-continuity* file (a `NOW.md`, breadcrumb / last-session state, or
similar): those record the current thread (hours to days) and are developer workbench tooling,
not a plan. At most such a file informs the single "In progress" line. A real ROADMAP links out
only to a genuine roadmap-horizon tracker — an existing `ROADMAP.md`, a `plans/` dir, Jira,
Linear, Trello, or GitHub Projects.

```markdown
# Roadmap

Current state of play. Not a backlog dump — the things actually in motion.

## In progress
- <item> — <one line of context; who/where if useful>

## Next up
- <item> — <why it's queued>

## Blocked / waiting
- <item> — <what it's blocked on>

## Recently shipped
- <item> — <date if known>

## Someday / ideas
- <item>
```

Guidance:
- **Offer to build it together — this is the one doc you can't read off the code.** The other four come from the repo; "what's next / blocked / planned" comes from the person. So when the roadmap is in scope and there's no authoritative tracker to point at, ask once, then either interview or stub:
  > *"The roadmap is the one piece I can't infer from the code. Want to build a real one together — I'll ask a handful of quick questions — or should I leave a thin stub that links to wherever you track work?"*

  If they decline, write the sparse/linked version and move on. **If no human is in the loop (an agent / headless run), skip the offer** and use the weak-signal seed — never block waiting on answers.
- **Run it as a conversation, not a form.** Treat the questions below as a checklist of what a roadmap needs, asked as a thread that adapts to the answers — the moment they name a tracker ("we use Trello"), stop asking and pivot to *"link to it, or pull the current items in as the starting point?"* (and if you can reach it, offer to populate from it):
  1. What are you actively working on right now? → *In progress*
  2. What are the next few things after that? → *Next up*
  3. Anything blocked or waiting on something else? → *Blocked*
  4. A near-term milestone or release you're aiming at? → sets the horizon
  5. Where do you track work, if anywhere (Trello / Jira / Linear / GitHub issues / a `plans/` doc)? → link out or pull in
  6. Anything that should explicitly *not* be worked on — known non-goals? → *Someday* / out-of-scope
- **Active over exhaustive.** A roadmap that lists 200 backlog items is a backlog, not a roadmap, and nobody trusts it. Capture what's in motion.
- **Convert relative dates to absolute** ("next sprint" → a real date) so the doc still makes sense in three months.
- **It's allowed to be sparse.** If you only know what's in progress, write that and leave the rest as headers. Honest and short beats padded.
- **Link to a real tracker, don't compete with it.** If work already lives in an external tool or an existing `ROADMAP.md`, keep this doc a thin summary that links out — not a second source of truth that will drift.
