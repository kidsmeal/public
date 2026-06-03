# codebase-cartographer

A Claude Code skill that documents a codebase. Point it at a repo and it produces:

- A codebase map (`docs/INDEX.md`) — entry points, modules and subsystems with their key files, the main data flow, and the build/run/test commands.
- A "Where things are" section wired into `CLAUDE.md` that links to the docs below.
- A glossary (`docs/GLOSSARY.md`) of project-specific terms.
- A roadmap (`docs/ROADMAP.md`) of active work.
- A conventions doc (`docs/CONVENTIONS.md`) covering naming, layout, and idioms.

It reads the actual files before writing anything, verifies that every path it cites exists, and won't overwrite docs you already have. You can ask for the whole set or just one piece (for example, only the codebase map).

## Install

Two options.

**1. Single file.** Download `codebase-cartographer.skill` and install it in Claude Code's plugin/skill installer.

**2. Folder.** Clone this repo and copy the skill folder into your personal skills directory:

```bash
git clone https://github.com/kidsmeal/public.git
cp -r public/skills/codebase-cartographer ~/.claude/skills/
```

Restart Claude Code afterward so it picks up the new skill.

## Use

Once installed, ask in plain language — for example:

- "map this codebase"
- "set up CLAUDE.md so it knows the layout"
- "I inherited this repo and don't know where anything is"
- "just make a codebase map under docs/"

The skill scans the repo, shows you a proposed structure, then writes the docs after you confirm.

## What's in this folder

```
codebase-cartographer/
├── SKILL.md                         # the skill itself (workflow + rules)
├── references/
│   ├── codebase_map_guide.md        # how the codebase map is structured
│   ├── satellite_docs.md            # templates for glossary/roadmap/conventions/CLAUDE.md
│   └── discovery_playbook.md        # per-language hints for finding entry points and modules
├── scripts/
│   └── scan_repo.py                 # repo inventory scanner (Python 3.8+, no dependencies)
└── codebase-cartographer.skill      # the same skill packaged as a single installable file
```

## Requirements

- Claude Code.
- Python 3.8+ for `scan_repo.py` (optional — the skill works without it, the scanner just speeds up the first pass).
