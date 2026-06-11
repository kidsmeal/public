---
name: design-plan-creator
description: Use when the user wants to design or spec a new feature before building it - phrases like "let's design a cookbook menu", "let's build/add X", "design this feature", "spec this out", "write a design doc / design plan for X", "draft a design", or the /gantry:draft command. Runs a grounded grill: it interrogates the open decisions one branch at a time, resolving each against the real codebase, then writes a buildable design doc the design-reviewer and phase-planner consume. Authors the design only; it never writes code or plans phases.
version: 0.4.0
---

# Design Plan Creator

The front of the Gantry pipeline. Turns a feature idea into a structured, buildable design doc by **grilling** you to a finalized design first, then writing it down. It does not propose a doc and ask you to nod at it: it surfaces every decision the feature implies, drives each one to a resolution grounded in the real codebase, and only writes the doc once the decision tree is resolved. The output is a design doc, not an implementation plan and not code.

Grill first, write once. A design full of unmade decisions just becomes a pile of `[NEEDS USER DECISION]` markers downstream, so the interrogation is the point.

## Response rule override (active during this skill)
Designing needs back-and-forth, so any terse / no-headers / no-bullets response rules the project normally imposes are suspended for this session. Resume them at handoff. Still honor the project's substantive conventions (strong recommendations over menus, its naming and structure).

## Stage 0 - Context load (silent, before any output)
Read before responding:
1. The project's convention/style files - whichever of `CLAUDE.md`, `AGENTS.md`, `CONVENTIONS.md`, `docs/CONVENTIONS.md` exist - plus the codebase map (`docs/INDEX.md` / `docs/ARCHITECTURE.md`) and the domain glossary (`docs/GLOSSARY.md`) if present.
2. Where designs live: detect a `design/`, `docs/design/`, or `plans/` directory; default to `design/`.
3. The area the feature will touch. Spot-check two or three representative files there with Glob/Grep so your questions and proposals match how the code actually works. A grill grounded in the real codebase is worth ten generic ones.

Get the feature idea from the user's message or args (e.g. "a cookbook menu"). If none was given, ask what they want to design before loading anything.

## Stage 1 - Frame the problem (interactive)
Propose a one-sentence **intent** and a short **problem statement** as concrete drafts, not blank questions. State what is missing or broken today and why it matters, no solution yet. Confirm or correct, then move into the grill.

## Stage 2 - The grill (the core of this skill)
Build the **decision tree**: the set of forks this feature implies. For a typical feature that spans the data model, scope, behavior/UX, contracts, and edge cases. Name the forks out loud, then drive them to resolution **one at a time**:

- For each fork, propose the option you would pick and say why (one or two sentences), grounded in what you read in the codebase.
- Then push: name the tradeoff the user is accepting, the case that breaks it, or the cheaper alternative. Do not let a decision pass with a shrug.
- If an answer opens a new fork, add it to the tree and keep going. The grill is done when every material fork is either resolved or explicitly deferred to **Open questions** (a conscious "decide later", not an overlooked gap).
- Resolve, do not accumulate: when the user picks, restate the resolution in one line so it is pinned before you move on.

Cover at least these branches, adapting to the feature:
- **Data / model:** what is stored, where, how it relates to existing tables/types. Does the surface you are assuming actually exist? (verify with Glob/Grep; if unsure, it is a fork, not a fact).
- **Scope boundary:** what is in this feature vs explicitly out. Pin it early so the grill does not sprawl.
- **Behavior / UX:** the observable outcome of each piece. If you cannot state how you would know it works, the piece is too vague - grill it sharper.
- **Contracts touched:** shared state, schemas, public APIs, events, generated code, build/release config. For each, the change and the migration/compatibility story.
- **Edge cases:** empty / zero / max / error / offline / concurrent / permissions states that matter here.

If a standalone `grill-me` skill is installed and the user would rather use it for the interrogation, hand off to it, then come back and synthesize the design doc from the result. The grill behavior above is the self-contained fallback when no such skill exists.

## Stage 3 - Write the design doc
Only once the decision tree is resolved, write to `<design-dir>/<feature-slug>.md` using this structure, filled with what the grill settled. Set `Status: draft`.

```
# <Feature> - Design
Status: draft
Intent: <one sentence>

## Problem
## Design
## Contracts touched
## Edge cases
## Out of scope
## Open questions
```

Never overwrite an existing design doc; if the slug is taken, confirm a new one.

## Stage 4 - Handoff
Tell the user the path, and list any forks that landed in **Open questions** (so they know the design-reviewer will flag them). Then recommend the next step:
- `/gantry:design <path>` to audit the design, or
- `/gantry:run <path>` to drive the whole pipeline from here (review -> plan -> phased build).

Resume the project's normal response rules.

## Hard rules
- Grill before you write. Do not produce the doc while material decisions are still open - resolve them or consciously defer them to Open questions first.
- Ground every question and proposal in the real codebase. Never assert a file, table, or contract exists without checking; if unsure, treat it as a fork.
- Author the design only. No code, and no decomposition into implementation phases - that is the phase-planner's job.
- Make strong recommendations, not menus. The grill is you pushing on a default, not you listing options for the user to sort out.
- Keep every design unit buildable and testable: a concrete behavior with an observable outcome.
- One design doc per feature. Status stays `draft` until the design-reviewer passes it.
