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

## Balance sim harness — Phase 1 — phase-reviewer — PASS-WITH-NOTES → PASS (2026-06-12)

Plan: `design/balance_sim_harness_design-plan.md` (P1 — production seams). Five sim-mode seams
(hitstop no-op, `setup_all()` randomize guard, XP-freeze, GlobalState `get_equipped_heroes`
forwarder, loot `set_seed`) + an `aura_system` null-guard. Suite green 1856/0 both passes.

**First pass — PASS-WITH-NOTES.** Two findings worth more than the green suite:

> **Cross-cutting FAIL — the GlobalState forwarder silently changes gameplay.** Before the forwarder,
> `globals.has_method("get_equipped_heroes")` returned false, so `castle_roaming_heroes_controller`
> `_get_equipped_hero_ids()` always returned empty and equipped heroes were shown roaming the castle
> hub. The forwarder (added so `hero_spawn_manager` stops falling back to `hero_p_1`) makes the method
> exist → `_get_roaming_hero_ids()` now excludes equipped heroes → they stop roaming. The spawn fix is
> correct; this is a real, undocumented side effect on a second caller that should be a conscious
> decision, not a silent consequence of a sim seam.

> **Test-discipline FAIL — the one seam this phase exists to prove has no real coverage.**
> `test_loot_generator_seeded_instances_produce_identical_rolls` called `set_seed(42)` on two
> LootGenerators then ignored them and compared two fresh inline `RandomNumberGenerator`s — asserting
> Godot's RNG-is-deterministic guarantee, not that `LootGenerator.set_seed()` pins the generator. It
> would pass even if `set_seed` were a no-op.

The roaming side effect went to the human: decision was "equipped heroes correctly stop roaming"
(latent double-display bug, incidentally fixed) — commit-body note, no code change. The weak test
was rewritten to drive each generator's real `_rng` and assert same-seed-identical AND
different-seed-divergent (the no-op detector). A StubHero `_process` cleanup silenced spurious
`update`-on-Nil errors the tests had been printing.

**Second pass — PASS.** Confirmed no production code changed in the fix pass (the six seam files
byte-identical to first pass), the rewritten loot test genuinely depends on `set_seed`, the StubHero
noise is gone. One deferred note to P2 (promote the inline `"sim_mode"` string to a shared const).

### Diff

Seams (`git diff --stat`, production):

```
 battlegrounds/battleground_setup_orchestrator.gd | randomize() guarded behind Engine.has_meta("sim_mode")
 systems/combat/hitstop.gd                        | trigger() no-ops under sim flag
 heroes/hero_base.gd                              | add_experience() early-returns under sim flag
 systems/global_variables.gd                      | + get_equipped_heroes()/get_hero_selection_pool() forwarders
 systems/loot/loot_generator.gd                   | + set_seed(seed_value) (additive; _init still randomizes)
 enemy/components/aura_system.gd                  | null-guard refresh_leech_aura_visual (elite spawn wave >=5)
 tests/test_sim_seams.gd                          | 15 seam tests (loot-seam test rewritten in fix pass)
```

---

## Balance sim harness — Phase 0 — implementer — feasibility spike, gate PASSES (2026-06-12, uncommitted throwaway)

Plan: `design/balance_sim_harness_design-plan.md` (P0 — throwaway feasibility spike, no assertions).
The gate: prove a headless `castle_grounds2` run is possible, pick the fast-forward lever, measure
variance. Implementer ran the real scene headless and reported, verbatim-trimmed:

> **(a) minutes-per-10-wave:** baseline (no lever) 5.56 min/10-wave (timed out at 9 waves). Lever A
> (`time_scale=8`) WITHOUT the Hitstop seam died in 19s/1 wave — ineffective, because Hitstop resets
> `Engine.time_scale` to 0.05 on every hit. Theoretical with Lever A + a Hitstop seam: ~0.625
> min/10-wave (37.5s). **Under the ~1-min gate, so scope does not shrink.**

> **(b) chosen lever:** Lever A — `Engine.time_scale = 8.0` + `Engine.max_physics_steps_per_frame =
> 32`, set in-process. **Requires a Hitstop no-op seam in P1** or it does nothing.

> **(c) variance table:** all three probed metrics came back record-only (bands ±32% to ±250%).
> Cause is the critical finding below, not real balance noise — the variance table is NOT yet
> meaningful and must be re-measured after P1.

> **Critical finding not in the plan — extreme bimodal variance.** Same seed → 0 to 10 waves across
> runs, because (1) GlobalState isn't fully reset between probes (hero XP/level carries over) and (2)
> Hitstop interference with `time_scale=8` is chaotic. Bands can't be derived until P1 lands full
> state reset + XP-freeze + Hitstop seam + the `randomize()` guard.

> **Modal stall — confirmed (Blocker 3).** `battleground2.tscn` has a real CanvasLayer, so
> `setup_upgrade_screen` makes `upgrade_screen` non-null; on level-up `scene_tree.paused = true`
> stalls the run. The queue-drain fallback only works when `upgrade_screen == null`, which it isn't.
> P1 MUST add an XP-freeze seam.

> **Loadout field — confirmed (Blocker 4).** `GlobalState` does not forward `get_equipped_heroes()`
> (it lives on `hero_mgr.hero_roster`), so `hero_spawn_manager` silently falls back to `hero_p_1`
> every run. P1 adds forwarding methods so sticker/base_tier entries attach to the right heroes.

> **Null-guards for P1:** `AuraSystem.refresh_leech_aura_visual` (aura_system.gd:61) null
> `get_node_or_null` when elites spawn (wave ≥5), pre-existing; `SaveSystem.request_autosave` fires
> on wave-end and writes to `user://saves/` — the harness must suppress this.

### Why it's a good gate

P0 is a throwaway with no assertions, and its whole value was negative results found cheaply: the
chosen lever is inert without a seam that doesn't exist yet, and the variance table the plan expected
P0 to deliver is meaningless until P1's determinism seams land. Both reorder the work — bands move to
after P1 — and both were found by running the real scene once, before any production code. The gate
question ("can a 10-wave run get under a minute?") is answered yes (~0.625 min with lever+seam).

### Diff

Throwaway, uncommitted, all under `tools/dev_scripts/` (not `tests/`):

```
 tools/dev_scripts/sim_spike.gd            | 510   (spike: boot, seed, lever A/B/C, variance probe)
 tools/dev_scripts/sim_spike.tscn          |   6
 tools/dev_scripts/sim_run_end_stub.gd     |  13   (RunEndController subclass: flag instead of scene change)
 tools/dev_scripts/sim_spike_findings.md   | 179   (the three artifacts + P1 seam list)
```

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
