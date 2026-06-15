"use strict";
/* Consistency checks: the version lives in four files and the README's command
 * table must match commands/ - nothing keeps them honest except this test. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.join(__dirname, "..");
const PLUGIN = path.join(REPO, "plugins", "gantry");

function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function frontmatterVersion(p) {
  const m = fs.readFileSync(p, "utf8").match(/^version:\s*(\S+)\s*$/m);
  return m ? m[1] : null;
}

test("version matches across plugin.json, marketplace.json, and both skill frontmatters", () => {
  const version = readJson(path.join(PLUGIN, ".claude-plugin", "plugin.json")).version;
  assert.ok(version, "plugin.json must declare a version");

  const marketplace = readJson(path.join(REPO, ".claude-plugin", "marketplace.json"));
  assert.equal(marketplace.plugins[0].version, version, "marketplace.json version drifted from plugin.json");

  for (const skill of ["gantry", "design-plan-creator"]) {
    const p = path.join(PLUGIN, "skills", skill, "SKILL.md");
    assert.equal(frontmatterVersion(p), version, skill + "/SKILL.md frontmatter version drifted from plugin.json");
  }
});

test("every command in the README table exists in commands/, and vice versa", () => {
  const readme = fs.readFileSync(path.join(REPO, "README.md"), "utf8");
  const tableRows = readme.split("\n").filter((l) => /^\|\s*`\/gantry:/.test(l));
  const documented = new Set(
    tableRows.map((l) => l.match(/\/gantry:([a-z-]+)/)[1])
  );
  const shipped = new Set(
    fs.readdirSync(path.join(PLUGIN, "commands"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""))
  );

  for (const cmd of shipped) {
    assert.ok(documented.has(cmd), "commands/" + cmd + ".md is not in the README command table");
  }
  for (const cmd of documented) {
    assert.ok(shipped.has(cmd), "README documents /gantry:" + cmd + " but commands/" + cmd + ".md does not exist");
  }
});

test("phase-reviewer.md carries a Reachability check under Code discipline", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "agents", "phase-reviewer.md"), "utf8"
  );
  assert.ok(
    text.includes("Reachability"),
    "phase-reviewer.md must include a Reachability check"
  );
  assert.ok(
    text.includes("Wired-by"),
    "phase-reviewer.md Reachability section must reference Wired-by declarations"
  );
  assert.ok(
    /dead\s+code/i.test(text),
    "phase-reviewer.md must describe reachability as targeting silent dead code"
  );
});

test("phase-reviewer.md carries a real-input check under Test discipline", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "agents", "phase-reviewer.md"), "utf8"
  );
  assert.ok(
    text.includes("real-input"),
    "phase-reviewer.md must include a real-input check"
  );
  assert.ok(
    /fixture.only/i.test(text) || text.includes("fixture-only"),
    "phase-reviewer.md must state that fixture-only is insufficient for real-input code"
  );
});

test("phase-reviewer.md Hard rule carries the real-input smoke exception", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "agents", "phase-reviewer.md"), "utf8"
  );
  assert.ok(
    /real.input\s+smoke/i.test(text) || text.includes("real-input smoke"),
    "phase-reviewer.md Hard rules must include the real-input smoke exception"
  );
});

test("phase-reviewer.md verdict rules include reachability and real-input FAIL classes", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "agents", "phase-reviewer.md"), "utf8"
  );
  const verdictIdx = text.indexOf("Verdict rules:");
  assert.ok(verdictIdx !== -1, "phase-reviewer.md must contain a 'Verdict rules:' heading");
  const verdictBlock = text.slice(verdictIdx);
  assert.ok(
    verdictBlock.includes("Reachability"),
    "phase-reviewer.md verdict rules must reference Reachability"
  );
  assert.ok(
    verdictBlock.includes("real-input"),
    "phase-reviewer.md verdict rules section must reference real-input"
  );
});

test("phase-reviewer.md carries scope-calibration rule", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "agents", "phase-reviewer.md"), "utf8"
  );
  assert.ok(
    /scope.calibrat/i.test(text) || text.includes("scope-calibration") || text.includes("scope calibration"),
    "phase-reviewer.md must include a scope-calibration rule"
  );
  assert.ok(
    /deferred\s+note/i.test(text) || text.includes("deferred note"),
    "phase-reviewer.md scope-calibration must route beyond-phase demands to deferred notes"
  );
  assert.ok(
    /fix.now\s+note/i.test(text) || text.includes("fix-now note"),
    "phase-reviewer.md scope-calibration must route plan-omitted files to fix-now notes"
  );
});

test("phase-planner.md per-phase block includes the optional Wires/Wired-by field", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "agents", "phase-planner.md"), "utf8"
  );
  assert.ok(
    text.includes("Wires:"),
    "phase-planner.md must document the Wires: field form"
  );
  assert.ok(
    text.includes("Wired-by:"),
    "phase-planner.md must document the Wired-by: field form"
  );
  assert.ok(
    /per.phase/i.test(text) || text.includes("per-phase"),
    "phase-planner.md must describe the wiring field as per-phase (not a global section)"
  );
  assert.ok(
    /public\s+capability/i.test(text) || text.includes("public capability"),
    "phase-planner.md must scope the wiring field to phases that add a public capability"
  );
  // The field must live inside the per-phase block alongside Status/Goal/Files/Exit criteria,
  // not as a standalone section heading. Verify the block list includes it.
  assert.ok(
    /Status.*Goal.*Files/s.test(text),
    "phase-planner.md must still list Status / Goal / Files in its per-phase block"
  );
});

test("phase-planner.md wiring field documents all three Wired-by forms", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "agents", "phase-planner.md"), "utf8"
  );
  assert.ok(
    /Wired-by:\s+phase\s+\d/i.test(text) || text.includes("Wired-by: phase N") || /Wired-by: phase/.test(text),
    "phase-planner.md must document the 'Wired-by: phase N' form"
  );
  assert.ok(
    /Wired-by:\s+deferred/i.test(text) || text.includes("Wired-by: deferred"),
    "phase-planner.md must document the 'Wired-by: deferred (...)' form"
  );
  assert.ok(
    /Wired-by:\s+none/i.test(text) || text.includes("Wired-by: none"),
    "phase-planner.md must document the 'Wired-by: none (...)' form"
  );
});

test("implementer.md verification step carries the real-input rule", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "agents", "implementer.md"), "utf8"
  );
  assert.ok(
    text.includes("real-input") || text.includes("real input"),
    "implementer.md must include a real-input rule in its verification step"
  );
  assert.ok(
    /real\s+shipped\s+file/i.test(text) || text.includes("real shipped file") || text.includes("real shipped artifact"),
    "implementer.md real-input rule must require loading the real shipped file/artifact"
  );
  assert.ok(
    /fixture.only/i.test(text) || text.includes("fixture-only"),
    "implementer.md must state that fixture-only is insufficient for real-input code"
  );
});

test("implementer.md real-input rule names the browser/device fallback", () => {
  const text = fs.readFileSync(
    path.join(PLUGIN, "agents", "implementer.md"), "utf8"
  );
  assert.ok(
    /browser|device/i.test(text),
    "implementer.md must name the browser/device fallback for the real-input rule"
  );
  assert.ok(
    /manual\s+real.input\s+check|stated\s+manual/i.test(text) || text.includes("manual real-input check") || text.includes("stated manual"),
    "implementer.md must describe the fallback as a stated manual real-input check"
  );
});
