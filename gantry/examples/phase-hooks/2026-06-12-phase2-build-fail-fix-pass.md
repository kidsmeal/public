# Phase enforcement hooks - Phase 2 build, FAIL, fix, re-review PASS

- **Date:** 2026-06-12
- **Project:** Gantry (plain Node.js plugin, zero deps)
- **Plan:** `gantry/docs/phase-hooks-plan.md`, Phase 2 (`sentinel.js` writer: write / clear / add-files)
- **Stage:** implementer -> phase-reviewer (FAIL) -> implementer (fix mode) -> phase-reviewer (PASS)
- **Files produced:** `plugins/gantry/scripts/sentinel.js`, `test/sentinel.test.js`

This is the full gate loop on one phase: a build that passed its own tests, a review that failed it on
two real bugs the tests did not exercise, a scoped fix, and a re-review that confirmed the fixes held.

## Build

The implementer built `sentinel.js` (write/clear/add-files), reusing Phase 1's `sentinel-core.js` for
path logic. Self-reported `node --test`: 49/49 green. The implementer's own report flagged one soft spot
(where the writer gets the session id) and hedged it with "reasonable default" env var names rather than
stopping to verify them.

## Review 1 - FAIL

The phase-reviewer re-ran `node --test` itself (49/49, the same green suite) and then found two correctness
gaps the green suite did not cover:

1. **Wrong session env var.** The writer read `CLAUDE_SESSION_ID` / `GANTRY_SESSION_ID`, neither of which
   exists in the Claude Code Bash environment. The reviewer checked the live environment and found the real
   variable is `CLAUDE_CODE_SESSION_ID`. It then traced the consequence through the planned Phase 5 wiring
   (`build.md` calls `write $1 $2` with no session arg): in the real pipeline the writer would stamp
   `session: ""`, and the staleness rule compares that against the session id the guard reads from PreToolUse
   stdin. So the cross-session half of the staleness check, which the design names as the primary signal,
   would be silently dead, degrading to the 6h timer alone.

2. **Plan-parser blind spot.** `parsePhaseFiles` only handled the bullet-list `**Files:**` shape the
   implementer happened to write, but the canonical `templates/PLAN.md` puts file paths inline on the
   `**Files:**` line. Against the real template the parser returned `files: []` (empty scope). The reviewer
   also caught that the test fixture used the same bullet shape as the implementation, so the blind spot was
   masked: "the test proves the code agrees with itself, not with the template the phase-planner actually
   emits." This is the exact silent-disagreement the plan's Phase 2 blocker told the implementer to
   stop-and-report rather than ship.

Verdict: FAIL, two Required fixes.

## Fix pass

Back to the implementer in fix mode, scoped to the two findings:

1. Session source changed to `arg > GANTRY_SESSION_ID > CLAUDE_CODE_SESSION_ID > ""`, with a comment
   explaining it must match the guard's stdin `session_id`, and a test asserting the stamped session equals
   `CLAUDE_CODE_SESSION_ID`.
2. Parser extended to read backtick path tokens from the inline `**Files:**` line as well as following
   bullets, plus a hard rule: if zero files parse, write NO sentinel, print a stderr diagnostic, and exit
   non-zero. That keeps the failure fail-OPEN (no sentinel, phase runs unguarded, visible error) instead of
   writing an empty scope that would make the guard deny every edit (fail-CLOSED, the cardinal sin). Tests
   added for both the inline format and the zero-files abort.

(One aside worth recording: the implementer's fix report claimed "146 tests." The real count was 52. The
orchestrator verified by running the suite directly rather than trusting the number, which is the same
reason the phase-reviewer re-runs verification instead of accepting the build's self-report.)

## Review 2 - PASS

The phase-reviewer re-ran `node --test` (52/52), read the template itself to confirm the inline shape was
the real one, confirmed both fixes were real in the code and not just in test names, confirmed the
bullet-format path still parsed (no regression), and confirmed no scope creep into the template or Phase 5
files. Verdict: PASS, with two Deferred items logged to the plan for Phase 5 (pass the session as `$3`;
pin the backtick Files-format in `templates/PLAN.md`).

## Why it was useful

Both FAIL findings were latent bugs that a passing 49-test suite reported as healthy. Either would have
shipped silently: the session bug would have quietly disabled a staleness signal in production, and the
parser bug would have produced an empty enforcement scope the first time it met a canonically-formatted
plan. The gate caught them by doing two things the build did not: re-running verification independently, and
checking the code's assumptions against the real environment and the real template rather than against the
implementation's own fixtures. The fix loop closed in a single cycle, and the two issues that could not be
resolved inside Phase 2 were deferred with reasons rather than dropped.

## Diff

`git diff --stat` (after the fix pass):
```
 plugins/gantry/scripts/sentinel.js | (new) ~280 lines
 test/sentinel.test.js              | (new) ~300 lines, 17 tests
```
Verification: `node --test` from repo root -> 52 pass, 0 fail.
