"use strict";
/*
 * Cartographer reference extractor - shared by verify.js and drift.js.
 *
 * Pulls the *checkable* references out of a generated doc: markdown links to repo
 * files, and backtick "code paths" (an inline-code span that contains a slash and
 * no spaces, e.g. `docs/INDEX.md` or `src/auth/login.ts`). Each reference carries
 * its path target, an optional #anchor, the source line, and a kind.
 *
 * Deliberately high-precision: URLs, bare filenames without a slash, and command
 * snippets (which contain spaces) are skipped, so the freshness checks don't cry
 * wolf. A `path/to/file.js::symbolName` citation carries the symbol too, so
 * verify.js can check the claim survives a rename, not just the file.
 */

const LINK_RE = /\[[^\]]*\]\(([^)\s]+)\)/g;
const CODE_RE = /`([^`\n]+)`/g;

function isUrl(s) { return /^[a-z][\w+.-]*:\/\//i.test(s) || /^(mailto|tel):/i.test(s); }

// Split a target into path + optional #anchor + optional ::symbol. The symbol
// must look like an identifier; anything else (e.g. a stray "::") is treated
// as part of no symbol at all, and the path part stays checkable on its own.
function split(target) {
  const i = target.indexOf("#");
  let p = target, anchor = null;
  if (i !== -1) { p = target.slice(0, i); anchor = target.slice(i + 1) || null; }
  let symbol = null;
  const j = p.indexOf("::");
  if (j !== -1) {
    const candidate = p.slice(j + 2);
    if (/^[A-Za-z_$][\w$]*$/.test(candidate)) symbol = candidate;
    p = p.slice(0, j);
  }
  return { path: p, anchor, symbol };
}

// A code span we should treat as a path: has a slash, no whitespace, only
// path-safe characters, and isn't a URL.
function looksLikePath(s) {
  return s.indexOf("/") !== -1 && !/\s/.test(s) && /^[.~]?[\w./@+-]+$/.test(s) && !isUrl(s);
}

function extractRefs(text) {
  const refs = [];
  const lines = String(text || "").split(/\r?\n/);
  let inFence = false;
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    // Track fenced code blocks (``` or ~~~, with optional language tag). Paths
    // inside fences are examples, not live citations — skip extraction there.
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    let m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(line))) {
      const target = m[1].trim();
      if (isUrl(target)) continue;
      const { path: p, anchor, symbol } = split(target);
      refs.push({ raw: m[0], path: p || null, anchor, symbol, kind: "link", line: n + 1 });
    }
    CODE_RE.lastIndex = 0;
    while ((m = CODE_RE.exec(line))) {
      const { path: p, anchor, symbol } = split(m[1].trim());
      if (!looksLikePath(p)) continue;
      refs.push({ raw: m[0], path: p, anchor, symbol, kind: "code-path", line: n + 1 });
    }
  }
  return refs;
}

module.exports = { extractRefs, looksLikePath, split, isUrl };
