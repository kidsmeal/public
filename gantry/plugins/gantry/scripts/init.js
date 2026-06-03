#!/usr/bin/env node
/*
 * Gantry init - the /gantry:init command.
 *
 * Scaffolds the two living audit docs (CURRENTNESS_AUDIT.md and
 * RUNTIME_VERIFICATION_QUEUE.md) into the project from the bundled templates,
 * never overwriting an existing file. Then it sniffs the repo for the facts the
 * agents need to be project-agnostic - the project's convention/style files and
 * its test/build commands - and prints them, so the /gantry:init command can
 * finish wiring the pipeline to THIS project instead of guessing.
 *
 * Pure scaffolding + read-only detection. It writes only the two template files
 * (when absent) and nothing else.
 */
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = process.env.GANTRY_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || process.cwd();
const TEMPLATES = path.join(__dirname, "..", "templates");

function exists(rel) {
  try { return fs.existsSync(path.join(ROOT, rel)); } catch { return false; }
}
function read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), "utf8"); } catch { return ""; }
}
function git(args) {
  try {
    return execFileSync("git", ["-C", ROOT, ...args], {
      encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch { return ""; }
}

// Docs land in docs/ if the project keeps one, else at the repo root.
const docDir = exists("docs") ? "docs" : ".";
const created = [];
const kept = [];
const failed = [];
for (const name of ["CURRENTNESS_AUDIT.md", "RUNTIME_VERIFICATION_QUEUE.md"]) {
  const relDest = path.join(docDir, name);
  if (exists(relDest)) { kept.push(relDest); continue; }
  try {
    fs.copyFileSync(path.join(TEMPLATES, name), path.join(ROOT, relDest));
    created.push(relDest);
  } catch (e) {
    failed.push(relDest + " (" + e.message + ")");
  }
}

// Convention / style files the agents should read for THIS project.
const CONVENTION_CANDIDATES = [
  "CLAUDE.md", "AGENTS.md", "CONVENTIONS.md", "CONTRIBUTING.md",
  "docs/CONVENTIONS.md", "docs/INDEX.md", "docs/ARCHITECTURE.md", "STYLE.md",
];
const conventions = CONVENTION_CANDIDATES.filter(exists);

// Test + build command detection from ecosystem manifests. Best-effort; the
// command line will confirm with the user before anything relies on these.
const detected = [];
function add(stack, test, build) { detected.push({ stack, test, build }); }

if (exists("pubspec.yaml")) add("Dart/Flutter", "flutter test", "flutter build / dart analyze");
if (exists("package.json")) {
  let scripts = {};
  try { scripts = (JSON.parse(read("package.json")).scripts) || {}; } catch { /* ignore */ }
  const t = scripts.test ? "npm test" : "(no \"test\" script in package.json)";
  const b = scripts.build ? "npm run build" : (scripts.lint ? "npm run lint" : "(no build/lint script)");
  add("Node/JS", t, b);
}
if (exists("Cargo.toml")) add("Rust", "cargo test", "cargo build && cargo clippy");
if (exists("go.mod")) add("Go", "go test ./...", "go build ./... && go vet ./...");
if (exists("pyproject.toml") || exists("setup.py") || exists("requirements.txt"))
  add("Python", exists("pytest.ini") || exists("tests") ? "pytest" : "pytest (no tests/ dir found)", "ruff check / mypy (if configured)");
if (exists("project.godot")) add("Godot", "GdUnit4 (godot --headless -s addons/gdUnit4/...)", "godot --headless --check-only");
if (exists("go.mod") === false && exists("Gemfile")) add("Ruby", "bundle exec rspec", "rubocop");
const csproj = git(["ls-files", "*.csproj"]);
if (csproj) add(".NET", "dotnet test", "dotnet build");

const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);

console.log(
  "Gantry init complete (docs -> " + (docDir === "." ? "project root" : docDir + "/") + ").\n" +
  "  Created: " + (created.length ? created.join(", ") : "none (all already present)") + "\n" +
  "  Kept existing: " + (kept.length ? kept.join(", ") : "none")
);
if (failed.length) {
  console.error("! Gantry: could not write " + failed.join("; ") + ".\n" +
    "  Fix the cause (permissions / disk) and re-run /gantry:init.");
  process.exit(1);
}

console.log("\n--- Project signals (to wire the pipeline to this repo) ---");
console.log("Branch: " + (branch || "(not a git repo)"));
console.log("Convention/style files found: " + (conventions.length ? conventions.join(", ") : "NONE - agents will fall back to their built-in checklist"));
if (detected.length) {
  console.log("Detected stack(s) + likely commands:");
  for (const d of detected) {
    console.log("  - " + d.stack + ":  test = " + d.test + "  |  build/lint = " + d.build);
  }
} else {
  console.log("Detected stack: none recognized - ask the user for the test and build commands.");
}
