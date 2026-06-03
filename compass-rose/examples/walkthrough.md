# Walkthrough — one feature, end to end

A single fictional feature ("export a report to CSV") traced through every Compass Rose artifact, with the real file contents at each step. The point is to let you judge whether the ceremony is worth it before adopting it. Lanes and gate labels are from [SPEC.md](../SPEC.md).

---

### 1. Capture (don't chase)

Mid-task, the idea strikes. One line to `IDEAS.md`, then back to work:

```md
## Inbox
- [ ] 2026-06-03 14:02 (while: fixing the auth redirect) let users export the report to CSV
```

### 2. Triage → pick a lane

Later, `/claudhd:triage`. The question: design, just a plan, or neither? CSV has real open questions — which dialect? stream or buffer? how are commas/newlines escaped? → **full lane**. (A one-file rename would have been quick; a mechanical multi-file change with no open questions would have been `--small`.)

### 3. Design (full lane) → `docs/designs/csv-export.md`

`/compass:promote` grills the decisions, grounded in the map, then writes:

```md
# Design — CSV export

## Problem
Users want the report as a spreadsheet-friendly file. Today it only renders as HTML.

## Decisions
- **Dialect:** RFC 4180 (CRLF rows, `"`-quoted fields, `""` escaping). Excel-compatible.
- **Streaming:** stream rows — reports can exceed memory.
- **Surface:** `GET /reports/:id/export.csv`, reusing the existing report query.

## Contracts touched
- New route. No change to the report JSON contract.

## Out of scope
- XLSX, scheduled exports.
```

### 4. Plan → `docs/plans/csv-export-plan.md`

`/gantry:plan` turns the settled design into verifiable phases:

```md
# Plan — CSV export  (roadmap_id: csv-export)

## Phase 1 — CSV encoder
- Files: src/export/csv.ts, src/export/csv.test.ts
- Verify: `npm test src/export/csv.test.ts`
- Exit: encodes rows per RFC 4180; commas, quotes, newlines escaped; covered by tests.

## Phase 2 — streaming route
- Files: src/routes/reports.ts, src/routes/reports.test.ts
- Verify: `npm test src/routes`
- Exit: GET /reports/:id/export.csv streams the encoder over the report query.
```

### 5. Register on the roadmap → a row in `docs/ROADMAP.md`

The hub. The single source of truth for state; the plan and `NOW.md` point back by `id`:

```md
## Now
- [ ] CSV export  <!-- id: csv-export -->
  - status: planned
  - active_phase: 0
  - phase_state: —
  - lane: full
  - idea: IDEAS.md "export the report to CSV"
  - design: docs/designs/csv-export.md
  - plan: docs/plans/csv-export-plan.md
  - blocked_by: —
```

### 6. Activate → `NOW.md`

The active thread is just the read-head on that row:

```md
## Active thread (only one)
**CSV export — phase 1 (encoder)**  · roadmap: csv-export

Next physical action:
- [ ] write the failing test for comma/quote escaping in src/export/csv.test.ts
```

### 7. Build phase 1, then review the diff

`/compass:advance` runs the implementer (tests-first, inside the file list, no commit), then the reviewer. The reviewer returns:

```md
# Phase 1 Review — PASS-WITH-NOTES

Verdict: PASS-WITH-NOTES
## Plan adherence
- check: only src/export/csv.{ts,test.ts} touched
## Test discipline
- check: escaping cases covered; nothing skipped
## Exit criteria
- check: RFC 4180 encoding verified at src/export/csv.test.ts:41
## Docs impact
- docs/INDEX.md "Modules" — adds a new `export/` module not yet in the map; add it when phase 2 lands the route.

=== GATE: COMMIT REQUIRED ===
```

The row advances: `phase_state: ready_to_commit`. The human commits. (On a FAIL, findings go back through build and re-review first.)

### 8. Record → `SHIPPED.md`, and close the row

After the last phase commits:

```md
## Shipped
- **CSV export (RFC 4180, streaming).** GET /reports/:id/export.csv streams a spec-compliant encoder over the report query. (csv-export)
```

`docs/ROADMAP.md`: the row flips to `status: done`. The map gets its `export/` module entry (the docs-impact note from step 7). The trail back is intact: shipped line → phase → plan → design → roadmap row → the original `IDEAS.md` one-liner.

---

**What the ceremony bought:** the design question (dialect/streaming) was settled *before* code; the build never spilled past one phase; the diff was reviewed before commit; and the moment the new module appeared, the map was flagged stale — so nobody trusts a map that's missing it a week later. For a one-line rename, none of this fires — that's the quick lane. The cost scales with the work.
