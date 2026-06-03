---
description: The unified brief - where you are, the roadmap horizon, where you are in the pipeline, and one staleness read
allowed-tools: Bash(node:*), Read
---
!`node "${CLAUDE_PLUGIN_ROOT}/scripts/status.js"`

Using the signals above (especially the **Roadmap (the hub)** section) plus `NOW.md`, give me one tight reorientation brief. Answer these five, no padding:

1. **What am I doing?** The active thread, tied to its roadmap feature (id + status + phase). If a Quick fixes batch has items, say how many are waiting.
2. **What's the next physical action?** The single tiny step — derive it from the active feature's `phase_state` (`building` → `in_review` → `ready_to_commit`) and `NOW.md`. Read the plan doc if one is linked.
3. **What's stale?** One honest line from the freshness signals: artifacts the script flags as old, the roadmap `lint` issues, and the drift check (real uncommitted work piling up, or quick fixes clearing while the active thread sits still).
4. **What's blocking me?** Anything `blocked` on the roadmap (with its reason), an unresolved `[NEEDS USER DECISION]`, or a `REVIEW FAILED` gate.
5. **What's safe to ignore?** Done features and the parked / quick batches — name them so I can stop holding them in mind.

Read-only. Re-orient me and stop - do not start work.

End by echoing the current gate as the final line — the one `/compass:advance` would hand back right now: `=== GATE: COMMIT REQUIRED ===`, `=== GATE: REVIEW FAILED ===`, `=== GATE: HUMAN DECISION REQUIRED ===`, `=== GATE: BLOCKED ===`, or `=== GATE: SAFE TO ADVANCE ===`.
