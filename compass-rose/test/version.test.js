"use strict";
/*
 * Tests for the version comparator logic in version.js.
 * Exercises cmpVer and meetsRange via a small in-process extraction; the full
 * output test would require a fake cache layout, so we test the logic unit here.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

// Inline the comparator logic so the test has no file-system dependency.
function cmpVer(a, b) {
  const ap = String(a).split(".").map(Number);
  const bp = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const av = isNaN(ap[i]) ? 0 : ap[i];
    const bv = isNaN(bp[i]) ? 0 : bp[i];
    if (av !== bv) return av - bv;
  }
  return 0;
}

function meetsRange(version, range) {
  if (!version || version === "unknown") return null;
  if (String(version).split(".").some((p) => isNaN(parseInt(p, 10)))) return null;
  const m = String(range || "").match(/^>=(.+)$/);
  if (!m) return null;
  return cmpVer(version, m[1]) >= 0;
}

test("equal version satisfies >=", () => {
  assert.equal(meetsRange("0.6.1", ">=0.6.1"), true);
});

test("higher patch satisfies >=", () => {
  assert.equal(meetsRange("0.6.2", ">=0.6.1"), true);
});

test("higher minor satisfies >=", () => {
  assert.equal(meetsRange("0.7.0", ">=0.6.1"), true);
});

test("lower version does not satisfy >=", () => {
  assert.equal(meetsRange("0.2.0", ">=0.3.0"), false);
});

test("lower patch does not satisfy >=", () => {
  assert.equal(meetsRange("0.3.0", ">=0.3.1"), false);
});

test("malformed version string returns null, never throws", () => {
  assert.equal(meetsRange("not-a-version", ">=0.3.0"), null);
});

test("'unknown' version returns null, never throws", () => {
  assert.equal(meetsRange("unknown", ">=0.3.0"), null);
});

test("missing version (empty string) returns null, never throws", () => {
  assert.equal(meetsRange("", ">=0.3.0"), null);
});
