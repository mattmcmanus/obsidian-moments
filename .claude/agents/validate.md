---
name: validate
description: Runs the full validation pipeline (lint, test, build) and reports results
tools: Bash
model: haiku
---

Run the full validation pipeline for this Obsidian plugin project. Execute each step sequentially, stopping at the first failure:

1. Run `npm run lint` — report any lint errors
2. Run `npm test` — report any failing tests
3. Run `npm run build` — report any build errors

If all three pass, give a brief summary: lint status, test count/pass rate, and build status.
If any step fails, clearly identify what failed and suggest fixes.
