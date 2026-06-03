---
description: Author a buildable design doc from a feature idea, interactively, before it enters the pipeline
argument-hint: <feature idea, in your own words>
---
Author a design doc for: $ARGUMENTS

Do this by following the **design-plan-creator** skill: load the project's conventions and the area the feature touches, then **grill me** through the open decisions one branch at a time - data/model, scope, behavior, contracts, edge cases - resolving each against the real codebase before writing anything. Grill first, write once. Only once the decisions are settled, write a structured design doc (Problem, Design, Contracts touched, Edge cases, Out of scope, Open questions).

Author the design only - do not write code or plan phases. When the doc is written, tell me its path and recommend `/gantry:design <path>` to audit it, or `/gantry:run <path>` to drive the whole pipeline from there. If I gave you no idea to work from, ask me what I want to design.
