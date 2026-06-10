"use strict";
/*
 * Golden fixture: examples/walkthrough.md must stay in sync with the parser.
 * Extract fenced blocks containing a roadmap row (identified by <!-- id: -->),
 * parse them with parseRoadmap, and assert no schema violations or lint warnings.
 * If the test fails because the walkthrough is out of date, fix the walkthrough.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parseRoadmap, lint } = require(path.join(__dirname, "..", "plugins", "compass", "scripts", "roadmap.js"));

const WALKTHROUGH = path.join(__dirname, "..", "examples", "walkthrough.md");

function extractRoadmapBlocks(text) {
  const lines = String(text).split(/\r?\n/);
  const blocks = [];
  let inFence = false;
  let current = [];

  for (const line of lines) {
    if (!inFence && /^\s*```/.test(line)) {
      inFence = true;
      current = [];
    } else if (inFence && /^\s*```/.test(line)) {
      inFence = false;
      const joined = current.join("\n");
      if (/<!--\s*id:/.test(joined)) blocks.push(joined);
      current = [];
    } else if (inFence) {
      current.push(line);
    }
  }
  return blocks;
}

test("walkthrough fenced roadmap rows parse with no schema violations", () => {
  const text = fs.readFileSync(WALKTHROUGH, "utf8");
  const blocks = extractRoadmapBlocks(text);

  assert.ok(blocks.length > 0, "should find at least one fenced roadmap row block in walkthrough.md");

  for (const block of blocks) {
    const rm = parseRoadmap(block);
    assert.ok(rm.schemaPresent, "block should contain schema fields:\n" + block);

    for (const f of rm.features) {
      assert.ok(f.id, "each feature should have an id");
      assert.strictEqual(f.unknownStatus, false, "status should be a known value: " + f.raw.status);
      assert.strictEqual(f.unknownPhaseState, false, "phase_state should be a known value or null: " + f.raw.phase_state);
    }

    const warnings = lint(rm).filter((i) => i.level === "warn");
    assert.strictEqual(warnings.length, 0,
      "lint should produce no warnings for the walkthrough row: " + JSON.stringify(warnings));
  }
});
