#!/usr/bin/env python3
"""
scan_repo.py — fast, dependency-free inventory of a codebase.

Gives the cartographer the lay of the land before it reads code: detected languages,
build/manifest files, existing docs, top-level structure, and candidate entry points.
Read this output first, then dive into the files it points at.

Usage:
    python scan_repo.py [repo-root]    # defaults to current directory

Prints a Markdown report to stdout. No third-party dependencies; Python 3.8+.
"""

import os
import sys
from collections import Counter, defaultdict

# Emit UTF-8 regardless of the console's default codepage (Windows defaults to cp1252,
# which mangles the em dashes below). reconfigure() exists on Python 3.7+.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

# Directories never worth walking — build output, caches, vendored deps, VCS internals.
IGNORE_DIRS = {
    ".git", ".hg", ".svn", "node_modules", "vendor", "dist", "build", "out",
    "target", "bin", "obj", ".venv", "venv", "env", "__pycache__", ".mypy_cache",
    ".pytest_cache", ".tox", ".gradle", ".idea", ".vscode", ".godot", ".next",
    ".nuxt", ".cache", "coverage", ".dart_tool", "Pods", ".terraform",
}

# Manifest / build files → what stack they signal.
MANIFESTS = {
    "package.json": "JavaScript/TypeScript (npm)",
    "tsconfig.json": "TypeScript config",
    "pnpm-workspace.yaml": "JS monorepo (pnpm)",
    "lerna.json": "JS monorepo (lerna)",
    "pyproject.toml": "Python (PEP 621)",
    "setup.py": "Python (setuptools)",
    "setup.cfg": "Python (setuptools)",
    "requirements.txt": "Python (pip)",
    "Pipfile": "Python (pipenv)",
    "go.mod": "Go modules",
    "Cargo.toml": "Rust (cargo)",
    "pom.xml": "Java (Maven)",
    "build.gradle": "Java/Kotlin (Gradle)",
    "build.gradle.kts": "Kotlin (Gradle)",
    "Gemfile": "Ruby (bundler)",
    "composer.json": "PHP (composer)",
    "project.godot": "Godot engine",
    "CMakeLists.txt": "C/C++ (CMake)",
    "Makefile": "Make-based build",
    "Dockerfile": "Docker image",
    "docker-compose.yml": "Docker Compose",
    "docker-compose.yaml": "Docker Compose",
    "pubspec.yaml": "Dart/Flutter",
    "mix.exs": "Elixir (mix)",
}

# Existing docs worth knowing about before generating anything (augment, don't clobber).
DOC_HINTS = (
    "readme", "claude.md", "agents.md", "contributing", "architecture", "glossary",
    "roadmap", "index.md", "conventions", "changelog", "docs",
)

# Extension → language label, for the language histogram.
EXT_LANG = {
    ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript",
    ".mjs": "JavaScript", ".cjs": "JavaScript", ".py": "Python", ".go": "Go",
    ".rs": "Rust", ".java": "Java", ".kt": "Kotlin", ".cs": "C#", ".rb": "Ruby",
    ".php": "PHP", ".gd": "GDScript", ".c": "C", ".h": "C/C++ header", ".cpp": "C++",
    ".cc": "C++", ".hpp": "C++ header", ".swift": "Swift", ".dart": "Dart",
    ".ex": "Elixir", ".exs": "Elixir", ".scala": "Scala", ".clj": "Clojure",
    ".sh": "Shell", ".sql": "SQL", ".vue": "Vue", ".svelte": "Svelte",
}

# Filename patterns that commonly mark an entry point.
ENTRY_BASENAMES = {
    "main", "index", "app", "server", "cli", "__main__", "program", "startup",
    "manage", "wsgi", "asgi", "bootstrap", "run",
}
ENTRY_EXACT = {
    "main.go", "main.rs", "Program.cs", "manage.py", "wsgi.py", "asgi.py",
    "config.ru", "Application.java",
}


def human(n):
    return f"{n:,}"


def walk(root):
    """Yield (dirpath, dirnames, filenames) with ignore dirs pruned in place."""
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS and not d.startswith(".")]
        yield dirpath, dirnames, filenames


