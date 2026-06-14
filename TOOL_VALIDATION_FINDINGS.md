# Tool validation findings and testing axes

Distilled from the cartobench cartographer A/B session (2026-06). These are the failure
modes that nearly produced a false "it works," written so they apply to validating any of
our tools (cartographer, gantry, claudhd, compass-rose) before release. Detailed cartographer
evidence lives in `Documents\cartobench\` (RESULTS.md, RESULTS-espocrm.md).

The one-line summary: we spent a day almost shipping a "map makes agents 25% better at
navigation" claim. Clean testing showed the map's correctness benefit was zero, its cost
effect was a wash, and the agent never once opened the docs the tool generated (0 of 48 runs).
Every step that nearly fooled us generalizes.

## The failure modes (each almost gave us a wrong answer)

1. **Ceiling effect = you measured nothing.**
   If the no-tool baseline already succeeds almost every time, the tool's effect is
   undetectable and any apparent difference is noise. Sonnet scored 96-98% on espocrm with
   and without the map. You cannot prove a tool helps on tasks the baseline already passes.
   *Apply:* pick tasks or models where the baseline visibly fails, or you will confirm nothing.

2. **Environment artifacts impersonate tool effects.**
   A network storm made runs hang to the 900s timeout. Those got scored as failures and
   manufactured a 95-vs-70 "win" that vanished on a clean network. The control wasn't getting
   lost, the connection was hanging the process.
   *Apply:* a failure that could be environmental (timeout, crash, flake) is not a result until
   it reproduces on a clean run. Distinguish "tool-relevant failure" from "the machine hiccuped"
   in the harness, and retry the ambiguous ones before scoring.

3. **Is the artifact even consumed?**
   The decisive finding was behavioral, not statistical: the agent read the generated docs 0
   times in 48 runs (153 source-code reads, 0 map-doc reads). Outcome metrics cannot tell you
   this. An artifact nobody opens is dead regardless of what the outcome numbers say.
   *Apply:* before measuring outcomes, instrument whether the tool's output is actually read,
   opened, or used. This is the scariest check for every artifact-producing tool we own.

4. **Attribute via the control, never by inspecting treated runs alone.**
   We credited "agent went straight to the file 46% of the time" to the map, until we computed
   the same metric on the control and got 50% with no map at all. The map changed nothing.
   *Apply:* every behavioral claim needs the identical metric computed on the control. If the
   control matches, the tool is inert.

5. **Ground truth must be verified, not derived.**
   Answer keys taken mechanically from "the file the fix commit touched" were wrong about 17%
   of the time, because fixes land in callers while the described logic lives deeper.
   *Apply:* hand-verify ground truth against the actual code or reality. When several independent
   runs agree against your key, suspect the key, not the runs.

6. **Low n hides behind averages.**
   The same task swung 2, 8, and 20 turns across reps. Per-task numbers at low n are noise.
   Cost came out +16% on the mean and -19% on the median, opposite signs, because a few
   expensive tasks dominated the mean.
   *Apply:* enough reps to see the variance, pool across tasks, report median next to mean.
   Never quote a single-task delta as a result.

7. **Seal tasks and success criteria before the first scored run.**
   Tuning the task suite after seeing results makes the numbers fiction.
   *Apply:* commit the tasks and the keys first, then run.

8. **For context and doc tools, grep is a strong baseline.**
   A capable model navigates a reasonably-named repo fine on its own. A doc only earns its place
   where the model's native tools fail: vocabulary it can't guess, un-greppable wiring (metadata,
   DI, codegen), or intent that isn't a string in the code.
   *Apply:* test on inputs where the baseline tool fails, not where it already works.

9. **Build the harness to fail safely.**
   We hit a double-driver collision that corrupted a shared worktree, an inverted watcher that
   fired false alarms, and crash-vs-wrong-answer conflation that inflated failure counts.
   *Apply:* per-item isolation, resumable runs, and record the failure mode (crash / timeout /
   wrong) separately from pass/fail, so environment chaos doesn't poison the dataset.

## Pre-release checklist

Before claiming a tool works:

- Does a no-tool baseline actually fail on these tasks? If not, the test can't measure the tool.
- Is the tool's artifact read or used at all? Instrument consumption before outcomes.
- Does any behavioral difference survive being computed on the control too?
- Are the failures real or environmental? Reproduce on a clean run.
- Is ground truth hand-verified, not derived from a proxy?
- Enough reps to see variance, with median and mean both reported?
- Tasks and success criteria sealed before running?

## Applying the axes per tool

**cartographer.** The agent-navigation premise failed checks 1, 3, 4, and 8: ceiling on
correctness, zero artifact reads, no behavior change vs control, and grep already handled the
clean repo. Do not release the "helps agents navigate" claim. The only surviving question is
whether un-greppable content (vocabulary surprises, gotchas, intent) helps, and whether it's
consumed, which checks 3 and 8 still apply to.

**gantry.** It generates living docs (map, glossary, conventions) and a currentness audit. Same
consumption question as check 3: does an agent or a human actually read them, or are they write-
only? Separately, the gated design-review and phase-review are the real value claim. Test them
against a no-gate baseline on tasks where a plain build visibly produces bugs or drift (check 1),
and verify the gate catches issues the plain build misses. If the baseline build is already
clean, the gate proves nothing.

**claudhd.** State and thread tracking (NOW.md, IDEAS.md, SHIPPED.md). The value is longitudinal
and human-facing, so an A/B run is the wrong instrument. The honest test is the reach-for-it
test below.

**compass-rose.** Orchestration over the other three. Its risk is being an abstraction nobody
reaches for. Apply the reach-for-it test, and additionally check whether orchestrated actually
beats running the tools by hand on friction, not on stated preference.

## The reach-for-it test (for human-facing tools)

A/B benchmarks only work for agent-facing, single-task tools. For human-facing process tools
(claudhd, compass-rose, and the human side of gantry and cartographer), the data we can collect
is behavioral, not statistical. The test:

> In the last month, did you reach for it without thinking while actually building something,
> or only while working on the tools themselves?

Reached-for-while-building means load-bearing, keep it. Touched-only-while-tuning means it's a
hobby wearing a tool's clothes, which is allowed, but call it that so it doesn't masquerade as
shipping. The failure mode our profile is most prone to is the toolchain quietly becoming the
project.

## Post-mortem design lessons (why the premise felt right when it wasn't)

These are about tool design, not test design. They explain how we got 1,300 lines into a
tool before learning it didn't work, so the next tool doesn't repeat the class of mistake.

- **Check that the agent shares the human's bottleneck.** Cartographer's pitch came straight
  from a real human pain ("I inherited this repo and don't know where anything is"). The error
  was assuming the agent has the same pain. It doesn't: grep, a large context window, and
  training on millions of repos make its cold-start cost a fraction of a person's. We optimized
  locating, which was already cheap for the agent, and never touched understanding, which is the
  real cost. When you build an agent tool by analogy to a human workflow, verify the agent has
  the same bottleneck. Usually it doesn't.

- **Judge a tool by what it changes, not by what it produces.** Polished output looks like value.
  An artifact generator is uniquely good at faking its own success because the artifact sits
  there looking useful. Dogfooding confirmed cartographer *runs* and makes nice docs; it never
  confirmed anything *reads* them. The entire failure lived in the gap between "looks useful" and
  "is used," and dogfooding can't see that gap because you're the one admiring the output.

- **Passive artifacts vs active interventions (the axis that predicts the rest of the toolchain).**
  Cartographer is passive: it generates a thing and hopes someone reads it. Everything that failed
  flows from that. Rank every tool by one question: does its value depend on an agent or human
  *voluntarily reading generated output*? Tools that ENFORCE or INJECT (gantry's review gates; a
  hook that fires at the moment of need) are structurally safer than tools that DOCUMENT, because
  documentation routes through a voluntary-read step that failed 48 of 48 times here.
  - gantry review gates: active. structurally safe.
  - gantry living docs / cartographer map: passive. high exposure.
  - claudhd NOW.md: passive but human-facing, a different dynamic since the human chooses to look.
  If a passive artifact must exist, give it an active delivery path (inject it on the triggering
  event) instead of hoping it gets opened.

- **A confirming result deserves more scrutiny than a disconfirming one.** The dirty run said
  95-vs-70 and we were ready to write it up; the clean run that killed it got far more scrutiny
  than the result we wanted did. That is backwards. When a number says what you hoped, suspect it
  harder, because you are motivated to keep it. Spot-checking the too-good numbers is what saved us.

## The validation rig is a reusable asset

The harness that produced these findings (A/B worktrees at a pinned commit, sealed tasks,
headless `claude -p` runner, separate-session judge, resume-on-crash, transcript instrumentation
for consumption metrics) lives in `Documents\cartobench\` with a README. It is tool-agnostic:
add a new tool to the `BENCHES` registry and point it at gantry's gates or any future
agent-facing tool. A premise died and a validation bench came out of it.

## Meta

Two instruments, matched to two kinds of tool:
- Agent-facing tools: clean-baseline test (must fail without it) plus consumption test (must be
  read) plus control-attribution (difference must survive the control).
- Human-facing tools: the reach-for-it test.

If a tool passes neither, it doesn't ship. A day of rigorous testing that kills a premise is the
no-posting-until-proper rule doing its job, not a loss.
