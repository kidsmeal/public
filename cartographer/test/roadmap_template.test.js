"use strict";
/*
 * Contract test: cartographer's templates/ROADMAP.md must carry exactly the
 * SPEC §2 field names and the id-comment format so compass's roadmap.js can
 * parse the template's example row. Hardcoded literals are correct here — the
 * SPEC §2 schema is the contract, and any drift in the template is a bug.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const TEMPLATE = path.join(__dirname, "..", "plugins", "cartographer", "templates", "ROADMAP.md");
const text = fs.readFileSync(TEMPLATE, "utf8");

const REQUIRED_FIELDS = ["status", "active_phase", "phase_state", "lane", "idea", "design", "plan", "blocked_by"];

for (const field of REQUIRED_FIELDS) {
  test("template example row contains field: " + field, () => {
    assert.match(text, new RegExp("- " + field + ":"), "field '" + field + "' missing from template example row");
  });
}

test("template example row has the id-comment format", () => {
  assert.match(text, /<!--\s*id:\s*[a-z0-9-]+\s*-->/, "example row must carry an <!-- id: ... --> comment");
});
