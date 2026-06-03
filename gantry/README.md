# Gantry

A gated design, plan, build, and review pipeline for [Claude Code](https://claude.com/claude-code).

Gantry is a small Claude Code plugin that turns a finalized design into reviewed, phased implementation, where stopping mid-build is always safe and nothing reaches a commit unreviewed. Letting an AI implement a whole feature in one pass is how scope quietly creeps, a test gets disabled to make something "pass", and a convention violation slips into history. Rather than asking the model to be disciplined, Gantry builds the discipline into the workflow: it breaks the work into small phases, implements exactly one at a time, and reviews the uncommitted diff before you commit. A session that ends halfway through leaves a clean, reviewable boundary instead of a half-finished mess.

It is project-agnostic by construction. Every agent reads the host project's own convention files and detects its own test and build commands at run time, so the same plugin works in Flutter, Godot, Node, Python, Rust, Go, or .NET with no per-stack wiring. It has zero dependencies, runs on local files and ordinary git, and makes no network calls of its own. It uses the Node.js runtime Claude Code already bundles.

Gantry is distilled from a real game project's `.claude/` workflow and generalized so any repo can use it.

## What it gives you

- **An interactive design author.** Start from an idea: the `design-plan-creator` skill grills you through the open decisions, one branch at a time, then writes a buildable design doc grounded in your codebase that the rest of the pipeline consumes.
- **Four gated subagents.** `design-reviewer` audits the design before it is planned, `phase-planner` decomposes it into ordered phases, `implementer` builds exactly one phase tests-first, and `phase-reviewer` reads the uncommitted diff before you commit. Each one has hard rules that stop it from overreaching.
- **A design audit you run before you build.** The design-reviewer checks the design against your project's rubric (or a built-in design-quality checklist), fixes what it can, and marks every unmade decision with a `[NEEDS USER DECISION]` marker instead of guessing.
- **One phase at a time.** The implementer physically will not spill into the next phase, will not commit, and will not advance. You verify and commit between every step.
- **A review before every commit.** The phase-reviewer returns PASS, FAIL, or PASS-WITH-NOTES with specific, fixable findings, so scope drift and convention violations are caught on the diff rather than buried.
- **One command to run it all.** `/gantry:run` drives the whole sequence in order through both review gates (the design review, and a phase review plus a re-review after any fix), pausing only at the decisions and commits that are yours.
- **Two living docs that keep the project honest.** A currentness audit answers "what is actually current?" before a cold session trusts an old plan, and a runtime verification queue tracks the gap between "the test suite passes" and "confirmed in a real run".

## Quick Start

### 1. Install

Gantry lives in a subfolder of the `kidsmeal/public` repo, so install it as a local marketplace:

```
git clone https://github.com/kidsmeal/public.git
/plugin marketplace add public/gantry
/plugin install gantry@gantry
```

If you install during an existing Claude Code session, run `/reload-plugins` to activate it. No restart is needed.

You can also skip the plugin system entirely and copy `plugins/gantry/agents/`, `plugins/gantry/commands/`, and `plugins/gantry/skills/` into a project's `.claude/` directory. The agents are self-contained, so nothing else needs wiring.

### 2. Verify installation

```
/gantry:version
```

You should see a line like `Gantry v0.2.0`. If the command isn't recognized, the plugin didn't load. Run `/reload-plugins` (or restart Claude Code) and try again.

### 3. Initialize a project

In the project you want to manage:

```
/gantry:init
```

That scaffolds `CURRENTNESS_AUDIT.md` and `RUNTIME_VERIFICATION_QUEUE.md` (into `docs/` if you keep one, otherwise the repo root, and never overwriting files you already have). It then sniffs the repo for the two things the agents need to stay project-agnostic: your convention and style files, and your test and build commands. It prints what it found so Claude can confirm them with you. That is the only setup.

## The loop

Once a project is initialized, a feature moves through Gantry one gated step at a time. Run the whole sequence in order with `/gantry:run` (it stops only at the decisions and commits that are yours), or drive it by hand with the commands below. If you do not have a design doc yet, start with `/gantry:draft <idea>`, which interviews you and writes one.

1. **Author the design (if you don't have one).** `/gantry:draft <idea>` runs the design-plan-creator: it grills you through the open decisions, grounded in your codebase, then writes a structured design doc to feed the rest of the pipeline.
2. **Audit the design.** `/gantry:design <draft> [rubric]` runs the design-reviewer over the design doc. It writes a `<draft>_reviewed.md`, fixing resolvable issues and flagging the rest with `[NEEDS USER DECISION]`. Resolve those with Claude, and the design is ready to plan.
3. **Plan.** `/gantry:plan <design>` runs the phase-planner over the finalized design. It reads your conventions, spot-checks the codebase, and writes a `<design>-plan.md`: four to seven independently-verifiable phases, each with a goal, a file list, a verification step, and exit criteria, plus a cross-cutting-concerns section for anything that touches shared state, a schema, or a public contract. It writes no code, and any unresolved design question comes back as a blocker.
4. **Build one phase.** `/gantry:build <plan> <phase>` runs the implementer on a single phase. It writes the tests first where a test framework exists, stays inside the plan's file list, and reports scope drift instead of expanding silently. It does not commit and does not move on.
5. **Review the diff.** `/gantry:review <plan> <phase>` runs the phase-reviewer, read-only, over the uncommitted diff. It checks plan adherence, conventions, test discipline, and the phase's exit criteria, then returns a verdict. On FAIL the findings go back through `/gantry:build`, and the fix is re-reviewed before commit. On PASS you commit.
6. **Commit, then repeat.** Gantry never commits for you. You hold that gate. Then build and review the next phase.

Two more commands keep the docs honest as the project ships. `/gantry:audit` refreshes the currentness audit by reconciling what the docs claim against what the code and recent commits actually show. `/gantry:verify` curates the runtime verification queue, either adding an entry for a named feature or sweeping recent work for shipped-but-unverified behavior.

## Commands

| Command | What it does |
|---|---|
| `/gantry:init` | Scaffold the two audit docs and detect the project's conventions and test/build commands. |
| `/gantry:draft <idea>` | Grill out a buildable design doc from an idea, one decision at a time, grounded in the codebase. |
| `/gantry:design <draft> [rubric]` | Audit a design against a rubric or a generic checklist before planning. |
| `/gantry:plan <design>` | Turn a finalized design into a phased implementation plan. |
| `/gantry:build <plan> <phase>` | Implement exactly one phase, tests-first, then stop for review. |
| `/gantry:review <plan> <phase>` | Review the uncommitted diff for one phase against the plan and conventions. |
| `/gantry:run <design> [rubric]` | Run the whole pipeline in order, through both review gates, gating only on your decisions and commits. |
| `/gantry:audit` | Refresh `CURRENTNESS_AUDIT.md` against the code and recent commits. |
| `/gantry:verify [area]` | Add to, or sweep, the runtime verification queue. |
| `/gantry:version` | Print the installed version. Confirms the plugin is active. |

Two skills back the commands: `gantry` is the orchestrator that drives the whole loop in order with both review gates, and `design-plan-creator` authors the design doc that feeds it. Both also trigger from plain language ("run this through Gantry", "design this feature").

## How it reads your project

Nothing in Gantry is hardcoded to a stack. Before planning or building, each agent reads whichever of `CLAUDE.md`, `AGENTS.md`, `CONVENTIONS.md`, `CONTRIBUTING.md`, or `docs/CONVENTIONS.md` exist, and treats those as the law for naming, structure, typing, event names, and the project's documented anti-patterns. If a project has none, the agents fall back to matching the style of the surrounding code, and the planner says so in the plan.

The same goes for verification. `/gantry:init` detects the project's test runner and build command from its manifests (`package.json` scripts, `pubspec.yaml`, `Cargo.toml`, `go.mod`, `pyproject.toml`, a Godot project file, a `.csproj`, and so on), and the planner names the exact command each phase will be checked against. The reviewer then holds the diff to those same conventions and that same verification.

## Keeping docs honest

A project that ships faster than it documents accumulates rot: old plans that look live but shipped months ago, features that pass their tests but were never run on a real device. Gantry ships two living docs, scaffolded by `/gantry:init`, to fight exactly that.

`CURRENTNESS_AUDIT.md` sorts the project into Trust First (the anchors a session can rely on), Needs Reconciliation (docs whose claims the code contradicts, with the stale claim named), and Likely Shipped (done, should not pull attention). It is an audit snapshot, not a reorganization, so it corrects the record without moving the old docs around.

`RUNTIME_VERIFICATION_QUEUE.md` separates, for each system, what the code and tests already prove from the manual check still owed, and names an explicit "Close when" condition. It is where the things that "pass CI but need a real run", sync on real data, cross-browser rendering, device-only paths, anything behind a flag, wait until someone confirms them.

Both assume a simple doc-lifecycle taxonomy that Gantry nudges toward: the roadmap says what to do next, plans say how, design says why and under what constraints, archive says what happened, and memory says what must not be forgotten. Keep those distinct and the audit stays small.

## Why the gates matter

The value is in the constraints, not the cleverness. Scope drift, a disabled test, and a convention violation are hard stops in Gantry, not warnings. The implementer cannot expand past its file list without reporting it. The reviewer cannot pass a diff that trips a documented anti-pattern. Ambiguity becomes a marker or a blocker, never a silent decision. And no agent commits, pushes, or runs destructive git: the human holds the commit at every gate. The point of breaking work into gated phases is that finishing one and stopping is always a clean place to stand.

## Non-goals

- **Not a one-shot autopilot.** Gantry is deliberately step-at-a-time. If you want a feature built end to end without stopping, this is the wrong tool: the gates are the product.
- **Not an unattended design generator.** The `design-plan-creator` skill authors a design *with* you, by grilling you through the open decisions, grounded in your codebase. It will not dream one up unattended, and it surfaces unmade decisions rather than guessing them.
- **Not a commit bot.** It never commits, pushes, or merges. You decide when the diff is good enough.
- **Not a convention engine.** It enforces the conventions your project already documents; it does not impose its own house style.

## Requirements

- Claude Code (provides Node).
- git, for the diff review and the audit's history checks.

## License

MIT. See [LICENSE](LICENSE).
