---
description: Bootstrap the Compass Rose workbench - report each instrument's status and the ordered setup steps
allowed-tools: Bash(node:*), Read
---
!`node "${CLAUDE_PLUGIN_ROOT}/scripts/init.js"`

The connector status is printed above. Compass Rose orchestrates the three instruments; it does not re-run their setup or own any state of its own. Finish bootstrapping THIS project - keep it short:

1. Walk the "To finish bootstrapping, in order" line, if present. For each missing instrument, offer to run its setup now, in that order: map the codebase (the **codebase-cartographer** skill - "map this codebase"), then `/claudhd:init`, then `/gantry:init`. Order matters: the map and conventions feed the plan, so Cartographer goes first.
2. State the seam files found (map index, conventions, roadmap), one line each, so I know what `/compass:promote` and `/compass:advance` will read.
3. Tell me the loop I now have, one line: capture an idea -> `/claudhd:quick` (small) or `/compass:promote` (real) -> `/compass:advance` per phase -> commit -> `/claudhd:shipped`. And `/compass:status` for the unified brief. The quick-fixes lane is ClauDHD-native (`/claudhd:quick`).

Do not start any work. This command only reports the workbench's status.

End with one gate label as the final line: `=== GATE: HUMAN DECISION REQUIRED ===` if any instrument still needs installing or a setup choice is open, otherwise `=== GATE: SAFE TO ADVANCE ===`.
