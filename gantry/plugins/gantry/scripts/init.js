#!/usr/bin/env node
/*
 * Gantry init - the /gantry:init command.
 *
 * Scaffolds the two living audit docs (CURRENTNESS_AUDIT.md and
 * RUNTIME_VERIFICATION_QUEUE.md) and the model-backend config
 * (.gantry/models.json) into the project from the bundled defaults, never
 * overwriting an existing file. Then it sniffs the repo for the facts the
 * agents need to be project-agnostic - the project's convention/style files,
 * its test/build commands, and which external agent CLIs are available - and
 * prints them, so the /gantry:init command can finish wiring the pipeline to
 * THIS project instead of guessing.
 *
 * It also gitignores the local/transient .gantry run files (unconditionally,
 * since models.json is scaffolded on every run and is per-machine). Everything
 * else is read-only detection. The sole opt-in-gated write is the
 * .gantry/enabled marker, written only with --enable-hooks.
 */
"use strict";
const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const roleCore = require("./role-core.js");

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

// Which external agent CLIs are available, so the command can tailor its
// model-backend guidance - and so the scaffold below knows whether the codex
// phase reviewer it wants to write can actually run. Best-effort; absent CLIs
// report [missing] quickly.
function onPath(cmd) {
  try {
    const r = spawnSync(cmd + " --version", { stdio: "ignore", shell: true, timeout: 8000 });
    return !r.error && r.status === 0;
  } catch { return false; }
}

// For codex, `--version` alone is not proof it can run: a stale shim on PATH
// prints its version fine yet dies at startup when the shared
// ~/.codex/config.toml uses a newer schema than the shim understands (the
// app keeps its real, current binary in a versioned subdirectory of the same
// bin dir). `codex login status` forces a config load, so exit 0 means this
// binary can actually start. Called with no argument it probes the PATH
// `codex` (via shell, like onPath); with a full path it probes that binary.
function codexConfigLoads(bin) {
  try {
    const r = bin
      ? spawnSync(bin, ["login", "status"], { stdio: "ignore", timeout: 8000 })
      : spawnSync("codex login status", { stdio: "ignore", shell: true, timeout: 8000 });
    return !r.error && r.status === 0;
  } catch { return false; }
}

// Resolve which file `codex` on PATH actually is, so the probe can look for
// versioned sibling installs next to it.
function whichCodex() {
  try {
    const r = process.platform === "win32"
      ? spawnSync("where", ["codex"], { encoding: "utf8", timeout: 8000 })
      : spawnSync("command -v codex", { encoding: "utf8", shell: true, timeout: 8000 });
    if (r.error || r.status !== 0) return null;
    return (r.stdout || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0] || null;
  } catch { return null; }
}

// When the PATH codex cannot load the config, the install that CAN is usually
// sitting right next to it: the codex app keeps versioned installs in
// hash-named subdirectories of the same bin directory its PATH shim lives in.
// Return the full path of the first sibling codex that passes the config-load
// probe, or null.
function findWorkingCodexSibling(pathBin) {
  const binDir = path.dirname(pathBin);
  const exe = process.platform === "win32" ? "codex.exe" : "codex";
  let entries;
  try { entries = fs.readdirSync(binDir, { withFileTypes: true }); } catch { return null; }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const candidate = path.join(binDir, ent.name, exe);
    if (!fs.existsSync(candidate)) continue;
    if (codexConfigLoads(candidate)) return candidate;
  }
  return null;
}

