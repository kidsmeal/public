#!/usr/bin/env node
/*
 * Compass Rose status - the data half of /compass:status.
 *
 * Gathers the repo signals and artifact freshness the command needs to narrate a
 * unified brief: where you are (git), what artifacts exist, and how old each is.
 * Like ClauDHD's breadcrumb, the cursor files are excluded from "real uncommitted
 * work" so a live cursor never reads as drift. Read-only; touches nothing.
 */
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = process.env.COMPASS_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || process.cwd();

function git(args) {
  try {
    return execFileSync("git", ["-C", ROOT, ...args], {
      encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch { return ""; }
}
function exists(rel) { try { return fs.existsSync(path.join(ROOT, rel)); } catch { return false; } }
function ageDays(rel) {
  try {
    const ms = Date.now() - fs.statSync(path.join(ROOT, rel)).mtimeMs;
    return Math.max(0, Math.floor(ms / 86400000));
  } catch { return null; }
}
function firstExisting(cands) { return cands.find(exists) || null; }

const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]) || "(not a git repo)";

// Uncommitted real work, excluding the cursor files so a live cursor never trips
// a drift read.
const IGNORE = new Set(["NOW.md", "IDEAS.md", "SHIPPED.md"]);
const porcelain = git(["status", "--porcelain"]).split("\n").filter(Boolean);
const realChanges = porcelain.filter((l) => {
  const f = l.slice(3).trim();
  return !IGNORE.has(f) && !f.startsWith(".now/") && !f.startsWith(".compass/");
});

const recent = git(["log", "-5", "--pretty=format:%h %s"]).split("\n").filter(Boolean);

const artifacts = [
  ["NOW.md cursor", firstExisting(["NOW.md"])],
  ["roadmap", firstExisting(["docs/ROADMAP.md", "ROADMAP.md"])],
  ["map index", firstExisting(["docs/INDEX.md", "INDEX.md"])],
  ["conventions", firstExisting(["CONVENTIONS.md", "docs/CONVENTIONS.md"])],
  ["currentness audit", firstExisting(["CURRENTNESS_AUDIT.md", "docs/CURRENTNESS_AUDIT.md"])],
  ["runtime verify queue", firstExisting(["RUNTIME_VERIFICATION_QUEUE.md", "docs/RUNTIME_VERIFICATION_QUEUE.md"])],
];

console.log("--- Compass Rose: project signals ---");
console.log("Branch: " + branch);
console.log("Uncommitted real work: " + (realChanges.length ? realChanges.length + " file(s)" : "none") +
  (realChanges.length ? "\n  " + realChanges.slice(0, 12).map((l) => l.trim()).join("\n  ") : ""));
console.log("Recent commits:" + (recent.length ? "\n  " + recent.join("\n  ") : " none"));
console.log("\nArtifacts (age in days):");
for (const [label, rel] of artifacts) {
  if (!rel) { console.log("  [missing] " + label); continue; }
  const a = ageDays(rel);
  console.log("  [ok] " + label + " -> " + rel + (a === null ? "" : "  (" + a + "d)"));
}
console.log("\n(NOW/IDEAS/SHIPPED are excluded from 'real work' so a live cursor never reads as drift.)");
