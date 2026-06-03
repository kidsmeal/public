---
description: Drive the active roadmap entry's next gated step (design -> plan -> build -> review) and move the cursor when a phase ships
argument-hint: [phase number, if you want a specific one]
---
Advance the active thread one gated step. The active thread is in `NOW.md` and should point at a roadmap entry; that entry links to its design and plan.

Work out where in the pipeline this entry is, then drive exactly the next step through Gantry, stopping at every human gate:

1. **No design yet** (a named intent): run `/compass:promote` for it first - design, plan, register - then stop for me.
2. **Designed and planned, nothing built:** run `/gantry:build` on the first phase (or phase `$1` if I named one). Tests-first where a framework exists, inside the plan's file list, no spilling into the next phase, no commit.
3. **A phase just built:** run `/gantry:review`, read-only, over the uncommitted diff against the plan and conventions (`CONVENTIONS.md`, falling back to the surrounding code). On FAIL, route the findings back through `/gantry:build` and re-review before any commit. On PASS, stop for me to commit.
4. **A phase just committed:** update `NOW.md` - check off the step, write the next physical action - and tell me the next phase, or that the entry is done.

You never commit, push, or advance past one phase on your own. When an entry's last phase is committed, recommend `/claudhd:shipped` to log it and offer to flip its roadmap row to done. If `NOW.md` has no active thread, show me the roadmap and ask which entry to make active.
