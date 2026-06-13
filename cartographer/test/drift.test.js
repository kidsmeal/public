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

test("ROADMAP.md citing an existing file appears in the drift results", () => {
  const dir = mkRepo();
  try {
    w(dir, "src/app.js", "v1");
    w(dir, "ROADMAP.md", "# Roadmap\nSee `src/app.js`.\n");
    commit(dir, "init");
    w(dir, "src/app.js", "v2"); commit(dir, "change app");
    const r = driftScores(dir).results.find((x) => x.doc === "ROADMAP.md");
    assert.ok(r, "ROADMAP.md should appear in drift results");
    assert.equal(r.score, 1, "one commit touched the cited file since the doc");
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

// --- per-section scoring (improvement plan phase 2) ---

const TWO_SECTION_INDEX = [
  "# Index",
  "## Auth",
  "Auth lives in `src/auth.js`.",
  "## Billing",
  "Billing lives in `src/billing.js`.",
].join("\n") + "\n";

test("splits by ## heading and attributes churn to the section that cites the file", () => {
  const dir = mkRepo();
  try {
    w(dir, "src/auth.js", "v1");
    w(dir, "src/billing.js", "v1");
    w(dir, "docs/INDEX.md", TWO_SECTION_INDEX);
    commit(dir, "init");
    w(dir, "src/auth.js", "v2"); commit(dir, "auth change");
    w(dir, "src/auth.js", "v3"); commit(dir, "auth change 2");
    const r = indexScore(dir);
    const auth = r.sections.find((s) => s.heading === "Auth");
    const billing = r.sections.find((s) => s.heading === "Billing");
    assert.equal(auth.score, 2, "churn lands on the section citing the churned file");
    assert.equal(billing.score, 0, "the other section stays clean");
    assert.equal(r.score, 2, "doc score is the max of its sections");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("grades labels: ok below half-threshold, aging from half, probably stale from threshold", () => {
  const dir = mkRepo();
  try {
    w(dir, "src/app.js", "seed");
    w(dir, "docs/INDEX.md", "# Index\nApp lives in `src/app.js`.\n");
    commit(dir, "init");
    for (let i = 0; i < 3; i++) { w(dir, "src/app.js", "v" + i); commit(dir, "c" + i); }
    assert.equal(indexScore(dir, { threshold: 8 }).label, "ok", "3 < 4 -> ok");
    assert.equal(indexScore(dir, { threshold: 6 }).label, "aging", "3 >= 3 -> aging");
    assert.equal(indexScore(dir, { threshold: 3 }).label, "probably stale", "3 >= 3 -> probably stale");
    assert.equal(indexScore(dir, { threshold: 3 }).stale, true);
    assert.equal(indexScore(dir, { threshold: 6 }).stale, false, "aging is not stale");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("a section with broken refs is stale regardless of commit count", () => {
  const dir = mkRepo();
  try {
    w(dir, "src/auth.js", "v1");
    w(dir, "docs/INDEX.md", [
      "# Index",
      "## Auth",
      "Auth lives in `src/auth.js`.",
      "## Gone",
      "Used to live in `src/gone.js`.",
    ].join("\n") + "\n");
    commit(dir, "init");
    const r = indexScore(dir);
    const gone = r.sections.find((s) => s.heading === "Gone");
    assert.equal(gone.label, "stale (broken refs)", "broken ref overrides a zero commit count");
    assert.equal(r.label, "stale (broken refs)", "doc label is its worst section");
    assert.equal(r.stale, true);
    assert.equal(r.sections.find((s) => s.heading === "Auth").label, "ok", "clean section unaffected");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("churn alone never claims broken refs", () => {
  const dir = mkRepo();
  try {
    w(dir, "src/app.js", "seed");
    w(dir, "docs/INDEX.md", "# Index\nApp lives in `src/app.js`.\n");
    commit(dir, "init");
    for (let i = 0; i < 5; i++) { w(dir, "src/app.js", "v" + i); commit(dir, "c" + i); }
    assert.equal(indexScore(dir, { threshold: 2 }).label, "probably stale", "churn caps at probably stale");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
