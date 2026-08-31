# Smokeleaf Genetics — Design & Requirements

A RimWorld mod that applies Biotech-style xenogenetics to smokeleaf: plants carry a
genome, genes are heritable with dominance and mutation, and bred strains produce
different effects when harvested and smoked. Does **not** require the Biotech DLC —
it borrows the design language (genes, vigor budget, recombination), not the DLC's code.

Status: design phase. No code yet.

---

## 1. Design pillars

1. **The genome lives in the plant, not the pawn.** Every smokeleaf plant carries a
   `StrainGenome` — a set of genes. Wild/vanilla smokeleaf has an empty genome but can
   spontaneously mutate.
2. **Breeding is probabilistic, like Biotech gene inheritance.** Crossing two strains
   inherits each gene by dominance weight, with a mutation chance. Stabilizing a strain
   takes generations — that's the gameplay loop.
3. **Effects are real hediffs, not flavor text.** Genes change potency, yield, grow
   speed, addictiveness, and add secondary effects (analgesia, couchlock, focus, uplift)
   when the product is smoked.
4. **Balanced by a vigor budget** — the analog of Biotech's metabolic efficiency.
   Positive genes cost vigor, negative genes refund it, research raises the cap.

## 2. Gameplay loop

```
grow wild smokeleaf → mutation appears on a plant → take clipping (≥50% grown)
  → register/refine strain at the strain lab (cross two clippings)
  → assign strain to a growing zone → harvest tagged leaves
  → craft joints (strain carries through) → smoke → gene effects apply
  → cross again to stack/stabilize genes within the vigor budget
```

### Genes (initial set, ~12)

| Gene | Category | Vigor | Effect |
|---|---|---|---|
| Vigorous Growth | Growth | 1 | grow speed ×1.18 |
| Bountiful | Growth | 2 | yield ×1.3 |
| Potent | Potency | 2 | high severity ×1.4 |
| Mellow | Potency | 1 | severity ×0.7, addictiveness ×0.5 |
| Analgesic | Effect | 2 | adds pain-reduction hediff while high |
| Soporific | Effect | 1 | adds couchlock hediff (rest gain, move penalty) |
| Uplifting | Effect | 2 | extra +4 mood thought while high |
| Focusing | Effect | 2 | reduces the consciousness penalty of the high |
| Appetite Suppressant | Effect | 1 | cancels the munchies (hunger rate) |
| Harsh | Negative | −1 | small consciousness penalty when smoked |
| Frail | Negative | −1 | yield ×0.75 |
| Finicky | Negative | −1 | grow speed ×0.85 |

Vigor cap: 3 base → 6 with tier-II research. Roadmap genes (not v1): temperature
tolerance (needs per-instance growth-rate patching), toxicity resistance interplay,
pawn-side xenogene integration (e.g. a "cannabinoid affinity" gene for Biotech owners).

### Inheritance model

- Cross(A, B): for each gene present in either parent, inherit with probability
  `0.5 + dominance` (both parents carrying it → near-certain).
- Mutation roll per cross: small chance to gain a random gene (weighted) or lose one.
- A strain's **stability %** = observed variance across generations; displayed so the
  player knows when a strain "breeds true".

## 3. Technical design

### Data
- `StrainGeneDef : Def` — vigorCost, dominance, mutationWeight, and effect fields
  (growthFactor, yieldFactor, potencyFactor, addictivenessFactor, extraHediff+severity).
- `StrainGenome : IExposable` — gene list + aggregate factor properties + static `Cross()`.
- `StrainManager : GameComponent` — per-save registry of named strains and
  zone→strain assignments.

### Components
- `CompPlantGenome` on smokeleaf plants (vanilla `Plant_Smokeleaf` via XPath patch, plus
  a new sowable `SG_Plant_SmokeleafCultivar` def). Handles wild mutation on spawn and
  strain assignment from the growing zone.
- `CompProductStrain` on `SmokeleafLeaves` and `SmokeleafJoint` (XPath patches) carrying
  the strain through harvest and crafting.

