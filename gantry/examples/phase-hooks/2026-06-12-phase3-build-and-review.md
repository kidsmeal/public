# Phase enforcement hooks - Phase 3 build + review

- **Date:** 2026-06-12
- **Project:** Gantry (plain Node.js plugin, zero deps)
- **Plan:** `gantry/docs/phase-hooks-plan.md`, Phase 3 (the two PreToolUse guards)
- **Stage:** implementer -> phase-reviewer (read-only)
- **Files produced:** `plugins/gantry/scripts/hooks/file-list-guard.js`, `plugins/gantry/scripts/hooks/commit-guard.js`, `test/file-list-guard.test.js`, `test/commit-guard.test.js`

The two guard scripts are the actual enforcement: one denies an edit outside the active phase's file
list, the other denies a `git commit`/`git push` while a phase is mid-build. Both fail open on any error.

## Build

The implementer built both guards reusing `sentinel-core.js` for read + path logic, and self-corrected two
real issues mid-build that the plan had not spelled out:

- It started with `/dev/stdin` to read the hook payload, caught that it would fail on the maintainer's
  Windows machine, and switched to `fs.readFileSync(0, "utf8")` (fd 0, cross-platform).
- It handled the `echo "how to git commit"` false-positive by skipping quote-leading segments, so a quoted
  substring is not mistaken for a real `git commit` command head.

Self-reported `node --test`: 79/79.

## Review - PASS-WITH-NOTES

The phase-reviewer re-ran `node --test` itself (79/79) and did four deep checks, since these scripts are the
enforcement surface:

1. **Fail-open invariant.** Traced every branch in both guards plus the top-level try/catch: unparseable
   stdin, missing tool_input/file_path/command, malformed sentinel, unresolvable root, any unexpected throw.
   Every path exits 0; deny is via stdout JSON only; there is no path that exits non-zero or denies on error.
   A fail-CLOSED guard would brick edits for every opted-in project, so this was the thing to confirm in code
   rather than by test name.
2. **commit-guard bypass surface, honestly stated.** Within the "agent drift" threat model (casual
   unintended commits, not a human adversary), the scanner is sound: it catches `git commit`/`git push` at
   command-head positions (start, after `&&` `;` `|` `(`), with flags and a leading `-C`, and correctly does
   NOT fire on `git status`/`git log`, on a quoted substring, or on the orchestrator's own `node sentinel.js`
   call. The residual gaps (variable indirection, `bash -c '...'`, aliases) are active evasion, out of model,
   and were logged as a deferred README "known limitations" note rather than hidden.
3. **Cross-platform + session passthrough.** Confirmed `fs.readFileSync(0)` (not `/dev/stdin`), and that the
   `session_id` from stdin is actually passed into `isStale`, not ignored.
4. **Deny JSON contract.** Exact field names and nesting
   (`hookSpecificOutput.permissionDecision === "deny"`), with the design's actionable messages.

One scope note: an unrelated tracked file (`examples/capsule-castle/GANTRY_EXAMPLES.md`) was modified in the
working tree, unrelated to phase 3. The reviewer flagged it so the human stages only the four phase-3 files
and it does not ride along in the commit. Handled at the commit gate by selective staging.

Verdict: PASS-WITH-NOTES (notes all deferred / commit-hygiene; nothing to fix in the code).

## Why it was useful

This is the enforcement code, so the review's value was confirming the one invariant that cannot be wrong
(fail-open) by reading every branch, and stating the commit-guard's real limits honestly instead of letting
"it blocks git commit" imply more than it delivers. The bypass surface is now written down as a known
limitation rather than discovered later by a skeptical reader.

## Diff

`git diff --stat`:
```
 plugins/gantry/scripts/hooks/file-list-guard.js | (new)
 plugins/gantry/scripts/hooks/commit-guard.js    | (new)
 test/file-list-guard.test.js                    | (new)
 test/commit-guard.test.js                       | (new)
```
Verification: `node --test` from repo root -> 79 pass, 0 fail (27 new).
