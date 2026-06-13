#!/usr/bin/env node
"use strict";
/*
 * Cartographer slice - print the map sections relevant to one file or topic,
 * sized for pasting into a subagent prompt.
 *
 * An orchestrator briefs each subagent with one slice instead of letting N
 * subagents each re-explore the repo: the slice carries exactly the INDEX /
 * docs/map/* sections that cite the file (or mention the keyword in their
 * heading), nothing else. Read-only; no git.
 *
 *   node slice.js <path-or-keyword> [root]
 *
 * Resolution: if the argument matches a path some section cites (or resolves
 * to an existing file that one does), those sections win; otherwise it is
 * treated as a keyword against section headings.
 */
const fs = require("fs");
const path = require("path");
const { extractRefs } = require("./refs.js");
const { standingDocs, splitSections, resolveRefIn, existsAbs } = require("./docs.js");

// Slices come from the map only - INDEX and the split map files - not the
// satellites; GLOSSARY/CONVENTIONS are cheap enough to hand a subagent whole.
function mapDocs(root) {
  return standingDocs(root).filter((rel) => /(^|\/)INDEX\.md$/.test(rel) || rel.startsWith("docs/map/"));
}

function sliceFor(root, query) {
  const q = String(query || "").trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!q) return { mode: null, matches: [] };

  // The repo-relative form of the query, when it points at a real file.
  let qRel = null;
  const qAbs = path.resolve(root, q);
  if (existsAbs(qAbs)) qRel = path.relative(root, qAbs).split(path.sep).join("/");

  const byPath = [];
  const byKeyword = [];
  for (const rel of mapDocs(root)) {
    const abs = path.join(root, rel);
    let text;
    try { text = fs.readFileSync(abs, "utf8"); } catch { continue; }
    for (const s of splitSections(text)) {
      const cited = new Set();
      for (const ref of extractRefs(s.text)) {
        if (!ref.path) continue;
        const resolved = resolveRefIn(root, abs, ref.path);
        if (resolved) cited.add(path.relative(root, resolved).split(path.sep).join("/"));
      }
      if (cited.has(qRel) || cited.has(q)) byPath.push({ doc: rel, heading: s.heading, text: s.text });
      else if (s.heading && s.heading.toLowerCase().includes(q.toLowerCase())) {
        byKeyword.push({ doc: rel, heading: s.heading, text: s.text });
      }
    }
  }
  return byPath.length ? { mode: "path", matches: byPath } : { mode: "keyword", matches: byKeyword };
}

module.exports = { sliceFor, mapDocs };

if (require.main === module) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const query = args[0];
  const root = args[1] || process.env.CARTOGRAPHER_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (!query) {
    console.log("usage: node slice.js <path-or-keyword> [root]");
    process.exit(1);
  }
  const { mode, matches } = sliceFor(root, query);
  if (!matches.length) {
    console.log("No map sections cite `" + query + "` or mention it in a heading.");
    console.log("(Looked in: " + (mapDocs(root).join(", ") || "no INDEX/docs-map files found") + ".)");
    process.exit(0);
  }
  const lines = ["<!-- codebase map slice for \"" + query + "\" (" + mode + " match) - paste into a subagent briefing -->"];
  for (const m of matches) {
    lines.push("", "<!-- from " + m.doc + " -->", m.text.trimEnd());
  }
  console.log(lines.join("\n"));
}
