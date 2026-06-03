---
description: Print the Compass Rose version and best-effort check the three instruments - confirms the connector is active
allowed-tools: Bash(node:*)
---
!`node "${CLAUDE_PLUGIN_ROOT}/scripts/version.js"`

Relay the version line above verbatim. If any instrument is flagged missing, pass along its one-line install hint. Detection here is best-effort; the authoritative per-project check happens at `/compass:init`. No further action.
