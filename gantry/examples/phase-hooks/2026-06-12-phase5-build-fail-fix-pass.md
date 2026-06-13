# Phase enforcement hooks - Phase 5 build, FAIL, fix, re-review PASS

- **Date:** 2026-06-12
- **Project:** Gantry (plain Node.js plugin, zero deps)
- **Plan:** `gantry/docs/phase-hooks-plan.md`, Phase 5 (orchestrator wiring + init.md + README) - the final phase
- **Stage:** implementer -> phase-reviewer (FAIL) -> implementer (fix mode) -> phase-reviewer (PASS)
- **Files:** build.md, review.md, SKILL.md, init.md, README.md (+ init.js and init.test.js in the fix)

## Build

The implementer wired `sentinel.js write/clear/add-files` into the orchestrator's control flow (build.md,
review.md, SKILL.md) at the design's fixed ordering points, documented the init opt-in, and added the
README mechanical-vs-contract block plus the commit-guard known-limitations paragraph. Ordering self-check
passed; 83/83 at build time.

## Review 1 - FAIL (a consent-contract violation)

The phase-reviewer re-ran the suite, confirmed the ordering invariants, then caught a real design violation
that spanned a committed phase. `init.js` (committed in phase 4) wrote `.gantry/enabled` UNCONDITIONALLY
whenever `CLAUDE_PLUGIN_ROOT` was set, and the init command's `!`-prefixed script runs before any prose, so
plain `/gantry:init` silently opted every plugin user into enforcement. The design had decided the opposite
in three places, most explicitly: "opting into the docs must not silently opt into enforcement." The phase-5
implementer had framed init.md as "the marker is already written, ask whether to keep it, delete to
decline" which is opt-OUT, not the opt-IN the design pinned.

The reviewer judged it a FAIL rather than a note, and was careful to separate safety from consent: the
guards are inert without an active sentinel and fail open, so auto-enabling was not dangerous, but the
violated contract was about consent, and a design-contract violation is a fail. It named the root cause as a
phase-4 file and flagged that the fix re-opens a committed phase.

Verdict: FAIL. Required fixes: gate the marker write behind explicit consent (init.js + init.md + tests).

## Fix pass

init.js now gates the `.gantry/enabled` marker AND the `.gitignore` write behind an explicit
`--enable-hooks` flag. A default `/gantry:init` run with `CLAUDE_PLUGIN_ROOT` set writes nothing; it prints
"enforcement is available but NOT enabled" and how to turn it on. init.md was rewritten to the opt-IN flow
(ask the user; on yes, run `init.js --enable-hooks`; on no, do nothing). Tests were revised so the default
run asserts NO marker and NO gitignore, with the marker/gitignore coverage moved to the flag path. Two
em-dashes the implementer had introduced in review.md/SKILL.md prose were reworded (the maintainer's hard
rule forbids em-dashes in authored copy).

(Aside: the implementer reported "178 tests"; the real count was 84. The orchestrator verified by running
the suite directly, the same reason the reviewer never trusts a self-reported number.)

## Review 2 - PASS

The reviewer re-ran the suite (84/84, consistency green), confirmed every fix was real in the code (the
marker write is reached only via the flag branch; default run writes nothing; the unset path is unchanged),
confirmed the opt-IN prose, confirmed the two em-dashes were gone (with a unicode scan of every added line),
and re-confirmed the ordering invariants since SKILL.md and review.md were edited again. Verdict: PASS.

## Why it was useful

The gate caught a silent consent violation in code that had already been committed and pushed two commits
earlier. No test failed on it (the phase-4 tests asserted the wrong behavior, that the marker WAS written),
and the green suite reported health. It took reading the implementation against the design's stated decision
to see that "writes the marker on every plugin init" contradicted "must not silently opt into enforcement."
The fix moved enforcement behind an explicit `--enable-hooks` consent step, which is what the design asked
for all along.

## Diff (phase-5 + consent fix)
```
 plugins/gantry/commands/build.md        | + sentinel.js write before implementer spawn
 plugins/gantry/commands/review.md       | + add-files before fix re-spawn, clear at ready-to-commit
 plugins/gantry/skills/gantry/SKILL.md   | + same wiring in Stage 3
 plugins/gantry/commands/init.md         | opt-IN flow (ask, then --enable-hooks)
 plugins/gantry/scripts/init.js          | marker+gitignore gated behind --enable-hooks
 test/init.test.js                       | default = no writes; flag = writes; idempotent
 README.md                               | mechanical-vs-contract block + commit-guard limits
```
Verification: `node --test` from repo root -> 84 pass, 0 fail.
