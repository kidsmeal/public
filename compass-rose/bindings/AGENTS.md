# AGENTS.md — Compass Rose binding for generic agents

Drop this file at your repo root (or merge it into an existing `AGENTS.md`) to run the [Compass Rose](https://github.com/kidsmeal/public/tree/main/compass-rose) methodology under any agent that reads `AGENTS.md` and can run a shell — Codex, Cursor, Aider, CI, etc. It encodes the same contract as [SPEC.md](../SPEC.md); the Claude Code plugins are just another binding of it.

## Where things live

Read these first; they are the project's memory:

- `docs/INDEX.md` — the codebase map (where things are, the golden path, build/run/test).
- `docs/CONVENTIONS.md` — the naming/structure/anti-pattern rules. **Treat as law.**
- `docs/GLOSSARY.md` — domain terms.
- `ROADMAP.md` — the hub: what's in motion, as structured rows (see the schema in SPEC §2).
- `NOW.md` — the single active thread + the next physical action. Read it before doing anything; update it as you go.
- `IDEAS.md` / `SHIPPED.md` — the inbox and the done-log.

## The loop

1. **Capture, don't chase.** A new idea mid-task → append one line to `IDEAS.md`. Keep the active thread.
2. **Triage into a lane** — one question: does it need a *design*, just a *plan*, or *neither*?
   - *Neither* (one file, one sitting): do it now or hold a capped batch (max 3) in `NOW.md`; never let it sprawl.
   - *Just a plan* (multi-step, no design questions): write a short plan, register a roadmap row with `lane: small` (a `plan` link, no design).
   - *A design*: write the design doc, then the plan, register the row with `lane: full` linking both.
3. **Register on the roadmap.** Add/maintain the row per SPEC §2 — it is the single source of truth for the feature's state. Point `NOW.md` at it by `id`; never copy the state.
4. **Build one phase, then stop.** Implement exactly the current phase, tests-first where a framework exists, inside the plan's file list. Do not spill into the next phase. Do not commit.
5. **Review the diff before commit.** Check plan adherence, the conventions, test discipline, and **docs impact** — does this diff move/rename/delete anything the standing docs cite, or add a unit the map should mention? Run `node <cartographer>/scripts/verify.js` if available.
6. **The human commits.** Never commit, push, or resolve ambiguity on your own.
7. **Record.** After commit, append to `SHIPPED.md` and flip the roadmap row's state.

End every step with one gate label as the final line: `=== GATE: SAFE TO ADVANCE ===`, `COMMIT REQUIRED`, `REVIEW FAILED`, `HUMAN DECISION REQUIRED`, `PROMOTION REQUIRED`, or `BLOCKED`.

## Scripts you can run directly

These are plain Node/Python, no Claude dependency. Point them at the repo root:

```
node path/to/compass/scripts/roadmap.js        # parse the roadmap rows + lint
node path/to/compass/scripts/status.js         # repo + roadmap signals for a reorientation brief
node path/to/compass/scripts/doctor.js         # integrity + staleness report
node path/to/cartographer/scripts/verify.js    # every cited path/#anchor still resolves
node path/to/cartographer/scripts/drift.js     # per-doc git drift score
python path/to/cartographer/scripts/scan_repo.py <root>   # inventory for the first map
```

If the scripts aren't present, follow the same rules by hand — they only mechanize checks you could do yourself.

## Rules that don't bend

- One active thread. The roadmap holds many intents; only one is live.
- Conventions are law, not suggestions — a violation is a failed review, not a note.
- No disabled tests, no silent scope creep, no convention drift to make a phase "pass".
- One source of truth per fact. A fact in two files will disagree with itself.
