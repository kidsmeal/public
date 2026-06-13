# Cartographer improvement plan

Date: 2026-06-12. Source: third-party review of the plugin (agent-facing value) plus the
remaining items from Compass Rose Workstream C (see compass-rose/ROADMAP.md, "Workstream C").

## Where we are

Shipped and working: verify.js (cited paths + anchors), drift.js (per-doc commit-count
scoring), the refresh workflow in SKILL.md, the low-drift authoring rules, and the C1
diff-impact signal in Gantry's phase-reviewer. Tests cover verify, drift, refs, and the
roadmap template.

The review's verdict: the generation prompt plus the trust layer (verified citations,
runnable freshness checks) is the differentiator. The gaps are all on the trust layer's
edges:

1. Freshness checks are pull, not push. Nothing tells an agent mid-session that the file it
   just moved is cited by the map. C1 covers this only for repos running the Gantry
   pipeline; standalone Cartographer users get nothing at edit time.
2. drift.js measures churn, not wrongness, but reports "STALE" with full confidence. A hot
   file the map cites correctly flags forever and trains alarm fatigue. Scoring is also
   per-doc, so one churny section taints a whole INDEX.
3. verify.js stops at paths and anchors. A map can be link-clean and still claim the wrong
   wiring. The C3 entry named "anchors/symbols" but only anchors shipped.
4. The highest-leverage agent use case, briefing subagents with one map slice instead of
   having each rediscover the repo, has no tooling and isn't documented as a pattern.

## Phase 1 — edit-time drift hook (push, not pull)

The biggest gap. A PostToolUse hook (Edit, Write) in the plugin that checks whether the
touched file is cited by any standing doc (INDEX, GLOSSARY, CONVENTIONS, ROADMAP,
docs/map/*, CLAUDE.md) and, if so, emits a one-line note: "docs/INDEX.md cites this file;
check the map if you moved or renamed it." Note only, never blocking.

- New `plugins/cartographer/hooks/` with the hook script, reusing `scripts/refs.js` for
  citation extraction. Register in plugin.json. Follow the hook patterns just built for
  Gantry (path normalization lessons included).
- Noise control: fire only when the edited path resolves to a cited path; dedupe per
  session per file (sentinel file in the session temp dir) so the same edit stream doesn't
  repeat the warning.
- Cheap by construction: parse only the standing docs (small), no git calls.
- Tests: cited file edited -> note; uncited file -> silence; second edit to same file ->
  silence; docs absent -> silence. Must pass on the ubuntu/macos/windows CI matrix.

Exit: an agent that edits a mapped file is told so in the same turn, with zero setup beyond
having the plugin installed.

## Phase 2 — drift honesty: per-section scoring and graded labels

Make drift.js report what it actually knows.

- Split INDEX (and docs/map/* files) by `##` heading; score each section against only the
  paths that section cites. Doc-level score becomes the max of its sections.
- Replace the binary `[STALE]` with graded labels: `ok` / `aging` / `probably stale`, and
  say "commits to cited files" in the output line so the proxy is visible. Never claim
  certainty the metric doesn't have.
- Fold in verify.js signal: a section with broken refs is `stale (broken refs)` regardless
  of commit count; churn alone caps at `probably stale`.
- This also unlocks the roadmap's "true incremental refresh": the SKILL.md refresh workflow
  points the regeneration at flagged sections, not flagged docs. Update SKILL.md step 1-2
  of "Refreshing an existing map" to consume the per-section output.
- Tests: section split, per-section attribution, label thresholds, broken-ref override.

Exit: drift output names the section to re-read, and a correct-but-busy doc no longer
screams STALE.

## Phase 3 — symbol citations (finish C3)

Close the gap between "link-clean" and "true" for the highest-value claims.

- Citation syntax: `path/to/file.js::symbolName` in doc tables and golden-path traces.
  extractRefs learns the form; verify.js greps the target file for the symbol (word-bound
  match, no AST, language-agnostic). Missing symbol -> `missing-symbol` finding.
- Generation guidance: codebase_map_guide.md tells the writer to use symbol citations for
  entry points and golden-path hops specifically, where a wrong claim costs an agent the
  most. Not everywhere; role-line prose stays prose.
- Tests: symbol present, symbol removed, non-code target skipped, plain paths unaffected.

Exit: renaming an entry-point function makes verify.js fail, not just renaming its file.

## Phase 4 — map slices for subagent briefing

Turn the strongest agent use case into a supported pattern.

- `scripts/slice.js <path-or-keyword>`: prints the INDEX/docs-map sections relevant to a
  file or topic, resolved by which sections cite the path (or match the keyword in the
  heading). Output is plain markdown sized for pasting into a subagent prompt.
- Reuses the phase-2 section splitter; this is mostly wiring.
- Document the pattern in SKILL.md and README: an orchestrator briefs each subagent with
  one slice instead of letting N subagents each re-explore the repo. This is also the
  honest answer to "when does the map pay back": every cold subagent context multiplies
  the savings.
- Tests: slice by path, slice by keyword, no match -> clear empty result.

Exit: one command yields a paste-ready briefing slice for any file in a mapped repo.

## Phase 5 — README economics note

Small docs pass: a short README paragraph on payback. The discovery phase is expensive by
design; it amortizes over agent traffic. A repo agents touch weekly pays it back fast, a
20-file tool visited twice may only need the CLAUDE.md block (which the skill already
scales down to). Sets expectations and matches the no-overclaiming rule for going public.

## Parked (deliberately not in this plan)

- AST-accurate symbol verification per language. The word-bound grep in phase 3 is the
  80 percent; per-language parsers are bloat until proven needed.
- Making ROADMAP optional by default. It is the weakest satellite for agents, but it is
  load-bearing for the Compass row schema, and the skill already scales the doc set down
  per repo. No change.
- Auto-fixing drift (regenerating sections without a human gate). Against the grounding
  rules; refresh stays agent-assisted, human-gated.

## Order and dependencies

1 is independent and highest leverage; ship first. 2 before 4 (slice.js reuses the section
splitter). 3 is independent. 5 any time. Each phase lands with tests green on the
cross-platform CI matrix before the next starts.
