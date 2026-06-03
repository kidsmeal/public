---
description: Take a triaged idea down the full lane - Gantry design author grounded in the map, then register it on the roadmap
argument-hint: <the idea to promote, in your own words or an IDEAS.md line>
---
Promote this idea down Compass Rose's full lane: $ARGUMENTS

This is the seam from triage to a buildable, registered plan. Do it in order, and do not write code:

1. **Ground it in the map.** First read the codebase map and glossary if they exist - `docs/INDEX.md` (or `INDEX.md`) and `docs/GLOSSARY.md` - so the design starts oriented to where things actually live and what the terms mean. If there is no map, say so and proceed from the code directly.
2. **Design.** Run the **design-plan-creator** skill (Gantry's `/gantry:draft`): grill me through the open decisions one branch at a time - data/model, scope, behavior, contracts, edge cases - resolving each against the real codebase, then write the structured design doc. Grill first, write once.
3. **Audit, then plan.** Once the design is settled, take it through `/gantry:design` (resolve any `[NEEDS USER DECISION]`), then `/gantry:plan` to produce the phased plan. Surface any unresolved question as a blocker rather than guessing.
4. **Register on the roadmap.** Add a row to the roadmap (`docs/ROADMAP.md` or `ROADMAP.md`) for this work that links to BOTH the design doc and the plan doc, with a one-line statement of what it delivers. The roadmap is the hub - this row is how the cursor finds the design and plan later.
5. **Hand off.** Tell me the design and plan paths and the roadmap row. Recommend `/compass:advance` to build the first phase once I make this the active thread, and offer to mark the source idea promoted (`[~]`) in `IDEAS.md`.

If `$ARGUMENTS` is empty, ask which idea to promote - or read the untriaged items in `IDEAS.md` and offer them. If the project is not initialized, run `/compass:init` first. This is the heavy lane: anything small enough to skip a design or a review gate belongs in `/compass:quick` instead.

End your response with exactly one gate label as the final line: `=== GATE: HUMAN DECISION REQUIRED ===` if any `[NEEDS USER DECISION]` or open design question remains, otherwise `=== GATE: SAFE TO ADVANCE ===` once the design and plan are written and the roadmap row is registered.
