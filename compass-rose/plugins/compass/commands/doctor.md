---
description: Check the workbench for integrity and staleness issues, and offer to fix the safe ones
allowed-tools: Bash(node:*), Read, Edit
argument-hint: [--fix to apply the safe fixes]
---
!`node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js"`

The findings above are a read-only health check of the workbench. Relay them grouped by severity, briefly:

- **Errors** are broken state — a roadmap row linking a missing file, a phase marked committed with a dirty tree. Surface these first.
- **Warnings** are schema gaps — a planned row with no design/plan, an unknown status.
- **Notes** are hygiene and staleness — orphan docs, a standing doc gone stale, a missing audit.

If I passed `--fix` (or ask), apply only the **safe, mechanical** fixes, and show me each diff before writing it: fill an obvious missing roadmap field, re-link an orphan doc whose name matches a row's `id`, advance a clearly-stale `status` marker, or kick off a map regeneration with the cartographer skill. Do **not** auto-resolve anything judgmental — an unresolved design decision, or whether a doc is truly obsolete — flag those for me. Never commit.

End with one gate label as the final line: `=== GATE: HUMAN DECISION REQUIRED ===` if anything needs my call, otherwise `=== GATE: SAFE TO ADVANCE ===`.