### Harmony patch points (all verified as viable patterns, none written yet)
| Target | Purpose |
|---|---|
| `Plant.GrowthRate` (getter, postfix) | apply genome grow-speed factor |
| `Plant.YieldNow` (postfix) | apply genome yield factor |
| `Plant.PlantCollected` (prefix/finalizer) + `ThingMaker.MakeThing` (postfix) | harvest-context handoff: tag spawned leaves with the plant's strain |
| `GenRecipe.MakeRecipeProducts` (postfix, wrap enumerable) | copy strain comp from leaf ingredients to crafted joints |
| `IngestionOutcomeDoer_GiveHediff.DoIngestionOutcomeSpecial` (postfix) | scale `SmokeleafHigh` severity by potency; add gene hediffs |
| `Zone_Growing.GetGizmos` (postfix) | strain-picker gizmo when the cultivar plant is selected |

### New defs (XML)
Research (2 tiers), the cultivar plant, clipping item, strain lab workbench + recipe/job,
effect hediffs (4–5) with paired ThoughtDefs for mood, placeholder textures borrowed from
vanilla paths until art exists.

### Known hard parts
- **Per-plant data through harvest/crafting** is the riskiest chain (the two-patch
  harvest handoff, and recipe product wrapping). Prototype this first.
- **Sowing carries no item context** in vanilla (zones sow from a `ThingDef`), hence the
  zone→strain registry instead of "plant this clipping".
- **Addictiveness factor** has no single clean patch point; deferred past v1.

## 4. Environments & tooling we need

### To write and compile (any OS, no game install needed)
- **.NET SDK 8+** (the mod targets `net472`; the SDK cross-compiles it fine).
- **[Krafs.Rimworld.Ref](https://www.nuget.org/packages/Krafs.Rimworld.Ref)** NuGet —
  reference assemblies for the game, versioned per RimWorld release (pin `1.6.*`).
  This is what makes CI/cloud compilation possible without owning the game binaries.
- **Lib.Harmony** NuGet (`2.3.*`), referenced but **not** shipped — players get Harmony
  as the standalone workshop mod.
- Optional: **Krafs.Publicizer** for private-member access without reflection.
- IDE: Rider or VS Code with C# extension; nothing exotic.

### To actually run and test (needs a machine with the game — not this cloud session)
- **RimWorld 1.5/1.6** install; mod symlinked or copied into `Mods/`.
- **Dev mode** + debug actions (we'll register `[DebugAction]`s: spawn strain, force
  mutation, cross two strains) — this is the primary test harness.
- **HugsLib Quickstart (standalone)** or vanilla `-quicktest` / `autostart.rws` for
  fast boot into a test map.
- **Hot Swap** (Brrainz) for reloading the assembly without restarting the game.
- **Dubs Performance Analyzer** to check our patches (GrowthRate is hot — the postfix
  must be cheap and cache the genome factor).

### Cloud-session constraints (this environment)
- No .NET SDK installed and no game runtime → we can author XML/C# and later verify
  compilation once an SDK is available, but in-game testing has to happen locally.
- CI (GitHub Actions) can compile against Krafs.Rimworld.Ref on every push and matrix
  across game versions — worth setting up as soon as the csproj exists.

## 5. Milestones

1. **v0 — data layer:** defs, genome, comps, registry, dev-mode debug actions to create
   and cross strains. No UI beyond inspect strings. Prototype the harvest handoff.
2. **v1 — playable loop:** clippings, strain lab job chain, zone strain picker,
   ingestion effects, research gating.
3. **v2 — polish:** strain stability display, naming UI, art, balance pass, update-news.
4. **v3 — integrations:** Smokeleaf Industry Reborn products, Biotech pawn-gene
   interplay, temperature genes.

## 6. Open questions

- Should wild mutation be visible at a glance (overlay icon) or only on inspect?
- Per-strain market value scaling — trading bred strains could trivialize wealth; cap it?
- Do joints from mixed-strain leaf stacks average genomes or take the dominant stack?
- Mod name: working title "Smokeleaf Genetics"; alternatives welcome.