// The full codex probe. `codexBin` is null when the plain PATH `codex` works
// (or nothing works); it carries the sibling's full path when only the sibling
// works, and scaffoldConfig then writes that path into the backend cmd. A
// sibling path containing whitespace cannot be represented in the cmd template
// (it tokenizes on whitespace), so it counts as not found rather than being
// scaffolded broken.
function probeCodex() {
  if (!onPath("codex")) {
    return { available: false, codexBin: null, reason: "codex CLI not on PATH", status: "codex [missing]" };
  }
  if (codexConfigLoads()) {
    return { available: true, codexBin: null, reason: null, status: "codex [found]" };
  }
  const pathBin = whichCodex();
  const sibling = pathBin ? findWorkingCodexSibling(pathBin) : null;
  if (sibling && !/\s/.test(sibling)) {
    return {
      available: true,
      codexBin: sibling,
      reason: null,
      status: "codex [found - PATH binary cannot load ~/.codex/config.toml; using " + sibling + "]",
    };
  }
  return {
    available: false,
    codexBin: null,
    reason: "codex on PATH but it cannot load ~/.codex/config.toml and no working sibling install was found",
    status: "codex [broken - cannot load ~/.codex/config.toml]",
  };
}

const codex = probeCodex();
const cliStatus = [codex.status].concat(
  [["claude", onPath("claude")], ["gemini", onPath("gemini")]]
    .map(([c, found]) => c + (found ? " [found]" : " [missing]"))
);

// Scaffold the model-backend config (.gantry/models.json). Both reviewers route
// to codex when a codex that can actually START is found - the two gates are
// worth a second model's eyes - and fall back to native when it is not, since a
// gate that cannot run is worse than no gate. Every other role is native, so
// the pipeline behaves exactly as before until flipped via /gantry:models. This
// is per-machine config (its backends depend on which CLIs and API keys exist
// locally), so it is gitignored below rather than shared. Never overwrites an
// existing file.
let modelsStatus;
if (exists(path.join(".gantry", "models.json"))) {
  modelsStatus = "kept existing .gantry/models.json";
} else {
  try {
    fs.mkdirSync(path.join(ROOT, ".gantry"), { recursive: true });
    fs.writeFileSync(
      path.join(ROOT, ".gantry", "models.json"),
      JSON.stringify(roleCore.scaffoldConfig(codex.available, codex.codexBin), null, 2) + "\n"
    );
    modelsStatus = codex.available
      ? "created .gantry/models.json (both reviewers -> codex" +
        (codex.codexBin ? " via " + codex.codexBin : "") + ", rest native)"
      : "created .gantry/models.json (all roles native - " + codex.reason + ")";
  } catch (e) {
    modelsStatus = "could not write .gantry/models.json (" + e.message + ")";
  }
}

