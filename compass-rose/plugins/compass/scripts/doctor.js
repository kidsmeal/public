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

// Best-effort: locate the co-installed cartographer plugin's freshness scripts
// and require them, so doctor surfaces the *canonical* path/anchor verification
// and per-doc drift (which Cartographer owns) rather than its own lite stand-in.
// Returns null when the plugin can't be found, and doctor falls back.
function loadCartographerFreshness() {
  try {
    // COMPASS_PLUGIN_CACHE overrides the cache-walk for non-standard install layouts.
    let cache = process.env.COMPASS_PLUGIN_CACHE || null;
    if (!cache) {
      let dir = __dirname;
      for (let i = 0; i < 10; i++) {
        if (path.basename(dir) === "cache" && path.basename(path.dirname(dir)) === "plugins") { cache = dir; break; }
        const up = path.dirname(dir); if (up === dir) break; dir = up;
      }
    }
    if (!cache) return null;
    const base = path.join(cache, "cartographer", "cartographer");
    let versions = [];
    try { versions = fs.readdirSync(base).sort().reverse(); } catch { return null; }
    for (const v of versions) {
      const s = path.join(base, v, "plugins", "cartographer", "scripts");
      if (fs.existsSync(path.join(s, "verify.js")) && fs.existsSync(path.join(s, "drift.js"))) {
        return { verifyDocs: require(path.join(s, "verify.js")).verifyDocs, driftScores: require(path.join(s, "drift.js")).driftScores };
      }
    }
  } catch { /* ignore */ }
  return null;
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

// --- done rows outside Shipped section ---
if (roadmap) {
  for (const f of roadmap.features) {
    if (f.status === "done" && f.section && !/shipped/i.test(f.section)) {
      add("info", "roadmap[" + f.id + "]: done row in \"" + f.section + "\" - archive it to ## Shipped.", "archive to ## Shipped (doctor --fix)");
    }
  }
}

// --- shipped-but-not-done check ---
// A row that appears in SHIPPED.md but whose status is not "done" is a stale marker.
if (roadmap && exists("SHIPPED.md")) {
  const shippedText = read("SHIPPED.md").toLowerCase();
  for (const f of roadmap.features) {
    if (f.status === "done") continue;
    const needles = [f.id, f.design, f.plan, f.name].filter(Boolean).map((s) => s.toLowerCase());
    if (needles.some((n) => shippedText.includes(n))) {
      add("warn", "roadmap[" + f.id + "]: appears in SHIPPED.md but row is not done (status: " + (f.status || "none") + ")", "flip the row to done, or remove it from SHIPPED.md if it was logged in error");
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

// --- staleness: cited path/anchor verification + per-doc drift ---
// Owned by Cartographer (it generates the docs). When its plugin is co-installed
// we surface the canonical checks; otherwise we fall back to a lite commit-age
// stand-in so doctor still says something useful on its own.
const carto = loadCartographerFreshness();
if (carto) {
  try {
    for (const f of carto.verifyDocs(ROOT).findings) {
      add(f.kind === "missing-path" ? "error" : "warn",
        "doc[" + f.doc + ":" + f.line + "]: " + f.kind + " " + f.ref + " -> " + f.detail,
        "fix the reference, or regenerate the doc (cartographer)");
    }
  } catch { /* ignore */ }
  try {
    const { threshold, results } = carto.driftScores(ROOT);
    for (const x of results) {
      if (x.stale) add("info", x.doc + " lags the code it cites (" + x.score + " commits >= " + threshold + ").", "regenerate / refresh with the cartographer skill");
    }
  } catch { /* ignore */ }
} else {
  // Fallback (cartographer plugin not found): lite commit-age staleness.
  const commitsSince = (rel) => {
    const last = git(["log", "-1", "--format=%H", "--", rel]);
    if (!last) return null;
    const n = git(["rev-list", "--count", last + "..HEAD"]);
    return n ? parseInt(n, 10) : 0;
  };
  for (const rel of ["docs/INDEX.md", "INDEX.md", "docs/CONVENTIONS.md", "CONVENTIONS.md", "docs/GLOSSARY.md"]) {
    if (!exists(rel)) continue;
    const c = commitsSince(rel);
    if (c != null && c >= STALE_COMMITS) {
      add("info", rel + " unchanged across " + c + " commits to the repo - probably stale.", "regenerate with the cartographer skill");
    }
  }
}

// --- audit docs presence + open doc flags ---
const auditFile = firstExisting(["CURRENTNESS_AUDIT.md", "docs/CURRENTNESS_AUDIT.md"]);
if (rmFile && !auditFile) {
  add("info", "No currentness audit - nothing reconciles docs against code.", "run /gantry:init then /gantry:audit");
} else if (auditFile) {
  const auditText = read(auditFile);
  const flagIdx = auditText.indexOf("## Open doc flags");
  if (flagIdx !== -1) {
    const nextSection = auditText.indexOf("\n## ", flagIdx + 1);
    const section = nextSection === -1 ? auditText.slice(flagIdx) : auditText.slice(flagIdx, nextSection);
    const open = (section.match(/^- \[ \] /gm) || []).length;
    if (open > 0) {
      add("warn", open + " unchecked " + (open === 1 ? "entry" : "entries") + " in CURRENTNESS_AUDIT.md Open doc flags.", "run /gantry:audit to reconcile");
    }
  }
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
