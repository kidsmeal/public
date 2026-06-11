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
