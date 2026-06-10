#!/usr/bin/env node
/*
 * Compass Rose version - the /compass:version command.
 *
 * Prints the installed connector version (from plugin.json, the single source of
 * truth) and does a best-effort check that the three instruments it connects are
 * installed. Doubles as an install check: if this resolves and prints a version,
 * the connector loaded. Zero tokens; it is a local script. Detection is advisory
 * only - false negatives are possible across install layouts, so the
 * authoritative per-project check lives in /compass:init.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");

const MANIFEST = path.join(__dirname, "..", ".claude-plugin", "plugin.json");

let version = "unknown";
try {
  version = JSON.parse(fs.readFileSync(MANIFEST, "utf8")).version || "unknown";
} catch {
  console.error("! Compass Rose: could not read plugin.json - the install may be incomplete.");
  process.exit(1);
}

console.log(`Compass Rose v${version}`);

function dirExists(p) {
  try { return !!p && fs.statSync(p).isDirectory(); } catch { return false; }
}

// Walk up from here looking for the ".../plugins/cache" directory that holds the
// sibling plugins. Returns null when running from a layout we don't recognize.
// COMPASS_PLUGIN_CACHE overrides the walk for non-standard install layouts.
function findCacheRoot(start) {
  if (process.env.COMPASS_PLUGIN_CACHE) return process.env.COMPASS_PLUGIN_CACHE;
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (path.basename(dir) === "cache" && path.basename(path.dirname(dir)) === "plugins") return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const cacheRoot = findCacheRoot(__dirname);
const skillDir = path.join(os.homedir(), ".claude", "skills", "codebase-cartographer");

// Read pinned dependency ranges from plugin.json
const depRanges = {};
try {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  for (const dep of (manifest.dependencies || [])) {
    if (dep && typeof dep === "object") depRanges[dep.name] = dep.version || null;
  }
} catch { /* ignore */ }

// Walk the cache dir for an instrument and return its installed version, or "unknown".
function instrumentVersion(cacheName) {
  if (!cacheRoot) return "unknown";
  const base = path.join(cacheRoot, cacheName, cacheName);
  let versions = [];
  try { versions = fs.readdirSync(base).sort().reverse(); } catch { return "unknown"; }
  for (const v of versions) {
    try {
      const pj = path.join(base, v, "plugins", cacheName, ".claude-plugin", "plugin.json");
      const ver = JSON.parse(fs.readFileSync(pj, "utf8")).version;
      if (ver) return ver;
    } catch { /* try next version dir */ }
  }
  return "unknown";
}

// Numeric x.y.z comparison only (no pre-release). Returns positive/negative/0.
function cmpVer(a, b) {
  const ap = String(a).split(".").map(Number);
  const bp = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const av = isNaN(ap[i]) ? 0 : ap[i];
    const bv = isNaN(bp[i]) ? 0 : bp[i];
    if (av !== bv) return av - bv;
  }
  return 0;
}

// Returns true if version satisfies >=required, false if behind, null if undetermined.
function meetsRange(version, range) {
  if (!version || version === "unknown") return null;
  if (String(version).split(".").some((p) => isNaN(parseInt(p, 10)))) return null;
  const m = String(range || "").match(/^>=(.+)$/);
  if (!m) return null;
  return cmpVer(version, m[1]) >= 0;
}

const instruments = [
  {
    name: "ClauDHD",
    cacheKey: "claudhd",
    found: cacheRoot ? dirExists(path.join(cacheRoot, "claudhd")) : false,
    hint: "/plugin marketplace add kidsmeal/ClauDHD  ->  /plugin install claudhd@claudhd",
  },
  {
    name: "Gantry",
    cacheKey: "gantry",
    found: cacheRoot ? dirExists(path.join(cacheRoot, "gantry")) : false,
    hint: "/plugin marketplace add public/gantry  ->  /plugin install gantry@gantry",
  },
  {
    name: "Codebase-Cartographer",
    cacheKey: "cartographer",
    found: (cacheRoot ? dirExists(path.join(cacheRoot, "cartographer")) : false) || dirExists(skillDir),
    hint: "/plugin marketplace add public/cartographer  ->  /plugin install cartographer@cartographer",
  },
];

if (!cacheRoot) {
  console.log("(could not locate the plugin cache from here - run /compass:init to verify the instruments in your project)");
} else {
  console.log("\nInstruments (best-effort detection):");
  for (const it of instruments) {
    if (!it.found) {
      console.log(`  [missing?] ${it.name}  ->  ${it.hint}`);
      continue;
    }
    const ver = instrumentVersion(it.cacheKey);
    const req = depRanges[it.cacheKey];
    const ok = meetsRange(ver, req);
    const verLabel = ver === "unknown" ? "version unknown" : "v" + ver;
    const reqLabel = req ? "  (requires " + req + ")" : "";
    const statusTag = ok === false ? "[BEHIND]  " : "[ok]      ";
    console.log(`  ${statusTag} ${it.name}  ${verLabel}${reqLabel}`);
  }
}
