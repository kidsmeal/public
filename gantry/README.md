# Gantry

A gated design, plan, build, and review pipeline for [Claude Code](https://claude.com/claude-code).

Gantry turns a finalized design into reviewed, phased implementation, so nothing reaches a commit unreviewed and stopping mid-build always leaves a clean place to stand. Letting an AI implement a whole feature in one pass is how scope quietly creeps, a test gets disabled to make something "pass", and a convention violation slips into history. Rather than asking the model to be disciplined, Gantry builds the discipline into the workflow: it breaks the work into small phases, implements exactly one at a time, and reviews the uncommitted diff before you commit. A session that ends halfway through leaves a clean, reviewable boundary instead of a half-finished mess.

It is project-agnostic by construction. Every agent reads the host project's own convention files and detects its own test and build commands at run time, so the same plugin works in Flutter, Godot, Node, Python, Rust, Go, or .NET with no per-stack wiring.

Gantry grew out of a real game's `.claude/` workflow for designing and building its heroes, generalized so the same gated process moves to any project.

## What it gives you

- **An interactive design author.** Start from an idea: the `design-plan-creator` skill grills you through the open decisions, one branch at a time, then writes a buildable design doc grounded in your codebase that the rest of the pipeline consumes.
- **Four gated subagents.** `design-reviewer` audits the design before it is planned, `phase-planner` decomposes it into ordered phases, `implementer` builds exactly one phase tests-first, and `phase-reviewer` reads the uncommitted diff before you commit. Each one runs under explicit rules against overreaching.
- **A design audit you run before you build.** The design-reviewer checks the design against your project's rubric (or a built-in design-quality checklist), fixes what it can, and marks every unmade decision with a `[NEEDS USER DECISION]` marker instead of guessing.
- **One phase at a time.** The implementer's contract scopes it to a single phase: it builds that phase, then stops and reports. It does not commit and does not advance on its own, and a write it needs outside the phase's file list comes back as reported scope drift rather than a silent expansion. The phase-reviewer then catches any drift on the diff. You verify and commit between every step.
- **A review before every commit.** The phase-reviewer returns PASS, FAIL, or PASS-WITH-NOTES with specific, fixable findings, so scope drift and convention violations are caught on the diff rather than buried. It also flags **docs impact** — which of the project's standing docs (the map, glossary, conventions) the diff just made stale — so they're refreshed within the same phase instead of rotting.
- **One command to run it all.** `/gantry:run` drives the whole sequence in order through both review gates (the design review, and a phase review plus a re-review after any fix), pausing only at the decisions and commits that are yours.
- **Two living docs that keep the project honest.** A currentness audit answers "what is actually current?" before a cold session trusts an old plan, and a runtime verification queue tracks the gap between "the test suite passes" and "confirmed in a real run".

## How this differs from what you already have

The first question is usually "doesn't plan mode or an agent team already do this?" They work at different layers.

**Plan mode** gives you one plan up front. Gantry breaks the plan into phases, reviews the actual diff before every commit, and re-reviews any fix before it lands. Plan mode does not gate each phase or read your diffs.

**Agent teams** parallelize the work. Gantry gates it: every phase stops at a reviewed boundary before the next one starts.

**Spec-kit and the spec-driven-development plugins** generate a spec. Gantry executes against a finalized design and reviews the uncommitted diff before each commit, then re-reviews after a fix. Those two loops are the part spec generation does not have.

**Task Master and the backlog tools** track what to build next. Gantry governs how one phase gets built and whether its diff is allowed to commit. The two sit at different layers and run together without conflict.

## Security

Plugin readers check the source before they trust it, so here is the posture plainly.

Gantry runs plain Node.js scripts on the runtime Claude Code already bundles. Zero dependencies, no network calls, no telemetry, no API keys. It works on local files and ordinary git.

Its hooks, when you opt in through `/gantry:init`, only ever return allow or deny on a tool call. They never rewrite your commands and never touch tool output. That line matters: a `PreToolUse` hook that rewrites commands or filters output can silently corrupt what the agent reads, and an agent acting on a corrupted read can write garbage to disk. Gantry's guards cannot do that by construction, and they fail open, so any error in a guard allows the call instead of blocking it. The guards and their limits are described under "Why the gates matter".

No agent commits, pushes, or runs destructive git. You hold every commit.

## Quick Start

### 1. Install

Add the marketplace and install, straight from GitHub:

```
/plugin marketplace add kidsmeal/public
/plugin install gantry@kidsmeal
```

If you install during an existing Claude Code session, run `/reload-plugins` to activate it. No restart is needed.

You can also skip the plugin system entirely and copy `plugins/gantry/agents/`, `plugins/gantry/commands/`, and `plugins/gantry/skills/` into a project's `.claude/` directory. The agents are self-contained, so nothing else needs wiring.

### 2. Verify installation

```
/gantry:version
```

You should see a line like `Gantry v0.6.0`. If the command isn't recognized, the plugin didn't load. Run `/reload-plugins` (or restart Claude Code) and try again.

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
5. **Review the diff.** `/gantry:review <plan> <phase>` runs the phase-reviewer, read-only, over the uncommitted diff. It checks plan adherence, conventions, test discipline, and the phase's exit criteria, then returns a verdict. Any docs-impact findings (standing docs the diff made stale) are appended to the `## Open doc flags` section of `CURRENTNESS_AUDIT.md` so they survive beyond the session; `/gantry:audit` reconciles them. On FAIL the findings go back through `/gantry:build`, and the fix is re-reviewed before commit. On PASS you commit.
6. **Commit, then repeat.** Gantry never commits for you. You hold that gate. Then build and review the next phase.

Two more commands keep the docs honest as the project ships. `/gantry:audit` refreshes the currentness audit by reconciling what the docs claim against what the code and recent commits actually show. `/gantry:verify` curates the runtime verification queue, either adding an entry for a named feature or sweeping recent work for shipped-but-unverified behavior.

## Commands

Most of the time you run one command. `/gantry:run` drives the whole pipeline through both review gates, stopping only at your decisions and commits. The other commands are that same pipeline broken into pieces, for when you want to drive a single gate by hand or pick up mid-stream. For a small, self-contained change, `/gantry:quick <description>` is the lite lane: one build, one review, then your commit, with none of the design-and-plan front end (and no hooks, so it is prompt-level).

| Command | What it does |
|---|---|
| `/gantry:run <design> [rubric]` | The front door. Run the whole pipeline in order, through both review gates, gating only on your decisions and commits. |
| `/gantry:quick <description>` | The lite lane. Build a small change tests-first, review the diff, stop for your commit. No design, plan, or hooks. |
| `/gantry:init` | Scaffold the two audit docs and detect the project's conventions and test/build commands. |
| `/gantry:draft <idea>` | Grill out a buildable design doc from an idea, one decision at a time, grounded in the codebase. |
| `/gantry:design <draft> [rubric]` | Audit a design against a rubric or a generic checklist before planning. |
| `/gantry:plan <design>` | Turn a finalized design into a phased implementation plan. |
| `/gantry:build <plan> <phase>` | Implement exactly one phase, tests-first, then stop for review. |
| `/gantry:review <plan> <phase>` | Review the uncommitted diff for one phase against the plan and conventions. |
| `/gantry:audit` | Refresh `CURRENTNESS_AUDIT.md` against the code and recent commits. |
| `/gantry:verify [area]` | Add to, or sweep, the runtime verification queue. |
| `/gantry:version` | Print the installed version. Confirms the plugin is active. |

Two skills back the commands: `gantry` is the orchestrator that drives the whole loop in order with both review gates, and `design-plan-creator` authors the design doc that feeds it. Both also trigger from plain language ("run this through Gantry", "design this feature").

## How it reads your project

Nothing in Gantry is hardcoded to a stack. Before planning or building, each agent reads whichever of `CLAUDE.md`, `AGENTS.md`, `CONVENTIONS.md`, `CONTRIBUTING.md`, or `docs/CONVENTIONS.md` exist, and treats those as the law for naming, structure, typing, event names, and the project's documented anti-patterns. If a project has none, the agents fall back to matching the style of the surrounding code, and the planner says so in the plan.

The same goes for verification. `/gantry:init` detects the project's test runner and build command from its manifests (`package.json` scripts, `pubspec.yaml`, `Cargo.toml`, `go.mod`, `pyproject.toml`, a Godot project file, a `.csproj`, and so on), and the planner names the exact command each phase will be checked against. The reviewer then holds the diff to those same conventions and that same verification.

## Keeping docs honest

A project that ships faster than it documents accumulates rot: old plans that look live but shipped months ago, features that pass their tests but were never run on a real device. Gantry ships two living docs, scaffolded by `/gantry:init`, to fight exactly that.

`CURRENTNESS_AUDIT.md` sorts the project into Trust First (the anchors a session can rely on), Needs Reconciliation (docs whose claims the code contradicts, with the stale claim named), and Likely Shipped (done, should not pull attention). It also carries an `## Open doc flags` section — a running list of docs the phase-reviewer flagged as stale during a build, one entry per diff that touched them. `/gantry:audit` reconciles the list: verify each flag against the current code, refresh or confirm the doc, then check the box. It is an audit snapshot, not a reorganization, so it corrects the record without moving the old docs around.

`RUNTIME_VERIFICATION_QUEUE.md` separates, for each system, what the code and tests already prove from the manual check still owed, and names an explicit "Close when" condition. It is where the things that "pass CI but need a real run", sync on real data, cross-browser rendering, device-only paths, anything behind a flag, wait until someone confirms them.

Both assume a simple doc-lifecycle taxonomy that Gantry nudges toward: the roadmap says what to do next, plans say how, design says why and under what constraints, archive says what happened, and memory says what must not be forgotten. Keep those distinct and the audit stays small.

## Why the gates matter

The value is in the constraints, not the cleverness. Scope drift, a disabled test, and a convention violation are what the gates are built to catch, not wave through. The implementer's contract forbids expanding past its file list without reporting it; the phase-reviewer's contract forbids passing a diff that trips a documented anti-pattern, and it reads the actual uncommitted diff so a violation is caught against the real change rather than taken on trust. Ambiguity becomes a marker or a blocker rather than a silent decision. And every agent's contract reserves commit, push, and destructive git for you: the human holds the commit at every gate. The point of breaking work into gated phases is that finishing one and stopping is always a clean place to stand.

**Mechanical enforcement vs. contract enforcement.** Two of those constraints are hook-enforced rather than prompt-enforced when a project opts in via `/gantry:init`. The file-list guard (a PreToolUse hook on `Edit`, `Write`, and `MultiEdit`) blocks an edit to any file outside the active phase's file list. The commit guard (a PreToolUse hook on `Bash`) blocks `git commit` and `git push` while a phase is mid-build and not yet reviewed. Both guards are fail-open: any error, missing marker, or unresolvable path lets the call through, so a misconfigured hook can never brick the repo. Everything else (test discipline, convention compliance, scope judgment in nuanced cases) stays contract-enforced: it is the phase-reviewer's job reading the actual diff, because those require judgment a hook cannot make.

The commit guard stops casual drift, not active evasion. It catches `git commit` and `git push` at command-head positions in a Bash call, including chained commands (`&&`, `;`, `|`, subshells). It does not catch variable indirection (`g=git; $g commit`), `bash -c 'git commit'` where the inner string is a single opaque token, aliases, or similar techniques. That is intentional: the threat model is an agent that runs an unintended commit, not one trying to circumvent enforcement. Opting in via `/gantry:init` adds a `.gantry/enabled` marker; removing that marker makes all guards inert again.

## What a run costs

A single-run ballpark, not a benchmark. These are the subagent token counts from one real five-phase run of Gantry on its own enforcement hooks (design review, planning, each build and review). They exclude the orchestrating session that drives the gates, which is a real and non-trivial part of the cost, so read the totals as a floor.

- A phase that passes review clean: 75k to 105k tokens.
- A phase that fails review, gets a fix, and is re-reviewed: 180k to 235k.
- The full pipeline (design review, plan, five phases): about 560k for a clean run, about 800k for this run, which failed two phase reviews and re-ran the design review once.

The gates cost tokens, and the failed reviews are where most of the cost lands. In this run, those failed reviews are also where real bugs got caught and fixed before commit.

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
