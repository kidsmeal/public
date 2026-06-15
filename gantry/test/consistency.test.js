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
