#!/usr/bin/env node
/*
 * Compass Rose doctor - the data half of /compass:doctor.
 *
 * A read-only integrity + staleness check over the whole workbench. It reports;
 * it never writes (the command offers fixes, the human gates them). Findings are
 * grouped by severity. The git-based checks degrade to no-ops when git is
 * unavailable, so the report is always produced.
 */
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { parseRoadmap, lint } = require("./roadmap.js");

const ROOT = process.env.COMPASS_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || process.cwd();
const STALE_COMMITS = 20; // commits to the repo since a standing doc was touched -> probably stale

function git(args) {
  try {
    return execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch { return ""; }
}
function exists(rel) { try { return fs.existsSync(path.join(ROOT, rel)); } catch { return false; } }
function read(rel) { try { return fs.readFileSync(path.join(ROOT, rel), "utf8"); } catch { return ""; } }
function firstExisting(c) { return c.find(exists) || null; }
function listMd(rel) {
  try { return fs.readdirSync(path.join(ROOT, rel)).filter((f) => f.endsWith(".md")).map((f) => rel.replace(/\/$/, "") + "/" + f); }
  catch { return []; }
}

const findings = [];
const add = (level, msg, fix) => findings.push({ level, msg, fix: fix || null });

// --- Roadmap-based checks ---
const rmFile = firstExisting(["docs/ROADMAP.md", "ROADMAP.md"]);
let roadmap = null;
if (!rmFile) {
  add("warn", "No ROADMAP.md - the hub is missing.", "build one with the cartographer skill");
} else {
  roadmap = parseRoadmap(read(rmFile));
  if (!roadmap.schemaPresent) {
    add("info", rmFile + " has no structured rows (prose roadmap); status/advance fall back to prose.", "adopt the roadmap-row schema (see the template)");
  }
  for (const i of lint(roadmap)) {
    add(i.level, "roadmap[" + i.id + "]: " + i.msg, i.level === "warn" ? "fill in the missing field" : null);
  }
  // broken links: a linked design/plan file that doesn't exist on disk
  for (const f of roadmap.features) {
    for (const key of ["design", "plan"]) {
      const p = f[key];
      if (p && /\.md$/.test(p) && !exists(p)) {
        add("error", "roadmap[" + f.id + "]: " + key + " links a missing file (" + p + ")", "fix the path, or regenerate the doc");
      }
    }
  }
  // orphan design/plan files not linked from any row
  const linked = roadmap.features.flatMap((f) => [f.design, f.plan].filter(Boolean));
  for (const dir of ["docs/designs", "docs/plans"]) {
    for (const file of listMd(dir)) {
      const isLinked = linked.some((l) => l === file || l.endsWith(file) || file.endsWith(l));
      if (!isLinked) add("info", "orphan doc not linked from any roadmap row: " + file, "link it from a row, or archive it");
    }
  }
}

// --- git: a committed phase but a dirty tree ---
const committedRows = roadmap ? roadmap.features.filter((f) => f.phaseState === "committed").length : 0;
const realDirty = git(["status", "--porcelain"]).split("\n").filter(Boolean).filter((l) => {
  const fn = l.slice(3).trim();
  return !["NOW.md", "IDEAS.md", "SHIPPED.md"].includes(fn) && !fn.startsWith(".now/") && !fn.startsWith(".compass/");
});
if (committedRows && realDirty.length) {
  add("info", committedRows + " phase(s) marked committed, but the tree has " + realDirty.length + " uncommitted change(s).", "commit them, or set phase_state back to building/in_review");
}

// --- staleness: standing docs vs code churn (Workstream C2, interim lite surface) ---
// The canonical per-section drift scorer belongs in the cartographer plugin (it
// owns the docs it generated); this is the cheap surface doctor shows today.
function commitsSince(rel) {
  const last = git(["log", "-1", "--format=%H", "--", rel]);
  if (!last) return null;
  const n = git(["rev-list", "--count", last + "..HEAD"]);
  return n ? parseInt(n, 10) : 0;
}
for (const rel of ["docs/INDEX.md", "INDEX.md", "docs/CONVENTIONS.md", "CONVENTIONS.md", "docs/GLOSSARY.md"]) {
  if (!exists(rel)) continue;
  const c = commitsSince(rel);
  if (c != null && c >= STALE_COMMITS) {
    add("info", rel + " unchanged across " + c + " commits to the repo - probably stale.", "regenerate with the cartographer skill");
  }
}

// --- audit docs presence ---
if (rmFile && !firstExisting(["CURRENTNESS_AUDIT.md", "docs/CURRENTNESS_AUDIT.md"])) {
  add("info", "No currentness audit - nothing reconciles docs against code.", "run /gantry:init then /gantry:audit");
}
if (rmFile && !firstExisting(["RUNTIME_VERIFICATION_QUEUE.md", "docs/RUNTIME_VERIFICATION_QUEUE.md"])) {
  add("info", "No runtime verification queue.", "run /gantry:init then /gantry:verify");
}

// --- report ---
const order = { error: 0, warn: 1, info: 2 };
findings.sort((a, b) => order[a.level] - order[b.level]);
const counts = { error: 0, warn: 0, info: 0 };
for (const f of findings) counts[f.level]++;

console.log("--- Compass Rose doctor ---");
if (!findings.length) {
  console.log("Clean. No issues found.");
} else {
  console.log(counts.error + " error(s), " + counts.warn + " warning(s), " + counts.info + " note(s).\n");
  for (const f of findings) {
    console.log("  [" + f.level.toUpperCase() + "] " + f.msg + (f.fix ? "\n        fix: " + f.fix : ""));
  }
}
