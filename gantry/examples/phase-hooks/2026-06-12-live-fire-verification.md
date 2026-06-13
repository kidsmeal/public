# Phase enforcement hooks - live-fire verification (the real run)

- **Date:** 2026-06-12
- **Project:** Gantry (the hooks running against a live Claude Code session)
- **Plugin under test:** gantry@compass-rose 0.4.1, installed from github.com/kidsmeal/public.git
  via the marketplace git-subdir, loaded after `/plugin update` + a Claude Code restart.
- **Stage:** runtime verification - the check the 84-test unit suite cannot perform.

## Why this exists

The unit tests prove the guard LOGIC: given a stdin payload and a sentinel, each guard returns the
right allow/deny. They cannot prove that Claude Code's plugin host actually discovers
`plugins/gantry/hooks/hooks.json` and routes real tool calls through the guard scripts. That is the
entire "the phase boundary is a hook, not a hope" claim. This run verifies it against a live session.

## Setup

A throwaway scope was armed at the session's project root:
- `.gantry/enabled` (opt-in marker) created.
- `sentinel.js write probe-plan.md 1` wrote `.gantry/active-phase.json` with
  `files: ["livefire-tmp/allowed.txt"]`, a fresh `started`, and `session` stamped from
  `CLAUDE_CODE_SESSION_ID` (confirming the phase-2 session-id wiring).

## The three probes (observed live, verbatim)

1. **Edit `livefire-tmp/blocked.txt` (NOT in the file list) -> DENIED.** The Edit tool call was
   blocked by the PreToolUse hook with:
   > outside phase 1's file list. report this as scope drift, or amend the plan and re-run
   > /gantry:build to widen the phase. (to clear enforcement by hand: delete .gantry/active-phase.json)

2. **Edit `livefire-tmp/allowed.txt` (in the file list) -> ALLOWED.** The edit succeeded. The guard
   does not over-block; it permits exactly what the plan scopes.

3. **`git commit` mid-phase -> DENIED.** The Bash tool call was blocked by the commit guard with:
   > Gantry holds the commit gate. phase 1 is mid-build and not yet reviewed. finish /gantry:review
   > and commit at the gate. (to clear: delete .gantry/active-phase.json)

PASS: A denied, B allowed, C denied.

## What this confirmed beyond the three probes

- **Plugin-host discovery:** `hooks.json` at the plugin root was auto-loaded after the restart, with
  no `plugin.json` hooks key. The plugin-native model works.
- **`${CLAUDE_PLUGIN_ROOT}` expansion:** the hook command `node ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/...`
  resolved to the installed plugin and ran the guard.
- **Opt-in gate:** every tool call earlier in the same session (hundreds of edits, bash calls, git
  commits during the build) was never blocked, because `.gantry/enabled` did not exist yet. The guards
  woke only once the marker AND an active sentinel were present. Enforcement is genuinely opt-in.
- **Windows path normalization:** the Edit targets arrived as absolute Windows paths and were matched
  against the repo-relative POSIX `files` entry, the exact case the cross-platform fix addressed.
- **Fail-safe:** `sentinel.js clear` over Bash lifted enforcement while the guards were live (neither
  guard matches a `node sentinel.js` Bash call), so the session could never get wedged.

## Cleanup

The sentinel was cleared, and the temporary `.gantry/` and `livefire-tmp/` were removed. The repo
returned to its prior state with no residue.

## Verdict

The hooks fire end to end in a live session. P1's central claim - the file-list boundary and the
commit gate are mechanical, not prompt-level - is verified in a real run, not just in tests.
