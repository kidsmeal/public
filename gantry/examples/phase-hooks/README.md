# Gantry example - phase enforcement hooks (Gantry on Gantry)

A real run of the Gantry pipeline on Gantry itself: the design and build of the PreToolUse
enforcement hooks (the file-list guard and the commit guard). The feature is Gantry making its
own two softest contract claims mechanical, so the run doubles as a record of what each pipeline
stage produced and caught on work with real stakes.

This is a dogfood run, separate from the capsule-castle showcase.

## Files

One file per pipeline stage, in order:

- `2026-06-12-phase-hooks-design-review.md` - the design gate (design-reviewer), two rounds.
- `2026-06-12-phase1-build-and-review.md` - shared helper, build and review (clean).
- `2026-06-12-phase2-build-fail-fix-pass.md` - sentinel writer, a FAIL then fix then re-review PASS.
- `2026-06-12-phase3-build-and-review.md` - the two guards, build and review.
- `2026-06-12-phase4-build-and-review.md` - hook registration and init opt-in, build and review.
- `2026-06-12-phase5-build-fail-fix-pass.md` - orchestrator wiring, a consent FAIL then fix then PASS.
- `2026-06-12-live-fire-verification.md` - the guards firing in a live session.

## What this run shows

The gates ran on every phase, and the design gate and two phase reviews returned FAIL on
concrete, buildable problems that were then fixed and re-reviewed.

The clearest example is the phase-5 consent bug. Phase 4 shipped an `init.js` that wrote the
enforcement opt-in marker unconditionally. Its unit test was green, because the test asserted
that wrong behavior. The next gate caught the contradiction between the code and the design's
stated opt-in rule, and phase 5 fixed it. That is the case worth pointing at: a passing suite
that encoded the wrong contract, caught by a reviewer reading the code against the design.

What Gantry contributes here is not a catch a careful reviewer could not make. Every problem in
this run is the kind a second reader finds by checking the code against the real environment and
the real artifacts instead of the implementation's own fixtures. The value is that Gantry makes
that second read happen on every phase as a gate, rather than leaving it to whoever remembers to
do it. The pitch is that the second read is mandatory, not that the gate sees what a human cannot.

## What this run does not show

It does not isolate "the gate caught it" from "a careful operator caught it." A human (Claude in
the orchestrating loop) drove the pipeline, and in at least two places that human, not a gate,
caught the problem: the implementer twice misreported its test count (146 and 178 against real
counts of 52 and 84), caught by re-running the suite, and a slash-command argument bug was worked
around by hand. The FAIL-then-fix sequences also live in git as single per-phase commits plus this
narration, not as separate failing-then-fixed commits, so the failing state cannot be replayed
from history alone.

Read this as a worked record of one operator-in-the-loop run, not a controlled experiment that
isolates the gates as the cause. The missing comparison is a control run: the same feature, plain
Claude, no Gantry, to see what differs.
