---
name: evergreen-comments
allowed-tools: Read, Grep
description: Write code comments, PR descriptions, PR review replies, and other reader-facing prose so they describe the code as it is now — never the journey of how it got there, and never a transient PR/sibling-change reference. Use whenever writing or editing a code comment, a PR title/description/comment, or restating an issue. Triggers on adding/editing comments, opening or updating a PR, or replying to review feedback.
---

# Evergreen Comments & Prose

Reader-facing prose describes the **current contract**, stated as timeless fact. It does not narrate how the author arrived, and it does not reference transient PRs or sibling changes. Delivery state and iteration history rot the moment PRs renumber, branches reland, or the work gets restructured — and the reader years later cares about the invariant the code upholds, not the path to it. Archaeology is `git log` / `git blame` territory.

This codebase is **open source** and uses **public GitHub issues**. A linked issue (`#15`) is a durable, addressable reference and is fine in prose — but a PR number, a "PR A" label, or an "in this PR we…" framing is delivery state that rots.

**Scope.** These rules govern prose you *write or introduce*: code comments, skill files, PR descriptions, PR review replies, and issue restatements. Two things are deliberately outside it: **commit messages** (see [Where the journey legitimately goes](#where-the-journey-legitimately-goes)) and **pre-existing prose you're merely editing around** — you need not clean up rot you didn't write.

## The two rules

### 1. Present the code as it is — not the journey

Strip anything about *how the author got here*. Within a single PR especially, the journey is worthless to a future reader.

Always cut:
- "An earlier revision / earlier attempt did X", "First I tried A, then B, then C"
- "Originally we did X but switched to Y", "the first cut was X, redesigned to Y" — this describes a path **not** taken
- "I reproduced locally, narrowed to Y, reverted Z", "confirmed by reverting…", "diagnostic logs pinpointed…"
- Iteration timelines, SHA-by-SHA reports, "earlier this broke six tests"
- **Temporal / relative-time language**: "until now", "used to", "previously", "the old behavior was", "now we", "recently", "as of today". A reader has no anchor for *when* "now" is — the comment reads as if something just changed even when it changed years ago. State the contract timelessly.

### 2. No transient PR or sibling-change references

A **public GitHub issue** is durable and linkable, so referencing one (`#15`, `issues/15`) in prose is fine. What rots is delivery state — never write a *real* one of these into code comments, skill files, PR descriptions, or review replies. (Clearly-fake illustrative placeholders — like the anti-pattern examples in this very skill — are the obvious exception; you can't teach the rule without showing what it forbids.)
- **PR numbers / PR-letter labels** — `#4863` used as a PR, "PR A", "PR B", "stacked PR N", "in this PR we…"
- **Sibling-change references** — "same pattern the prior PR added", "see also that other PR's comments"

Name the **mechanism**, not the change:
- ❌ "PR A's timeline-fingerprint fix makes the on-demand refresh safe."
- ✅ "The render fingerprint dedupes redundant refreshes, so the on-demand path is safe to call repeatedly."

## Example: same content, evergreen vs. rotty

Rotty (don't write) — encodes delivery state, references a sibling PR, and uses "no longer":

```
// PR 3: the timeline no longer re-renders on every metadata change.
// We KEEP the debounce (rather than switching to a per-file diff)
// ...same pattern PR 2 added for the day-indicator surface.
```

Evergreen (write this) — same technical content, survives the next refactor:

```
// Metadata changes are batched (500ms) before the timeline refreshes (300ms),
// so a burst of edits collapses into one render. The render fingerprint then
// skips the refresh entirely when the visible month's moments are unchanged.
```

## PR descriptions and review replies

A PR description carries the **current shape only**: what the code does now, why this shape is right (constraints/trade-offs as live invariants, not "we tried X and it failed"), what's in scope vs. deferred, and the test plan. Link the issue it closes (`Closes #15`) — that's durable. When a PR pivots, the description gets rewritten to the new shape — not a changelog of the pivot.

A status comment after a re-push is a single sentence pointing at the description — nothing else. The iteration history goes in the issue or commit messages, or nowhere.

## Restating an issue

When an issue's original framing predates data you now have, rewrite it as a clean statement of the current problem → live measurements → path forward. Not "originally we thought X, but now we know Y", not "PRs landed since last update". No chronology.

## Where the journey legitimately goes

- **Commit messages** — exempt from the no-journey and temporal rules: one substantive change each, and the chronology / "why now" belongs here.
- **The GitHub issue / discussion** — full detail and chronology welcome.
- **`git blame` / `git log`** — the canonical history. Nothing in a comment competes with it.

## Self-check before publishing

Read it back. If a sentence starts with "Earlier", "Before", "Originally", "First I", "I tried", "I reproduced", "Confirmed by", "After reverting", "until now", "used to", "previously", or "now we" — that's journey or temporal rot. Cut it. If it names a PR number or PR letter, or points at a sibling change — cut that too (a linked public issue is fine). If what remains explains *what the code does now and why*, ship. If it explains *how you arrived*, cut more.

As stated in [Scope](#scope) above: pre-existing rotty references in code you're editing can stay — the rule governs prose you write, not cleanup of what's already there.
