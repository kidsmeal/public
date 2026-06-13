#!/usr/bin/env node
"use strict";
/*
 * Cartographer drift (Workstream C2 - git-timestamp drift scoring).
 *
 * For each standing doc, split it into `##` sections and count the commits
 * that touched the files each *section* cites since the doc was last
 * committed. The count is a proxy: it measures churn in the cited code, not
 * wrongness in the doc, so the labels are graded and never claim certainty -
 *
 *   ok                   little churn since the doc was committed
 *   aging                churn is building; worth a skim (>= threshold/2)
 *   probably stale       heavy churn (>= threshold); churn alone never grades worse
 *   stale (broken refs)  the section cites paths/anchors that no longer resolve
 *                        (verify.js signal) - stale regardless of commit count
 *
 * A doc's score is the max of its sections', so one churny section no longer
 * taints a whole INDEX, and the output names the section to re-read.
 * Read-only; needs git (degrades to a note without it).
 *
 *   node drift.js [root] [--threshold N]
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { extractRefs } = require("./refs.js");
const { standingDocs, splitSections, resolveRefIn } = require("./docs.js");
const { verifyDocs } = require("./verify.js");

const args = process.argv.slice(2);
const argRoot = args.find((a) => !a.startsWith("-"));
const ROOT = argRoot || process.env.CARTOGRAPHER_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || process.cwd();
const tIdx = args.indexOf("--threshold");
const DEFAULT_THRESHOLD = tIdx !== -1 && args[tIdx + 1] ? parseInt(args[tIdx + 1], 10) : 20;

function git(root, a) {
  try { return execFileSync("git", ["-C", root, ...a], { encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return ""; }
}

// The repo-relative paths a doc (or doc slice) cites that actually exist.
function referencedPaths(root, docAbs, text) {
  const out = new Set();
  for (const ref of extractRefs(text)) {
    if (!ref.path) continue;
    const resolved = resolveRefIn(root, docAbs, ref.path);
    if (resolved) out.add(path.relative(root, resolved).split(path.sep).join("/"));
  }
  return [...out];
}

const SEVERITY = ["ok", "aging", "probably stale", "stale (broken refs)"];
function labelFor(score, threshold, brokenRefs) {
  if (brokenRefs) return "stale (broken refs)";
  if (score >= threshold) return "probably stale"; // churn alone caps here
  if (score >= Math.ceil(threshold / 2)) return "aging";
  return "ok";
}
function worse(a, b) { return SEVERITY.indexOf(a) >= SEVERITY.indexOf(b) ? a : b; }

function driftScores(root, opts = {}) {
  const r = root || ROOT;
  const threshold = opts.threshold != null ? opts.threshold : DEFAULT_THRESHOLD;
  const isRepo = git(r, ["rev-parse", "--is-inside-work-tree"]) === "true";
  const docs = standingDocs(r);
  // verify.js signal: broken refs per doc, by source line, so a section that
  // cites a missing path/anchor is flagged stale outright.
  const brokenLines = new Map();
  for (const f of verifyDocs(r).findings) {
    if (!brokenLines.has(f.doc)) brokenLines.set(f.doc, []);
    brokenLines.get(f.doc).push(f.line);
  }
  const results = [];
  for (const rel of docs) {
    const abs = path.join(r, rel);
    if (!isRepo) { results.push({ doc: rel, score: null, note: "not a git repo" }); continue; }
    const docCommit = git(r, ["log", "-1", "--format=%H", "--", rel]);
    if (!docCommit) { results.push({ doc: rel, score: null, note: "doc not committed yet" }); continue; }
    const broken = brokenLines.get(rel) || [];
    const sections = [];
    for (const s of splitSections(fs.readFileSync(abs, "utf8"))) {
      const paths = referencedPaths(r, abs, s.text);
      const brokenRefs = broken.some((line) => line >= s.startLine && line <= s.endLine);
      if (!paths.length && !brokenRefs) continue; // nothing checkable in this section
      let score = 0;
      if (paths.length) {
        const n = git(r, ["rev-list", "--count", docCommit + "..HEAD", "--", ...paths]);
        score = n ? parseInt(n, 10) : 0;
      }
      sections.push({
        heading: s.heading, line: s.startLine, score, paths: paths.length,
        brokenRefs, label: labelFor(score, threshold, brokenRefs),
      });
    }
    if (!sections.length) { results.push({ doc: rel, score: null, note: "no cited paths to score against" }); continue; }
    const score = Math.max(...sections.map((s) => s.score));
    const label = sections.map((s) => s.label).reduce(worse, "ok");
    results.push({
      doc: rel, score, paths: sections.reduce((n, s) => n + s.paths, 0), sections, label,
      // back-compat boolean (compass doctor reads it): stale means the strong labels only
      stale: label === "probably stale" || label === "stale (broken refs)",
    });
  }
  return { threshold, results };
}

module.exports = { driftScores, referencedPaths };

if (require.main === module) {
  const { threshold, results } = driftScores(ROOT);
  console.log("Cartographer drift - commits to cited files since each doc was last committed");
  console.log("(a churn proxy, not proof of wrongness: aging >= " + Math.ceil(threshold / 2) + ", probably stale >= " + threshold + "):");
  if (!results.length) { console.log("  (no standing docs found)"); process.exit(0); }
  const pad = (s) => ("[" + s + "]").padEnd(21);
  for (const x of results) {
    if (x.score == null) { console.log("  " + pad("-") + " " + x.doc + ": (" + x.note + ")"); continue; }
    console.log("  " + pad(x.label) + " " + x.doc + ": " + x.score + " commit(s) to cited files (" + x.paths + " path(s))");
    for (const s of x.sections) {
      if (s.label === "ok") continue; // name only the sections worth re-reading
      const name = s.heading ? "## " + s.heading : "(top of doc)";
      console.log("      " + pad(s.label) + " " + name + " - " + (s.brokenRefs ? "broken ref(s); " : "") + s.score + " commit(s) to " + s.paths + " cited path(s)");
    }
  }
}
