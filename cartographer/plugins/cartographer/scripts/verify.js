#!/usr/bin/env node
"use strict";
/*
 * Cartographer verify (Workstream C3 - "checkable claims").
 *
 * Reads the standing docs Cartographer generates (INDEX, GLOSSARY, CONVENTIONS,
 * ROADMAP, the split map under docs/map/, and CLAUDE.md) and checks that every
 * cited file path still exists and every #anchor still resolves to a heading in
 * its target doc. Turns "the map verifies its paths" from a generation-time
 * promise into a runnable check that /compass:doctor or CI can call anytime.
 * Read-only.
 *
 *   node verify.js [root] [--strict]   (--strict exits non-zero on any break)
 */
const fs = require("fs");
const path = require("path");
const { extractRefs } = require("./refs.js");

const argRoot = process.argv.slice(2).find((a) => !a.startsWith("-"));
const ROOT = argRoot || process.env.CARTOGRAPHER_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || process.cwd();

const DOC_CANDIDATES = [
  "docs/INDEX.md", "INDEX.md", "docs/GLOSSARY.md", "GLOSSARY.md",
  "docs/CONVENTIONS.md", "CONVENTIONS.md", "docs/ROADMAP.md", "ROADMAP.md", "CLAUDE.md",
];

function existsAbs(p) { try { fs.accessSync(p); return true; } catch { return false; } }
function slugify(s) {
  return s.toLowerCase().replace(/`/g, "").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
}
function headingSlugs(absFile) {
  let txt = "";
  try { txt = fs.readFileSync(absFile, "utf8"); } catch { return null; }
  const slugs = new Set();
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^#{1,6}\s+(.*)$/);
    if (m) slugs.add(slugify(m[1]));
    const ex = line.match(/\{#([\w-]+)\}/); // explicit {#anchor}
    if (ex) slugs.add(ex[1].toLowerCase());
  }
  return slugs;
}
// Resolve a doc-relative or root-relative path; valid if either exists.
function resolveRefIn(root, docAbs, target) {
  const clean = target.replace(/^\.\//, "");
  for (const c of [path.resolve(path.dirname(docAbs), target), path.resolve(root, clean)]) {
    if (existsAbs(c)) return c;
  }
  return null;
}
function listMapParts(root) {
  try {
    return fs.readdirSync(path.join(root, "docs", "map")).filter((f) => f.endsWith(".md")).map((f) => "docs/map/" + f);
  } catch { return []; }
}

function verifyDocs(root) {
  const r = root || ROOT;
  const docs = [...DOC_CANDIDATES, ...listMapParts(r)].filter((rel) => existsAbs(path.join(r, rel)));
  const findings = [];
  for (const rel of docs) {
    const abs = path.join(r, rel);
    let text = "";
    try { text = fs.readFileSync(abs, "utf8"); } catch { continue; }
    for (const ref of extractRefs(text)) {
      let targetAbs = abs; // a pure in-doc #anchor refers to this doc
      if (ref.path) {
        const resolved = resolveRefIn(r, abs, ref.path);
        if (!resolved) {
          findings.push({ doc: rel, line: ref.line, kind: "missing-path", ref: ref.raw, detail: ref.path });
          continue;
        }
        targetAbs = resolved;
      }
      if (ref.anchor && /\.md$/i.test(targetAbs)) {
        const slugs = headingSlugs(targetAbs);
        if (slugs && !slugs.has(ref.anchor.toLowerCase())) {
          findings.push({ doc: rel, line: ref.line, kind: "missing-anchor", ref: ref.raw, detail: "#" + ref.anchor });
        }
      }
    }
  }
  return { docs, findings };
}

module.exports = { verifyDocs, slugify };

if (require.main === module) {
  const strict = process.argv.includes("--strict");
  const { docs, findings } = verifyDocs(ROOT);
  console.log("Cartographer verify - " + docs.length + " standing doc(s) checked.");
  if (!findings.length) {
    console.log("All cited paths and anchors resolve.");
    process.exit(0);
  }
  for (const f of findings) {
    console.log("  [" + f.kind + "] " + f.doc + ":" + f.line + "  " + f.ref + "  ->  " + f.detail);
  }
  console.log("\n" + findings.length + " broken reference(s)" + (strict ? "" : " (run with --strict to fail CI)") + ".");
  process.exit(strict ? 1 : 0);
}
