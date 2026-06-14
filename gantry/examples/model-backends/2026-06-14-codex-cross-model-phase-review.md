# Model backends - phase review run by codex gpt-5.5 (cross-model)

- **Date:** 2026-06-14
- **Project:** Gantry (plain Node.js plugin, zero deps)
- **Plan:** `gantry/docs/model-backends-plan.md`, Phase 1 (per-role model-backend routing)
- **Stage:** phase-reviewer, routed to an external backend
- **Reviewer backend:** OpenAI codex `gpt-5.5` (reasoning effort xhigh), codex-cli 0.130.0-alpha.5, sandbox `workspace-write`
- **Invoked by:** `node plugins/gantry/scripts/role.js run phase-reviewer -- docs/model-backends-plan.md 1`
- **Cost:** ~104k tokens, one pass

This is the first run of a Gantry gate on a non-Claude model. The phase-reviewer role was set to
`codex` in `.gantry/models.json`; `role.js` resolved it to `DISPATCH: external`, composed the
prompt from the real `phase-reviewer.md` body plus the plan path and phase number, and piped it to
`codex exec`. Codex did the review itself: `git diff` / `git status`, read the changed files, ran
`node --test`, and emitted the verdict.

## How the dispatch ran

`role.js resolve phase-reviewer` printed:

```
DISPATCH: external
Backend 'codex' (type cli, model gpt-5.5). Run:
  node ".../plugins/gantry/scripts/role.js" run phase-reviewer -- <inputs>
```

`role.js run` then streamed codex's progress to stderr and captured its final message as the
verdict, the same verdict the orchestrator would relay from a native subagent. Codex ran the
project's own verification (`node --test`) and reported `tests 112, pass 112, fail 0`, so the gate
rested on a re-run of the suite, not on the build's self-report.

## Verdict (verbatim)

```
# Phase 1 Review - FAIL

Verdict: FAIL

## Plan adherence
- check every planned file is touched
- check no out-of-plan files are touched
- check named verification exists - test/role-core.test.js adds the role-core tests

## Conventions
- partial convention source - a referenced rules file was absent; judged against the
  plan-named sentinel core/CLI split and surrounding command prose
- check structure/naming follows local split - role-core.js is pure routing, role.js is CLI
- check no generated/cache files were hand-edited

## Test discipline
- check tests were added (guard rejection, backend invocation)
- check no tests disabled/skipped/deleted - node --test: tests 112, pass 112, fail 0, skipped 0
- check named verification passes - ran exactly node --test

## Code discipline
- fail stale explanatory comment - init.js header still says init writes only the two template
  files, but the diff now also writes .gantry/models.json

## Cross-cutting
- check enforcement-hook contract is implemented - role-core refuses off-harness implementers,
  role.js injects guard settings for headless implementer runs
- fail default behavior unchanged - the plan says all roles default to native, but the committed
  .gantry/models.json routes phase-reviewer to codex

## Exit criteria
- fail ".gantry/models.json absent or malformed resolves every role to native" - a present but
  invalid role/backend assignment errors instead of resolving to native
- check role.js resolve prints dispatch and rejects off-harness implementer
- check role.js run composes prompt, runs backend, relays stdout, injects headless guards
- check spawn sites / init / models / README are wired

## Docs impact
- none

## Required fixes (if FAIL)
1. Make the committed config all-native or remove it from this phase's committed diff;
   .gantry/models.json routes phase-reviewer to codex, contradicting the default-behavior contract.
2. Harden malformed config handling so invalid role/backend shapes resolve native instead of
   erroring, and add a test for that case.
3. Update the stale init header comment to include .gantry/models.json scaffolding.
```

## Triage (honest read)

The review is competent: specific, file:line cited, and in the right format. Of the three findings:

1. **Stale `init.js` comment - real.** The header claimed init "writes only the two template
   files"; the feature added `models.json` scaffolding. A correct, small catch.

2. **Committed `.gantry/models.json` contradicts "default native" - real, but it is the test
   rig.** That file is the config written to make codex the reviewer for this very run. The right
   fix is larger than codex framed it: `models.json` should be gitignored, because a backend
   depends on which CLIs and API keys exist on the local machine, so committing one developer's
   `codex` routing would break a teammate without codex. Per-developer local config, like `.env`.

3. **Malformed config errors instead of falling back to native - real gap, debatable fix.** The
   plan promised "malformed -> native." The code does fall to native for an absent or unparseable
   file, but a present-but-broken role entry errors. Codex's suggested fix is "resolve native."
   The better fix is loud-at-resolve, safe-at-command: resolve keeps erroring (and the implementer
   harness guard stays hard), but the command falls back to native and reports why, so a config
   typo never silently swaps your chosen reviewer for a different one. Needs the command prose, a
   test, and tighter plan wording.

So: one real bug, one real design improvement, one real spec gap. Two of the three trace back to
the way the test was set up (the codex-routed config in the diff) plus a comment, and none of them
contradict the engine itself, which codex confirmed (the harness guard, the wiring, the 112 tests).

## What was useful, stated plainly

The point this run demonstrates is the plumbing: a reviewer role can be sent to a different model
family and come back with a real, formatted, grounded verdict, having run the project's own test
command. It is not evidence that codex reviews better or worse than a native Claude reviewer, since
the same diff was not reviewed both ways. The cross-model angle has independent value (a reviewer
from a different family does not share the implementer's blind spots), but this single run does not
measure that, it only shows the path works.

## Noise worth recording

Codex issued several `git grep` calls through Windows PowerShell that failed on quoting
(`The string is missing the terminator`) and a benign `git ignore` permission warning, then
recovered with alternate commands and finished. That is the external CLI behaving on Windows, not
Gantry, but it is the kind of friction to expect when the reviewer is a separate tool rather than
an in-session subagent.

## Verification

`node --test` from repo root, run by codex as its review evidence: 112 pass, 0 fail.
