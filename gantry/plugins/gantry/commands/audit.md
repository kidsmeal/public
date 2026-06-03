---
description: Refresh CURRENTNESS_AUDIT.md - reconcile what the docs claim against what the code and commits show
argument-hint: (none)
---
Update the project's currentness audit so a cold session can tell what is actually current before touching an old plan. The file lives at `CURRENTNESS_AUDIT.md` (project root or `docs/` - find it; if it does not exist yet, run `/gantry:init` first or create it from the template).

This is an **audit snapshot, not a reorganization**. Do not move or rewrite the old docs - correct the audit file instead.

Steps:
1. Gather the signals. Read the roadmap (`ROADMAP.md`/`NOW.md` if present), skim the plan files (`plans/*.md`, `docs/plan_*.md`, `design/*.md`), and read recent history: `git log --oneline -40`. For a large doc set, spawn an Explore subagent to map plan-file -> shipped/stale status rather than reading every file inline.
2. For each significant plan or system, decide its real state from code evidence (Glob/Grep the files it claims), not from the doc's own language:
   - **Trust First** - the current anchors a session should rely on.
   - **Needs Reconciliation** - docs with mixed signals; say exactly which claims are stale and what the code shows instead.
   - **Likely Shipped / Historical** - done; should not pull attention.
3. Rewrite `CURRENTNESS_AUDIT.md` from the template's structure, set its "Last updated" line to today, and keep entries terse (one or two lines each, with the file path and the one-line read).

When done, report: how many plans you classified into each bucket, and the top 1-3 "Needs Reconciliation" items the next session should resolve. Do not change any plan or code file.