def main():
    root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
    if not os.path.isdir(root):
        print(f"ERROR: not a directory: {root}", file=sys.stderr)
        return 1

    ext_counts = Counter()
    lang_counts = Counter()
    manifests_found = []        # (relpath, label)
    docs_found = []             # relpath
    entry_candidates = []       # relpath
    toplevel = defaultdict(lambda: {"files": 0, "exts": Counter()})
    total_files = 0

    for dirpath, dirnames, filenames in walk(root):
        rel_dir = os.path.relpath(dirpath, root)
        top = "." if rel_dir == "." else rel_dir.split(os.sep)[0]

        for fn in filenames:
            total_files += 1
            rel = os.path.relpath(os.path.join(dirpath, fn), root).replace(os.sep, "/")
            ext = os.path.splitext(fn)[1].lower()
            base = os.path.splitext(fn)[0].lower()
            lower = fn.lower()

            ext_counts[ext] += 1
            if ext in EXT_LANG:
                lang_counts[EXT_LANG[ext]] += 1
            if top != ".":
                toplevel[top]["files"] += 1
                toplevel[top]["exts"][ext] += 1

            if fn in MANIFESTS:
                manifests_found.append((rel, MANIFESTS[fn]))
            if ext == ".csproj" or ext == ".sln":
                manifests_found.append((rel, "C#/.NET project"))

            if any(h in lower for h in DOC_HINTS) and ext in (".md", ".rst", ".txt", ""):
                docs_found.append(rel)

            # Entry-point heuristics: known exact names, or known basenames at shallow depth.
            depth = rel.count("/")
            if fn in ENTRY_EXACT:
                entry_candidates.append(rel)
            elif base in ENTRY_BASENAMES and ext in EXT_LANG and depth <= 3:
                entry_candidates.append(rel)

    # ---- Report ----
    out = []
    out.append(f"# Repo scan: {root}")
    out.append("")
    out.append(f"Total files scanned (excluding ignored dirs): **{human(total_files)}**")
    out.append("")

    out.append("## Detected languages (by file count)")
    if lang_counts:
        for lang, n in lang_counts.most_common(12):
            out.append(f"- {lang}: {human(n)}")
    else:
        out.append("- (no recognized source files — may be a docs/data repo)")
    out.append("")

    out.append("## Build / manifest files")
    if manifests_found:
        seen = set()
        for rel, label in sorted(manifests_found):
            key = (rel, label)
            if key in seen:
                continue
            seen.add(key)
            out.append(f"- `{rel}` — {label}")
    else:
        out.append("- (none detected — confirm the build system manually)")
    out.append("")

    out.append("## Existing docs (augment, don't clobber)")
    if docs_found:
        for rel in sorted(set(docs_found))[:40]:
            out.append(f"- `{rel}`")
    else:
        out.append("- (none found — you're creating the doc layer from scratch)")
    out.append("")

    out.append("## Top-level directories")
    if toplevel:
        rows = sorted(toplevel.items(), key=lambda kv: kv[1]["files"], reverse=True)
        for name, info in rows:
            dom = info["exts"].most_common(1)
            dom_s = f", mostly `{dom[0][0] or '(no ext)'}`" if dom else ""
            out.append(f"- `{name}/` — {human(info['files'])} files{dom_s}")
    else:
        out.append("- (flat repo — all files at root)")
    out.append("")

    out.append("## Candidate entry points (verify by reading)")
    if entry_candidates:
        for rel in sorted(set(entry_candidates))[:40]:
            out.append(f"- `{rel}`")
        out.append("")
        out.append("> Heuristic guesses. Open each and the manifest to confirm which are real entry points.")
    else:
        out.append("- (none matched the heuristics — read the manifest's scripts/bin section)")
    out.append("")

    out.append("## Next steps")
    out.append("1. Read each manifest above — it names entry points, scripts, and the build commands.")
    out.append("2. Open the confirmed entry points and trace one golden path through the layers.")
    out.append("3. Sweep each top-level directory for its responsibility.")
    out.append("4. See `references/discovery_playbook.md` for stack-specific hints.")

    print("\n".join(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
