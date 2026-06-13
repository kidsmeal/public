#!/usr/bin/env node
"use strict";
/*
 * cited-file-note.js - PostToolUse hook (Edit|Write|MultiEdit): when the file
 * just edited is cited by a standing doc (INDEX, GLOSSARY, CONVENTIONS,
 * ROADMAP, docs/map/*, CLAUDE.md), tell the agent so in the same turn:
 *
 *   "docs/INDEX.md cites src/auth/login.ts; check the map if you moved or
 *    renamed it."
 *
 * Note only - this hook never blocks, and it never repeats itself for the
 * same file in the same session (sentinel files under the OS temp dir).
 *
 * Hard invariants (same contract as Gantry's guards):
 *   - Always exits 0, on every path.
 *   - Fails SILENT on any error: malformed stdin, missing fields, no docs,
 *     unreadable docs, paths outside the root.
 *   - Cheap by construction: parses only the standing docs; no git calls.
 */
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { extractRefs } = require("../scripts/refs.js");
const { standingDocs, resolveRefIn } = require("../scripts/docs.js");

// Normalize a file path to a root-relative POSIX string. Path semantics
// (win32 vs posix) are chosen from the input shape, not the host platform, so
// a Windows-style path relativizes identically on every CI OS. Returns null
// when the path can't be made root-relative (caller stays silent).
function normalize(filePath, root) {
  try {
    if (!filePath || !root) return null;
    const normDrive = (p) => String(p).replace(/^([A-Za-z]):/, (_, d) => d.toLowerCase() + ":");
    const f = normDrive(filePath);
    const r = normDrive(root);
    const looksWin = (s) => /^[a-z]:/i.test(s) || s.includes("\\");
    const pmod = looksWin(f) || looksWin(r) ? path.win32 : path.posix;
    const rel = pmod.isAbsolute(f) ? pmod.relative(r, f) : f;
    if (!rel || rel.startsWith("..")) return null;
    return rel.replace(/\\/g, "/");
  } catch { return null; }
}

// Map of cited repo-relative POSIX path -> array of doc rel-paths citing it.
function citedBy(root) {
  const map = new Map();
  for (const rel of standingDocs(root)) {
    const abs = path.join(root, rel);
    let text;
    try { text = fs.readFileSync(abs, "utf8"); } catch { continue; }
    for (const ref of extractRefs(text)) {
      if (!ref.path) continue;
      const resolved = resolveRefIn(root, abs, ref.path);
      if (!resolved) continue;
      const key = path.relative(root, resolved).split(path.sep).join("/");
      if (!map.has(key)) map.set(key, []);
      if (!map.get(key).includes(rel)) map.get(key).push(rel);
    }
  }
  return map;
}

// One sentinel file per (session, root, file) under the OS temp dir, so the
// same edit stream doesn't repeat the note.
function alreadyNoted(sessionId, root, relPath) {
  try {
    const dir = path.join(os.tmpdir(), "cartographer-noted", String(sessionId));
    const name = crypto.createHash("sha1").update(root + "|" + relPath).digest("hex");
    const p = path.join(dir, name);
    try { fs.accessSync(p); return true; } catch { /* not yet noted */ }
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, "");
    return false;
  } catch { return true; } // can't track -> stay silent rather than risk spam
}

function main() {
  let payload;
  try { payload = JSON.parse(fs.readFileSync(0, "utf8")); } catch { return; }
  if (!payload || typeof payload !== "object") return;
  const toolInput = payload.tool_input;
  if (!toolInput || typeof toolInput !== "object") return;
  const filePath = toolInput.file_path;
  if (!filePath) return;

  const root = process.env.CARTOGRAPHER_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR ||
    payload.cwd || process.cwd();
  const rel = normalize(filePath, root);
  if (!rel) return;

  const docs = citedBy(root).get(rel);
  if (!docs || !docs.length) return;
  if (alreadyNoted(payload.session_id || "no-session", root, rel)) return;

  const who = docs.length === 1 ? docs[0] : docs.slice(0, -1).join(", ") + " and " + docs[docs.length - 1];
  const verb = docs.length === 1 ? "cites" : "cite";
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: who + " " + verb + " " + rel + "; check the map if you moved or renamed it.",
    },
  }) + "\n");
}

module.exports = { normalize, citedBy };

if (require.main === module) {
  try { main(); } catch { /* fail silent */ }
  process.exit(0);
}
