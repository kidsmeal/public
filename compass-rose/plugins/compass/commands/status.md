---
description: The unified brief - where you are, the roadmap horizon, where you are in the pipeline, and one staleness read
allowed-tools: Bash(node:*), Read
---
!`node "${CLAUDE_PLUGIN_ROOT}/scripts/status.js"`

Using the signals above plus the contents of `NOW.md` and the roadmap, give me one tight brief across all three instruments. No padding:

1. **Heading.** The one active thread and its next physical action, from `NOW.md`. If a Quick fixes batch has items, say how many are waiting.
2. **On the roadmap.** The active entry and the next one or two - and whether the active one has a linked design + plan yet (full lane) or is still a named intent.
3. **In the pipeline.** If a Gantry plan is in flight, which phase is next and whether the last diff was reviewed. Read the plan doc if `NOW.md` points at one.
4. **Staleness read.** One honest line folding the three freshness signals: any artifact the script flags as old, anything the currentness audit lists as needing reconciliation, and the drift check - real uncommitted work piling up, or quick fixes clearing while the active thread sits still (avoidance).
5. **One next action.** The single tiny step to make progress on the active thread right now.

Read-only. Re-orient me and stop - do not start work.

End by echoing the current gate as the final line — the one `/compass:advance` would hand back right now: `=== GATE: COMMIT REQUIRED ===`, `=== GATE: REVIEW FAILED ===`, `=== GATE: HUMAN DECISION REQUIRED ===`, `=== GATE: BLOCKED ===`, or `=== GATE: SAFE TO ADVANCE ===`.