// Gitignore the local/transient .gantry files - additive and idempotent, and
// unconditional because models.json (per-machine config) is scaffolded on every
// init, so it must be ignored on every init too. active-phase.json and the
// headless settings are transient run state. The hook opt-in marker
// (.gantry/enabled) is deliberately NOT ignored - it is shared, team-wide state.
const GITIGNORE_ENTRIES = [
  ".gantry/active-phase.json",                  // transient sentinel
  ".gantry/models.json",                        // per-machine backend config
  ".gantry/headless-implementer-settings.json", // transient guard injection
];
{
  const gitignorePath = path.join(ROOT, ".gitignore");
  try {
    const present = fs.existsSync(gitignorePath);
    const content = present ? fs.readFileSync(gitignorePath, "utf8") : "";
    if (!present) {
      fs.writeFileSync(gitignorePath, GITIGNORE_ENTRIES.join("\n") + "\n");
      console.log("  Created .gitignore with " + GITIGNORE_ENTRIES.join(", ") + ".");
    } else {
      const lines = content.split(/\r?\n/);
      const toAppend = [];
      for (const entry of GITIGNORE_ENTRIES) {
        if (lines.some((l) => l.trim() === entry)) {
          console.log("  .gitignore already contains " + entry + ".");
        } else {
          toAppend.push(entry);
        }
      }
      if (toAppend.length) {
        // Leading newline if the file does not already end with one, so the
        // first appended entry lands on its own line.
        const needsNewline = content.length > 0 && !content.endsWith("\n");
        fs.appendFileSync(gitignorePath, (needsNewline ? "\n" : "") + toAppend.join("\n") + "\n");
        for (const e of toAppend) console.log("  Appended " + e + " to .gitignore.");
      }
    }
  } catch (e) {
    console.error("! Gantry: could not update .gitignore: " + e.message);
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
  const pm = exists("pnpm-lock.yaml") ? "pnpm"
    : exists("yarn.lock") ? "yarn"
    : (exists("bun.lockb") || exists("bun.lock")) ? "bun"
    : "npm";
  const t = scripts.test ? pm + " test" : "(no \"test\" script in package.json)";
  const b = scripts.build ? pm + " run build" : (scripts.lint ? pm + " run lint" : "(no build/lint script)");
  add("Node/JS (" + pm + ")", t, b);
}
if (exists("Cargo.toml")) add("Rust", "cargo test", "cargo build && cargo clippy");
if (exists("go.mod")) add("Go", "go test ./...", "go build ./... && go vet ./...");
if (exists("pyproject.toml") || exists("setup.py") || exists("requirements.txt"))
  add("Python", exists("pytest.ini") || exists("tests") ? "pytest" : "pytest (no tests/ dir found)", "ruff check / mypy (if configured)");
if (exists("project.godot")) add("Godot", "GdUnit4 (godot --headless -s addons/gdUnit4/...)", "godot --headless --check-only");
if (exists("Gemfile")) add("Ruby", "bundle exec rspec", "rubocop");
if (exists("pom.xml")) add("Java/Kotlin (Maven)", "mvn test", "mvn package");
if (exists("build.gradle") || exists("build.gradle.kts") || exists("settings.gradle") || exists("settings.gradle.kts")) {
  const gw = exists("gradlew") ? "./gradlew" : "gradle";
  add("Java/Kotlin (Gradle)", gw + " test", gw + " build");
}
if (exists("CMakeLists.txt")) add("C/C++ (CMake)", "ctest --test-dir build", "cmake --build build");
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

// Plugin-native hook opt-in: only relevant when init.js is executed inside an
// installed plugin (CLAUDE_PLUGIN_ROOT is set by the plugin host).
//
// Default run (no --enable-hooks flag): report that enforcement is available
// but NOT enabled, and print how to enable it. Do NOT write .gantry/enabled.
//
// With --enable-hooks flag: write the .gantry/enabled marker so the PreToolUse
// guards become active. (Gitignoring the transient/local .gantry files is done
// unconditionally above, not here, since models.json is scaffolded every run.)
if (process.env.CLAUDE_PLUGIN_ROOT) {
  const enableHooks = process.argv.includes("--enable-hooks");

  if (!enableHooks) {
    // Detection-only report: inform that enforcement is available but inert.
    console.log(
      "\n--- Phase enforcement hooks ---\n" +
      "  This is a plugin install. PreToolUse enforcement is available but NOT enabled.\n" +
      "  The hooks are inert until you opt in. To enable them, re-run the opt-in step\n" +
      "  in /gantry:init (it will run: node \"" + __filename + "\" --enable-hooks)."
    );
  } else {
    // Explicit opt-in: write the .gantry/enabled marker (empty file).
    const gantryDir = path.join(ROOT, ".gantry");
    const markerPath = path.join(gantryDir, "enabled");
    try {
      fs.mkdirSync(gantryDir, { recursive: true });
      if (!fs.existsSync(markerPath)) {
        fs.writeFileSync(markerPath, "");
        console.log("  Created .gantry/enabled (hook opt-in marker).");
      } else {
        console.log("  .gantry/enabled already present.");
      }
    } catch (e) {
      console.error("! Gantry: could not write .gantry/enabled: " + e.message);
    }
  }
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

console.log("\n--- Model backends ---");
console.log("Config: " + modelsStatus);
console.log("External agent CLIs: " + cliStatus.join("  "));
console.log(
  "Both reviewers route to codex when the codex CLI is installed, so the design\n" +
  "doc and the diff each get a second model's read; every other role is native\n" +
  "(in-session Claude subagent). Use /gantry:models to change any of it. The\n" +
  "implementer is pinned to the Claude Code harness so the hooks always fire."
);
