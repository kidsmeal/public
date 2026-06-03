#!/usr/bin/env node
"use strict";
/*
 * Cartographer drift (Workstream C2 - git-timestamp drift scoring).
 *
 * For each standing doc, count the commits that touched the files it *cites*
 * since the doc itself was last committed. A high count means the doc lags the
 * code it describes - probably stale. Mechanical, cheap, no file reading beyond
 * the doc. Read-only; needs git (degrades to a note without it).
 *
 *   node drift.js [root] [--threshold N]
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { extractRefs } = require("./refs.js");

const args = process.argv.slice(2);
const argRoot = args.find((a) => !a.startsWith("-"));
const ROOT = argRoot || process.env.CARTOGRAPHER_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || process.cwd();
const tIdx = args.indexOf("--threshold");
const DEFAULT_THRESHOLD = tIdx !== -1 && args[tIdx + 1] ? parseInt(args[tIdx + 1], 10) : 20;

const DOC_CANDIDATES = [
  "docs/INDEX.md", "INDEX.md", "docs/GLOSSARY.md", "GLOSSARY.md",
  "docs/CONVENTIONS.md", "CONVENTIONS.md", "CLAUDE.md",
];

function git(root, a) {
  try { return execFileSync("git", ["-C", root, ...a], { encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return ""; }
}
function existsAbs(p) { try { fs.accessSync(p); return true; } catch { return false; } }
function listMapParts(root) {
  try { return fs.readdirSync(path.join(root, "docs", "map")).filter((f) => f.endsWith(".md")).map((f) => "docs/map/" + f); }
  catch { return []; }
}

// The repo-relative paths a doc cites that actually exist.
function referencedPaths(root, docAbs, text) {
  const out = new Set();
  for (const ref of extractRefs(text)) {
    if (!ref.path) continue;
    const clean = ref.path.replace(/^\.\//, "");
    for (const c of [path.resolve(path.dirname(docAbs), ref.path), path.resolve(root, clean)]) {
      if (existsAbs(c)) { out.add(path.relative(root, c).split(path.sep).join("/")); break; }
    }
  }
  return [...out];
}

function driftScores(root, opts = {}) {
  const r = root || ROOT;
  const threshold = opts.threshold != null ? opts.threshold : DEFAULT_THRESHOLD;
  const isRepo = git(r, ["rev-parse", "--is-inside-work-tree"]) === "true";
  const docs = [...DOC_CANDIDATES, ...listMapParts(r)].filter((rel) => existsAbs(path.join(r, rel)));
  const results = [];
  for (const rel of docs) {
    const abs = path.join(r, rel);
    if (!isRepo) { results.push({ doc: rel, score: null, note: "not a git repo" }); continue; }
    const docCommit = git(r, ["log", "-1", "--format=%H", "--", rel]);
    if (!docCommit) { results.push({ doc: rel, score: null, note: "doc not committed yet" }); continue; }
    const paths = referencedPaths(r, abs, fs.readFileSync(abs, "utf8"));
    if (!paths.length) { results.push({ doc: rel, score: null, note: "no cited paths to score against" }); continue; }
    const n = git(r, ["rev-list", "--count", docCommit + "..HEAD", "--", ...paths]);
    const score = n ? parseInt(n, 10) : 0;
    results.push({ doc: rel, score, paths: paths.length, stale: score >= threshold });
  }
  return { threshold, results };
}

module.exports = { driftScores, referencedPaths };

if (require.main === module) {
  const { threshold, results } = driftScores(ROOT);
  console.log("Cartographer drift - commits to cited files since each doc was last updated (stale >= " + threshold + "):");
  if (!results.length) { console.log("  (no standing docs found)"); process.exit(0); }
  for (const x of results) {
    if (x.score == null) console.log("  - " + x.doc + ": (" + x.note + ")");
    else console.log("  " + (x.stale ? "[STALE]" : "[ ok  ]") + " " + x.doc + ": " + x.score + " commit(s) to " + x.paths + " cited path(s)");
  }
}
