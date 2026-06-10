---
description: Quick fixes are owned by ClauDHD - this forwards to the native lane (/claudhd:quick)
argument-hint: [a quick fix to add; omit to clear the batch]
---
The quick-fixes lane is owned by **ClauDHD**, which owns `NOW.md`. Compass Rose does not reimplement it — it points you at the native command:

- Add a small, self-contained chore: `/claudhd:quick <text>`
- Clear the batch in one focused pass: `/claudhd:quick`

The gate is the same Gantry-shaped test Compass Rose uses everywhere: if it needs a design, multiple phases, or a review-worthy diff, it is not a quick fix — send it down the full lane with `/compass:promote` instead.

If `$ARGUMENTS` is non-empty, run `/claudhd:quick $ARGUMENTS` for me now. Otherwise run `/claudhd:quick` to clear the batch.

When a fix turns out to need a design, spans multiple phases, or would produce a review-worthy diff — or when a batch item balloons mid-pass into something larger — end the response with exactly:

```
=== GATE: PROMOTION REQUIRED ===
```

as the final line, and point at `/compass:promote` (or `/compass:promote --small` if it needs a plan but no design) to move it to the right lane.
