"use strict";
/*
 * Cartographer standing-doc helpers - shared by verify.js, drift.js, slice.js
 * and the edit-time hook, so they cannot drift on which docs are "standing",
 * how a cited path resolves, or where a section begins.
 *
 * Standing docs are the documents the skill generates and keeps current:
 * INDEX, GLOSSARY, CONVENTIONS, ROADMAP (under docs/ or the repo root), the
 * split map under docs/map/, and CLAUDE.md.
 */
const fs = require("fs");
const path = require("path");

const DOC_CANDIDATES = [
  "docs/INDEX.md", "INDEX.md", "docs/GLOSSARY.md", "GLOSSARY.md",
  "docs/CONVENTIONS.md", "CONVENTIONS.md", "docs/ROADMAP.md", "ROADMAP.md", "CLAUDE.md",
];

function existsAbs(p) { try { fs.accessSync(p); return true; } catch { return false; } }

function listMapParts(root) {
  try {
    return fs.readdirSync(path.join(root, "docs", "map")).filter((f) => f.endsWith(".md")).map((f) => "docs/map/" + f);
  } catch { return []; }
}

// The standing docs that actually exist under root, as repo-relative POSIX paths.
function standingDocs(root) {
  return [...DOC_CANDIDATES, ...listMapParts(root)].filter((rel) => existsAbs(path.join(root, rel)));
}

// Resolve a doc-relative or root-relative reference target; valid if either
// exists. Returns the absolute path, or null when neither resolves.
function resolveRefIn(root, docAbs, target) {
  const clean = target.replace(/^\.\//, "");
  for (const c of [path.resolve(path.dirname(docAbs), target), path.resolve(root, clean)]) {
    if (existsAbs(c)) return c;
  }
  return null;
}

// Split a doc into sections at `##` headings. Anything before the first `##`
// (including a `#` title) is a heading-less preamble section. Headings inside
// fenced code blocks don't split. Each section: { heading: string|null,
// startLine, endLine } with 1-based inclusive line numbers, plus its text.
function splitSections(text) {
  const lines = String(text || "").split(/\r?\n/);
  const sections = [];
  let cur = { heading: null, startLine: 1 };
  let inFence = false;
  for (let n = 0; n < lines.length; n++) {
    if (/^\s*(```|~~~)/.test(lines[n])) inFence = !inFence;
    const m = !inFence && lines[n].match(/^##\s+(.*)$/);
    if (m) {
      if (n + 1 > cur.startLine || cur.heading !== null) {
        sections.push({ ...cur, endLine: n });
      }
      cur = { heading: m[1].trim(), startLine: n + 1 };
    }
  }
  sections.push({ ...cur, endLine: lines.length });
  return sections.map((s) => ({ ...s, text: lines.slice(s.startLine - 1, s.endLine).join("\n") }));
}

module.exports = { DOC_CANDIDATES, existsAbs, listMapParts, standingDocs, resolveRefIn, splitSections };
