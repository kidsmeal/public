"use strict";
/* Tests for drift.js (Workstream C2). Git-backed: spins up throwaway repos. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { driftScores } = require("../plugins/cartographer/scripts/drift.js");

function git(dir, args) { return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" }).trim(); }
function mkRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cartographer-drift-"));
  git(dir, ["init", "-q", "-b", "main"]);
  git(dir, ["config", "user.email", "t@e.com"]);
  git(dir, ["config", "user.name", "T"]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  return dir;
}
function w(dir, rel, c) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, c);
}
function commit(dir, msg) { git(dir, ["add", "-A"]); git(dir, ["commit", "-q", "-m", msg]); }
function indexScore(dir, opts) {
  return driftScores(dir, opts).results.find((x) => x.doc === "docs/INDEX.md");
}

test("scores 0 just after the doc is committed, then climbs as cited files change", () => {
  const dir = mkRepo();
  try {
    w(dir, "src/app.js", "v1");
    w(dir, "docs/INDEX.md", "# Index\nApp lives in `src/app.js`.\n");
    commit(dir, "init");
    assert.equal(indexScore(dir).score, 0, "a freshly-committed doc should score 0");

    w(dir, "src/app.js", "v2"); commit(dir, "change app");
    w(dir, "src/app.js", "v3"); commit(dir, "change app again");
    assert.equal(indexScore(dir).score, 2, "two commits touched the cited file since the doc");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("does not count commits to files the doc does not cite", () => {
  const dir = mkRepo();
  try {
    w(dir, "src/app.js", "v1");
    w(dir, "docs/INDEX.md", "# Index\nApp lives in `src/app.js`.\n");
    commit(dir, "init");
    w(dir, "unrelated.txt", "x"); commit(dir, "unrelated change");
    assert.equal(indexScore(dir).score, 0, "an unrelated file changing should not score drift");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("flags stale once the score crosses the threshold", () => {
  const dir = mkRepo();
  try {
    w(dir, "src/app.js", "seed");
    w(dir, "docs/INDEX.md", "# Index\nApp lives in `src/app.js`.\n");
    commit(dir, "init");
    for (let i = 0; i < 3; i++) { w(dir, "src/app.js", "v" + i); commit(dir, "c" + i); }
    assert.equal(indexScore(dir, { threshold: 2 }).stale, true);
    assert.equal(indexScore(dir, { threshold: 20 }).stale, false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
