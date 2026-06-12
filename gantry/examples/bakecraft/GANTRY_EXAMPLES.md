# Gantry examples — BakeCraft

Real runs of the Gantry pipeline on BakeCraft (Flutter 3.44 / Dart 3.12, go_router,
Drift, Supabase — web + mobile), as evidence of what each pipeline stage catches and
produces. Not contrived demos — actual app work.

Every run gets appended as a new `##` section below, newest first. The whole pipeline
trace is captured: planner output, implementer reports, and every reviewer verdict.
Clean PASSes and outright misses get logged too, not only the dramatic catches.
Logging the boring passes and the things Gantry got wrong is what proves nothing here
is cherry-picked.

An entry is three things:

- a one-line header: `<feature> — <stage> — <verdict/outcome> (<date>, commit <sha>)`
- the verdict itself, in the tool's own words. Blockquote the raw planner or reviewer
  output and trim only for length. No justification section; the catch and the diff
  carry it.
- the evidence: a diff for implementation phases, or the corrected design claims for
  design-stage runs.

Entries are meant to be uneven. A three-line clean PASS sits next to a long catch on
purpose.

---

## URL/navigation repair — design-reviewer — 11 violations, 6 fixed in place, 5 escalated (2026-06-12, commit `625eb8a` in bakingapp)

Context: a design doc for an app-wide URL/navigation campaign (96 `context.push`
call sites that never update the browser URL on web; back/forward desync; a
half-shipped pretty-URL system). The draft was authored overnight from a completed
call-site audit, then handed to `gantry:design-reviewer` before the user ever saw
it. The reviewer audited every claim against the live router
(`lib/core/router/app_router.dart`), `slug_utils.dart`, and the shared back-button
widget — and falsified two claims the entire phasing depended on.

Verdict, verbatim (trimmed for length):

> Violations found: 11
> Resolved: 6
> - **D3 helper fallback is factually wrong** (Contract-aware / No-dead-items).
>   Draft: `recipeUrl()` picks pretty "UUID route otherwise." Actual
>   `slug_utils.dart`: returns `/discover` when handle/slug missing, by design.
>   Corrected the claim and propagated the consequence into the private-recipe rule
>   and the done criteria.
> - **D2 "re-declare nested sub-routes from scratch"** (Buildable /
>   No-contradictory-items). Recipe edit/cook/print/versions/nutrition,
>   `/menus/:id/edit`, `/starters/:id/edit`, `/@user/slug/*`, and community
>   sub-routes are ALREADY nested in the live router. Rewrote D2 as
>   verify-and-fill-gaps.
> - **D2 import-flow list incomplete + "they read `?url=`" false** (Buildable).
>   Added the missing routes and documented that `/recipes/new` and file-imports
>   take NO query param — `/recipes/new` is `extra`-only.
> - **D5 was vague "most already do"** (Testable). Replaced with a per-screen extra
>   contract verified against the router.
> - **Done criteria not verifiable** (Testable). "Spot-checked across 22 modules"
>   and "every recipe link" rewritten as grep/Playwright-checkable assertions.
> - **`/admin` lumped into a decision it doesn't need**
>   (No-unresolved-decision-as-prose). It already self-guards in the router;
>   removed from the decision list.
>
> Coherence flags
> - **Cornerstone half-true:** "go_router materializes the pop-stack from nesting"
>   is the doc's load-bearing claim and it only holds for nested routes. Most
>   detail routes are flat siblings, where go() yields a one-page stack and
>   `canPop()` is false.
> - **Back-as-go destroys in-flight form state:** when back becomes `go(parent)`
>   (no pushed page beneath), the editor is disposed and rebuilt, not revealed —
>   unsaved work in `/recipes/:id/edit`, `/recipes/new`, `/journal/new`,
>   `/menus/:id/edit`, `/starters/:id/edit` is lost silently. Fix: dirty-check
>   gate before the `go()`, added as a required Phase 1 item.
> - **`browser-back ≠ logical-parent-back`:** GoBackButton's "trim the last path
>   segment" gives a different destination than the browser's previous history
>   entry on flat routes; after an external deep-link, logical-parent jumps to a
>   list the user never saw.
> - **Two `pushReplacement` sites counted but unassigned:** `menu_editor`
>   (new-menu → detail, load-bearing) routed into Phase 2 as a `go`;
>   `cookbook_dock` swap-without-history called out so the sweep doesn't convert
>   it to a stacking `push`.
>
> Ready for phase planning: no — pending 5 user decisions (2 of them, flat-route
> nesting and the `recipeUrl()` fallback, block Phases 1–3 because they change
> per-route work and whether the helper gets rewritten).

Why this entry matters: the two falsified claims (the `recipeUrl()` fallback and the
"already nested" routes) were not style nits — one would have produced a phase plan
that rewrote a shipped helper's deliberate no-UUID-leak design by accident, and the
other budgeted a from-scratch router rework for nesting that already existed. The
form-state-loss flag turned a silent data-loss bug into a required phase work item
before any code was written. The doc that reached the user the next morning carried
five `[NEEDS USER DECISION]` markers instead of five hidden assumptions.

Outcome: revised doc committed as `plans/url_navigation_repair.md` (bakingapp
`625eb8a`), grilling scheduled before `gantry:plan`.
