#!/usr/bin/env node
"use strict";
/*
 * Regenerate codebase-cartographer.skill from the canonical plugin form.
 *
 * The .skill is a zip of plugins/cartographer/skills/codebase-cartographer/,
 * with every internal path prefixed by codebase-cartographer/. It is a
 * generated release artifact; the plugin-form directory is the source of truth.
 *
 * Uses Python's zipfile module (already required by scan_repo.py). Try python3
 * first, fall back to python.
 *
 *   node tools/build-skill.js
 */
const { execFileSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "plugins", "cartographer", "skills", "codebase-cartographer");
const DEST = path.join(ROOT, "codebase-cartographer.skill");

function findPython() {
  for (const p of ["python3", "python"]) {
    try { execFileSync(p, ["--version"], { stdio: "ignore" }); return p; } catch { /* next */ }
  }
  return null;
}

const python = findPython();
if (!python) {
  console.error("! Python not found. Install Python 3 (already required for scan_repo.py) and retry.");
  process.exit(1);
}

const script = [
  "import zipfile, os, sys",
  "src, dest = sys.argv[1], sys.argv[2]",
  "prefix = 'codebase-cartographer'",
  "with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as z:",
  "    for root, dirs, files in os.walk(src):",
  "        dirs[:] = [d for d in dirs if d != '__pycache__']",
  "        for f in files:",
  "            abs_path = os.path.join(root, f)",
  "            rel = os.path.relpath(abs_path, src).replace(os.sep, '/')",
  "            z.write(abs_path, prefix + '/' + rel)",
  "print('Built: ' + dest)",
].join("\n");

execFileSync(python, ["-c", script, SRC, DEST], { stdio: "inherit" });
