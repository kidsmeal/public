"use strict";
/*
 * Tests for the roadmap parser (plugins/compass/scripts/roadmap.js).
 *
 * The parser is the foundation the operational commands (status, doctor,
 * advance) sit on, so it carries the heaviest test coverage: well-formed rows,
 * defaults, null normalization, id fallback, graceful prose fallback, fenced-
 * block skipping, the active-feature pick, and the structural lint.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseRoadmap, findById, activeFeature, lint } = require("../plugins/compass/scripts/roadmap.js");

const WELL_FORMED = [
  "# ROADMAP",
  "",
  "## Now",
  "- [ ] Add dark mode  <!-- id: dark-mode -->",
  "  - status: in_progress",
  "  - active_phase: 2",
  "  - phase_state: in_review",
  '  - idea: IDEAS.md "dark mode toggle"',
  "  - design: docs/designs/dark-mode.md",
  "  - plan: docs/plans/dark-mode-plan.md",
  "  - blocked_by: —",
  "",
  "## Next",
  "- [ ] Export to CSV  <!-- id: csv-export -->",
  "  - status: planned",
  "  - design: docs/designs/csv.md",
  "  - plan: docs/plans/csv-plan.md",
  "",
  "## Later",
  "- [ ] Big refactor",
  "  - status: idea",
  "",
].join("\n");

test("parses every feature across sections", () => {
  const rm = parseRoadmap(WELL_FORMED);
  assert.equal(rm.schemaPresent, true);
  assert.equal(rm.features.length, 3);
  assert.deepEqual(rm.features.map((f) => f.id), ["dark-mode", "csv-export", "big-refactor"]);
});

test("parses the full field set with correct types and section", () => {
  const f = findById(parseRoadmap(WELL_FORMED), "dark-mode");
  assert.equal(f.name, "Add dark mode");
  assert.equal(f.section, "Now");
  assert.equal(f.status, "in_progress");
  assert.equal(f.activePhase, 2);            // number, not string
  assert.equal(f.phaseState, "in_review");
  assert.equal(f.design, "docs/designs/dark-mode.md");
  assert.equal(f.plan, "docs/plans/dark-mode-plan.md");
  assert.match(f.idea, /dark mode toggle/);
  assert.equal(f.blockedBy, null);           // "—" normalizes to null
});

test("applies defaults for absent fields", () => {
  const f = findById(parseRoadmap(WELL_FORMED), "csv-export");
  assert.equal(f.activePhase, 0);            // default when absent
  assert.equal(f.phaseState, null);
  assert.equal(f.blockedBy, null);
});

test("derives an id from the name when no id comment is present", () => {
  const f = findById(parseRoadmap(WELL_FORMED), "big-refactor");
  assert.ok(f, "expected a kebab-derived id 'big-refactor'");
  assert.equal(f.status, "idea");
  assert.equal(f.design, null);
});

test("activeFeature returns the in_progress row", () => {
  assert.equal(activeFeature(parseRoadmap(WELL_FORMED)).id, "dark-mode");
});

test("activeFeature falls back to first non-done Now row when nothing is in_progress", () => {
  const rm = parseRoadmap([
    "## Now",
    "- [ ] Thing one  <!-- id: one -->",
    "  - status: planned",
    "- [x] Done thing  <!-- id: done-thing -->",
    "  - status: done",
  ].join("\n"));
  assert.equal(activeFeature(rm).id, "one");
});

test("graceful fallback: a prose roadmap parses with schemaPresent=false", () => {
  const rm = parseRoadmap([
    "## Now",
    "- [ ] Just a plain checklist item",
    "- [ ] Another one",
  ].join("\n"));
  assert.equal(rm.schemaPresent, false);
  assert.equal(rm.features.length, 2);
  assert.equal(rm.features[0].status, null);
});

test("skips rows inside fenced code blocks (examples are not real state)", () => {
  const rm = parseRoadmap([
    "# ROADMAP",
    "Example of the format:",
    "```md",
    "- [ ] Not a real feature  <!-- id: fake -->",
    "  - status: in_progress",
    "```",
    "## Now",
    "- [ ] Real feature  <!-- id: real -->",
    "  - status: planned",
    "  - design: d.md",
    "  - plan: p.md",
  ].join("\n"));
  assert.equal(rm.features.length, 1);
  assert.equal(rm.features[0].id, "real");
  assert.equal(findById(rm, "fake"), null);
});

test("lint flags planned-without-plan, unknown status, and in_progress-without-phase_state", () => {
  const rm = parseRoadmap([
    "## Now",
    "- [ ] Missing plan  <!-- id: no-plan -->",
    "  - status: planned",
    "  - design: d.md",
    "- [ ] Weird  <!-- id: weird -->",
    "  - status: frobnicate",
    "- [ ] Mid build  <!-- id: mid -->",
    "  - status: in_progress",
    "  - design: d.md",
    "  - plan: p.md",
  ].join("\n"));
  const issues = lint(rm);
  const by = (id) => issues.filter((i) => i.id === id).map((i) => i.msg);
  assert.ok(by("no-plan").some((m) => /no plan link/.test(m)));
  assert.ok(by("weird").some((m) => /unknown status/.test(m)));
  assert.ok(by("mid").some((m) => /no phase_state/.test(m)));
});

test("lint flags unknown phase_state and does not flag a valid one", () => {
  const rm = parseRoadmap([
    "## Now",
    "- [ ] Bad state  <!-- id: bad-state -->",
    "  - status: in_progress",
    "  - phase_state: frobnicate",
    "  - design: d.md",
    "  - plan: p.md",
    "- [ ] Good state  <!-- id: good-state -->",
    "  - status: in_progress",
    "  - phase_state: in_review",
    "  - design: d.md",
    "  - plan: p.md",
  ].join("\n"));
  const by = (id) => lint(rm).filter((i) => i.id === id).map((i) => i.msg);
  assert.ok(by("bad-state").some((m) => /unknown phase_state/.test(m)), "unknown phase_state should be flagged");
  assert.equal(by("good-state").filter((m) => /unknown phase_state/.test(m)).length, 0, "valid phase_state should not be flagged");
});

test("the small lane skips the design requirement but still needs a plan", () => {
  const rm = parseRoadmap([
    "## Now",
    "- [ ] Small change  <!-- id: small -->",
    "  - status: planned",
    "  - lane: small",
    "  - plan: docs/plans/small-plan.md",
    "- [ ] Small no plan  <!-- id: small-np -->",
    "  - status: planned",
    "  - lane: small",
  ].join("\n"));
  assert.equal(findById(rm, "small").lane, "small");
  const by = (id) => lint(rm).filter((i) => i.id === id).map((i) => i.msg);
  assert.equal(by("small").filter((m) => /no design/.test(m)).length, 0, "small lane shouldn't require a design");
  assert.equal(by("small").filter((m) => /no plan/.test(m)).length, 0, "small with a plan is satisfied");
  assert.ok(by("small-np").some((m) => /no plan link/.test(m)), "small still needs a plan");
});
