"use strict";
/* Smoke test for gantry version script. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const VERSION_SCRIPT = path.join(__dirname, "..", "plugins", "gantry", "scripts", "version.js");

test("version prints Gantry vX.Y.Z", () => {
  const r = spawnSync(process.execPath, [VERSION_SCRIPT], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^Gantry v\d+\.\d+\.\d+/);
});
