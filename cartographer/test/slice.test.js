"use strict";
/* Tests for slice.js (map slices for subagent briefing). fs-based; no git. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { sliceFor } = require("../plugins/cartographer/scripts/slice.js");

const SLICE = path.join(__dirname, "..", "plugins", "cartographer", "scripts", "slice.js");

function mk() { return fs.mkdtempSync(path.join(os.tmpdir(), "cartographer-slice-")); }
function w(dir, rel, c) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, c);
}
function seed(dir) {
  w(dir, "src/auth.js", "x");
  w(dir, "src/billing.js", "x");
  w(dir, "docs/INDEX.md", [
    "# Index",
    "intro prose",
    "## Auth subsystem",
    "Auth lives in `src/auth.js`.",
    "## Billing",
    "Billing lives in `src/billing.js`.",
  ].join("\n") + "\n");
  w(dir, "docs/map/payments.md", [
    "# Payments map",
    "## Charge flow",
    "Charges go through `src/billing.js`.",
  ].join("\n") + "\n");
}

test("slice by path returns every section that cites the file, across INDEX and docs/map", () => {
  const dir = mk();
  try {
    seed(dir);
    const { mode, matches } = sliceFor(dir, "src/billing.js");
    assert.equal(mode, "path");
    assert.deepEqual(
      matches.map((m) => m.doc + "#" + m.heading).sort(),
      ["docs/INDEX.md#Billing", "docs/map/payments.md#Charge flow"]
    );
    assert.match(matches[0].text, /src\/billing\.js/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("a windows-style path argument matches the same sections", () => {
  const dir = mk();
  try {
    seed(dir);
    const { matches } = sliceFor(dir, "src\\auth.js");
    assert.equal(matches.length, 1);
    assert.equal(matches[0].heading, "Auth subsystem");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("slice by keyword matches section headings case-insensitively", () => {
  const dir = mk();
  try {
    seed(dir);
    const { mode, matches } = sliceFor(dir, "auth");
    assert.equal(mode, "keyword");
    assert.equal(matches.length, 1);
    assert.equal(matches[0].heading, "Auth subsystem");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("no match returns an empty result, and the CLI says so clearly with exit 0", () => {
  const dir = mk();
  try {
    seed(dir);
    assert.equal(sliceFor(dir, "nonexistent-topic").matches.length, 0);
    const out = execFileSync(process.execPath, [SLICE, "nonexistent-topic", dir], { encoding: "utf8" });
    assert.match(out, /No map sections cite `nonexistent-topic`/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("CLI output is paste-ready markdown naming the source doc", () => {
  const dir = mk();
  try {
    seed(dir);
    const out = execFileSync(process.execPath, [SLICE, "src/billing.js", dir], { encoding: "utf8" });
    assert.match(out, /<!-- from docs\/INDEX\.md -->/);
    assert.match(out, /## Billing/);
    assert.match(out, /<!-- from docs\/map\/payments\.md -->/);
    assert.doesNotMatch(out, /## Auth subsystem/, "unrelated sections stay out of the slice");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
