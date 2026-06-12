# Gantry example - phase enforcement hooks (Gantry on Gantry)

A real run of the Gantry pipeline on Gantry itself: the design and build of the PreToolUse
enforcement hooks (the file-list guard and the commit guard). The feature is Gantry making
its own two softest contract claims mechanical, so the run doubles as evidence of what each
pipeline stage catches on work with real stakes.

This is a dogfood run, separate from the capsule-castle showcase. The point is the same:
show the gates failing real things and the fixes that follow, not a contrived demo.

## Files

One file per pipeline stage, in order:

- `2026-06-12-phase-hooks-design-review.md` - the design gate (design-reviewer), two rounds.
- (plan, build, and phase-review stages append here as the run proceeds.)

## What this run is evidence of

The design gate alone returned a FAIL-equivalent verdict twice before any code was written,
each time on a concrete, buildable problem (a self-blocking deadlock, a wrong premise about
the test setup, a broken fix-loop under the new guard). A review gate that has never failed
anything is theater; this one failed real things and the design was better for it.
