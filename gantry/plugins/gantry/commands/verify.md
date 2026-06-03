---
description: Add to / refresh the runtime verification queue - the list of shipped-but-unverified work that still needs a real run
argument-hint: [feature or area to add] | (none = sweep recent work)
---
Maintain the project's runtime verification queue: the gap between "passes the test suite" and "confirmed working in a real run / on a real device or browser". The file lives at `RUNTIME_VERIFICATION_QUEUE.md` (project root or `docs/`; if missing, run `/gantry:init` first or create it from the template).

Each item separates **what the code/tests already prove** from **the manual check still owed**, and names an explicit **Close when** condition.

Two modes:

- **With an argument** (`$ARGUMENTS` names a feature or area): add or update one entry for it. Read the relevant code to fill in "Code checks already done" (what is provably wired) and write the precise "Manual check" steps with pass conditions, plus a "Close when". Do not invent checks the feature does not need.

- **No argument**: sweep recently shipped work (`git log --oneline -25`) for features that landed code-complete but whose behavior only a real run can confirm - sync/migration on real data, cross-platform or cross-browser rendering, device-only paths, anything behind a flag. Propose new queue entries for the ones not already listed, and flag any existing entry whose "Close when" now looks satisfied so I can retire it.

Keep entries terse and update the file's "Last updated" line. Report what you added, updated, or marked closeable. Do not perform the manual checks yourself - this command curates the queue; the human (or a preview/device run) closes the items.
