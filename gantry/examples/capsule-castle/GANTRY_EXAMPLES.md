# Gantry examples — Capsule Castle

Real runs of the Gantry pipeline on Capsule Castle (Godot 4.6 / GDScript), as evidence of what
each pipeline stage catches and produces. Not contrived demos — actual game work.

Every run gets appended as a new `##` section below, newest first. The whole pipeline trace is
captured: planner output, implementer reports, and every phase-reviewer verdict. That means clean
PASS and outright misses too, not only the dramatic catches. Logging the boring passes and the
things Gantry got wrong is what proves nothing here is cherry-picked.

An entry is three things:

- a one-line header: `<feature> — Phase <N> — <stage> — <verdict/outcome> (<date>, commit <sha>)`
- the verdict itself, in the tool's own words. Blockquote the raw planner or reviewer output and
  trim only for length. No justification section; the catch and the diff carry it.
- the diff: `git diff --stat` plus the key hunk the finding was about (`--stat` alone is fine for a
  large generated-data diff).

Entries are meant to be uneven. A three-line clean PASS sits next to a long catch on purpose.

---

## Balance sim harness — phase-planner — 5-phase plan, 0 P0 blockers (2026-06-12, plan `design/balance_sim_harness_design-plan.md`)

Design: `design/balance_sim_harness_design.md` (GRILLED + LOCKED). A seeded headless simulator
(third test tier next to unit + integration). Planner ran before any code and grounded the locked
design against the real source. Three findings, verbatim from the plan's grounding notes and
blockers:

> **No wave signals exist.** `wave_flow_controller.gd` has none; BRC
> (`battleground_runtime_core.gd`) drives waves through `wave_state.current_wave`,
> `_check_wave_end()` -> `_complete_run()` -> `_run_end_controller.end_run()`, and
> `_trigger_game_over()`. The harness observes `wave_state.current_wave` (poll per frame) and
> detects run-end by intercepting before/around `end_run()`, NOT by subscribing to a signal.
> (Design says "subscribe to wave signals"; reality is poll + run-end hook.)

> **`battleground_setup_orchestrator.setup_all()` calls bare `randomize()` at line 31**,
> re-seeding the GLOBAL RNG every run AFTER the harness would have seeded it. This is the single
> biggest determinism trap. P0 must measure variance with and without neutralizing it; P1 must
> add a sim-mode guard so `setup_all()` does not clobber the seed.

> **(confirm during P0) The exact loadout field the spawn manager reads.** `hero_spawn_manager`
> reads `get_equipped_heroes`/`get_hero_selection_pool`, not `active_run_loadout` directly. P0 step
> 1 must confirm which path actually populates heroes headless and have the harness write THAT, so
> sticker/base_tier entries (locked decision 2) attach to the right heroes.

Plan shape: 5 phases (P0 feasibility gate + P1–P4), per-phase Goal/Files/Verification/Exit, plus a
Cross-cutting section (RNG seam, state snapshot/restore, time_scale/hitstop, modal suppression,
orphan/teardown). P0 is the gate; P1+ can't be finalized until P0's outputs land.

### Diff

New file `design/balance_sim_harness_design-plan.md` (359 lines). No code touched (planner is plan-only).

---

## Implicit importer — Phase 3 — phase-reviewer — PASS-WITH-NOTES → PASS (2026-06-12, commit `eff30a1a`)

Plan: `design/implicit_import_plan.md` (Phase 3 — consumers + UI). Reviewed uncommitted, landed `eff30a1a`. Two passes.

**First pass — `PASS-WITH-NOTES`.** Confirmed the three new stat keys were genuinely consumed (not
stubbed) and the drop-gating math correct, then flagged one bug and two quality notes:

> **Fix-now note:** `ui/debug_buttons.gd:605` — `(cat_keys_variant as Array[StringName]).duplicate()`.
> The catalog now stores PLAIN untyped arrays, so `untyped Array as Array[StringName]` does not
> convert and yields an empty array — the exact failure mode just fixed in `loot_generator`. Only
> fires in the debug "force base onto generated item" fallback, so it won't hit normal play, but a
> debug-added sticker can silently lose its implicit keys. Fix with `.assign()`.

> **Deferred note:** four tests in `test_implicit_pipeline_phase3.gd` reimplement the production
> formula locally and assert the reimplementation, so they pass even if the real getters were
> reverted — false confidence.

> **Deferred note:** stale what-comment at `loot_generator.gd:566-568` describes a guard that
> isn't in that function.

**Second pass (after the fix) — `PASS`.** Confirmed `.assign()` was the right conversion
(`generated.implicit_stat_keys` is `Array[StringName]`), the four tests now drive real production
code (`_AttrHero`/`_StatHero` + the real `LootGenerator` builder), and the stale comment was gone.

**What the reviewer did not catch:** the bigger bug this phase, a `const`/typed-array parse error
that silently registered zero of 1828 bases, was caught by the pipeline's run-the-verification rule
(a headless test run), not by the reviewer's read. Logged here because the point is what each
mechanism actually does.

### Diff

`git diff --stat` for the phase (excluding ~494 reorganized `art/**/*.png.import` files):

```
 battlegrounds/wall_defense_aggregator.gd        |     5 +-
 design/implicit_import_plan.md                  |     5 +-
 heroes/hero_base.gd                             |    12 +-
 stickers/sticker_base_catalog_generated.gd      | 18288 +++++++++++++++++++++-   (generated catalog, 1828 bases)
 systems/loot/loot_generator.gd                  |    52 +-
 tests/test_armory_sticker_drawer_grid_render.gd |    13 +-
 tests/test_armory_sticker_equip.gd              |    13 +-
 tests/test_debug_buttons_sticker_keys.gd        |    11 +-
 tests/test_implicit_pipeline_phase3.gd          |   294 +
 tests/test_import_sticker_implicits.py          |    19 +-
 tools/dev_scripts/import_sticker_implicits.py   |    24 +-
 tools/dev_scripts/sticker_implicits.json        |  9229 +++++++++++          (editor export, importer input)
 ui/debug_buttons.gd                             |    66 +-
```

The hunk the fix-now finding was about:

```gdscript
# ui/debug_buttons.gd — before (silently produced an empty array):
		if typeof(cat_keys_variant) == TYPE_ARRAY:
			generated.implicit_stat_keys = (cat_keys_variant as Array[StringName]).duplicate()

# after:
		if typeof(cat_keys_variant) == TYPE_ARRAY:
			# Catalog arrays are plain (untyped); assign() converts to the typed
			# property. A bare `as Array[StringName]` cast would yield an empty array.
			var keys: Array[StringName] = []
			keys.assign(cat_keys_variant as Array)
			generated.implicit_stat_keys = keys
```

Outcome: full unit suite 1841/0, importer pytest 30/0, phase re-reviewed PASS, committed `eff30a1a`.
