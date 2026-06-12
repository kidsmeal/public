# Phase enforcement hooks - Phase 4 build + review

- **Date:** 2026-06-12
- **Project:** Gantry (plain Node.js plugin, zero deps)
- **Plan:** `gantry/docs/phase-hooks-plan.md`, Phase 4 (plugin-native hook registration + init.js opt-in + .gitignore)
- **Stage:** implementer -> phase-reviewer (read-only)
- **Files produced:** `plugins/gantry/hooks/hooks.json` (new), `plugins/gantry/scripts/init.js` (modified), `test/init.test.js` (modified)

## Build

The implementer created `hooks.json` (two PreToolUse entries pointing at the phase-3 guards via
`${CLAUDE_PLUGIN_ROOT}`), added a `CLAUDE_PLUGIN_ROOT`-gated opt-in block to `init.js` that writes the
`.gantry/enabled` marker and idempotently ensures `.gantry/active-phase.json` is gitignored, and added four
test cases. Self-reported `node --test`: 83/83.

A trap worth noting: the host environment running these tests has `CLAUDE_PLUGIN_ROOT` set, so a naive
"unset" test would pass falsely by inheriting it. The implementer added a `runEnv` helper that deletes the
key from the child env, so the unset case genuinely exercises the no-opt-in path.

## Review - FAIL (working-tree scope), code clean

The reviewer re-ran `node --test` (83/83) and confirmed the phase-4 code on every axis: hooks.json is valid
JSON with the right matchers and command paths that resolve to the real guard files; the init opt-in is
correctly gated on `CLAUDE_PLUGIN_ROOT`; the `.gitignore` handling is additive and idempotent (create when
absent, append once when missing, no-op when present) and never overwrites; the host-env-leak trap is
handled; `plugin.json` was correctly left untouched; and the tests sandbox to temp dirs with no real-repo
pollution.

It still returned FAIL, for one reason: an unrelated file (`examples/capsule-castle/GANTRY_EXAMPLES.md`, a
different feature's example entry) was modified in the same uncommitted working set. The review contract
treats any uncommitted scope drift as a fail, not a note. The implementer had not touched that file (its own
scope report said "none"); it was a pre-existing working-tree modification owned by the maintainer.

Resolution: the file is excluded from the commit by selective staging (NOT reverted, since it is the
maintainer's own in-progress work). The reviewer's stated outcome: "Once that single file is out, this phase
is a clean PASS - no code changes are needed."

## Why it was useful

Two things. First, the host-env-leak trap is a real testing footgun the gate would have caught had the
implementer missed it (a falsely-passing "unset" test). Second, the gate enforces that a commit contains
only the phase's diff: it refused to wave through a working set that carried an unrelated file, even though
that file was not the implementer's doing. Strict scope at the commit boundary is the point of the gate, and
it held even when the drift came from outside the phase.

One correctness claim the unit suite cannot reach was logged as a runtime-verification item: whether
`hooks.json` is actually auto-discovered and the guards fire in a LIVE Claude Code session. That must be
checked by hand before P1 is called done.

## Diff (phase-4 files only)
```
 plugins/gantry/hooks/hooks.json | (new) two PreToolUse entries
 plugins/gantry/scripts/init.js  | + CLAUDE_PLUGIN_ROOT-gated opt-in (marker + .gitignore)
 test/init.test.js               | + 4 cases, runEnv helper
```
Verification: `node --test` from repo root -> 83 pass, 0 fail (4 new).
