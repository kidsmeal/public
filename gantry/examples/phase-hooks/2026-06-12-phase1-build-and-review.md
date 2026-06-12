# Phase enforcement hooks - Phase 1 build + review

- **Date:** 2026-06-12
- **Project:** Gantry (plain Node.js plugin, zero deps)
- **Plan:** `gantry/docs/phase-hooks-plan.md`, Phase 1 (shared sentinel-read + path-normalization helper)
- **Stage:** implementer, then phase-reviewer (read-only), over the uncommitted diff
- **Files produced:** `plugins/gantry/scripts/sentinel-core.js`, `test/sentinel-core.test.js` (both new)

## What the implementer produced

The shared helper: `readSentinel`, `isStale`, `resolveRoot`, `normalize`, `isInList`, `FAIL_OPEN`.
Tests-first, 26 cases covering every path case the plan named (Windows backslash vs POSIX, drive-letter
case, escape-the-root fail-open, missing file_path fail-open, malformed sentinel, stale-by-session-AND-age,
fresh-and-matching). Self-reported `node --test`: 35/35.

## What the review produced

Verdict: **PASS-WITH-NOTES**.

The reviewer re-ran `node --test` itself (not on trust): **35 tests, 35 pass, 0 fail**. It then verified
the phase's hard invariant *in the code*, not just in the test names:

- Fail-open holds on every branch: `normalize` returns the `FAIL_OPEN` symbol on empty/missing input,
  no-root, and escape-root; the outer try/catch converts any unexpected throw to fail-open; `isInList`
  returns allow on `FAIL_OPEN`, a non-array list, or any caught error. No branch can throw to a caller.
  A fail-CLOSED bug here would brick the repo for every opted-in project, so this was the thing to check.
- The staleness rule is genuinely `session-mismatch AND age>6h` (line `return sessionDiffers && ageMs > STALE_MS`),
  with tests proving session-alone and age-alone both return not-stale. A buggy OR would have passed weaker tests.
- Root resolution matches init.js's order exactly.

Three non-blocking notes:
1. A thinking-out-loud comment had drifted into `sentinel-core.js` ("...actually, path.relative on Windows
   handles forward slashes fine..."). Cut.
2. A stale, self-contradicting comment block in the test file. Cut.
3. **Deferred:** `normalize` is host-platform-sensitive (relies on `path.relative` using `path.win32` on
   Windows). Host-independent path matching is out of scope (Windows is the design's pinned primary case);
   logged as a deferred note in the plan.

## Why it was useful

The verdict was not a dramatic FAIL, but the review did the two things a real gate must: it independently
re-ran the verification rather than trusting the implementer's "35/35," and it confirmed the brick-risk
invariant by reading every branch instead of accepting a green test named "fail open." It also caught two
working-note comments before they reached a commit, and surfaced a genuine cross-platform limitation that
is now written down instead of lurking. Notes 1 and 2 were fixed in place; note 3 was deferred with a reason.

## Diff

`git diff --stat` after the two comment cleanups:
```
 plugins/gantry/scripts/sentinel-core.js | (new) ~110 lines
 test/sentinel-core.test.js              | (new) ~290 lines, 26 tests
```
Verification after cleanups: `node --test` -> 35 pass, 0 fail.
