# Design: Replace date-fns with Obsidian's bundled Moment.js

**Date:** 2026-05-20
**Status:** Approved
**Issue:** Fixes #19 — "date format doesn't support YY, unable to Create your first moment"

## Problem

The plugin's user-facing **Date format** setting accepts Moment.js format
tokens (`YYYY`, `YY`, `DD`, ...) — it is auto-detected from the core Daily
Notes plugin, which uses Moment syntax, as does the wider Obsidian ecosystem.

Internally, however, the plugin uses **date-fns**, whose token language is
different (`yyyy`, `dd`, ...). `src/core/date-parser.ts` bridges the two with a
hand-rolled `toFnsFormat()` translator that only handles `YYYY`, `YY`, and
`DD`. Any other Moment token is left untranslated. date-fns then interprets a
bare `YY`/`YYYY` as a week-numbering-year token and throws a `RangeError`.

With a format such as `YY.MM.DD`, the `MomentModal` constructor calls
`formatDate(new Date(), settings.dateFormat)`, which throws — so "Create your
first moment" silently fails (issue #19).

A second, independent copy of the problem lives in
`src/core/periodic-detection.ts`: `buildDatePatternForDetection()` and
`parseDateFromFormat()` form a separate regex-based format tokenizer that also
handles only `YYYY/MM/DD/M/D`. Two parallel, partial implementations of
"interpret a date format."

## Decision

Drop date-fns entirely and use Obsidian's bundled Moment.js
(`import { moment } from 'obsidian'`). Obsidian provides moment at runtime, so
it adds **zero bundle cost** and the plugin natively speaks the same date
format language as Obsidian, Daily Notes, and Periodic Notes.

Rejected alternatives:

- **Complete the date-fns translator.** Keeps date-fns plus a permanent shim;
  the Moment and date-fns token sets do not map 1:1.
- **Restrict tokens and document.** Smallest change, but it degrades
  auto-detection: any Daily Notes format using an unsupported token would be
  rejected rather than handled.

The "moment is in maintenance mode" caveat does not apply here — using the
host platform's bundled date library is the ecosystem-correct, zero-cost
choice.

## Changes

### 1. `src/core/date-parser.ts` — reimplement on moment

This file is the only one that imports the date library; it remains the single
chokepoint.

- `formatDate(date, format)` → `moment(date).format(format)`
- `parseDate(string, format)`:
  - keep the existing empty-string guard (`if (!dateString) return null`)
  - `const m = moment(string, format, true); return m.isValid() ? m.toDate() : null;`
- Delete `toFnsFormat()` — moment's tokens are the user-facing tokens; no
  translation is needed.
- `DEFAULT_DATE_FORMAT = 'YYYY-MM-DD'` is unchanged. moment formats it
  identically, so the canonical internal date string (`YYYY-MM-DD`, used as
  cache keys throughout) is unchanged.

Behavior notes:

- moment **strict mode** (the `true` third argument) rejects both format
  mismatches and invalid dates (month 13, Feb 30, via overflow detection), so
  the current hand-rolled round-trip validation is no longer needed.
- `YY` century resolution uses moment's fixed pivot: `00`–`68` → 2000s,
  `69`–`99` → 1900s (so `26` → 2026). This is the Obsidian/Daily Notes
  standard and removes the reference-date subtlety of the earlier date-fns
  patch.

### 2. `src/core/periodic-detection.ts` — unify the second tokenizer

- Replace the daily-note branch of `detectPeriodicNoteType()` with
  `moment(filename, dailyFormat, true)`: if valid, return
  `{ type: 'daily', date: m.format('YYYY-MM-DD') }`.
- Delete `buildDatePatternForDetection()` and `parseDateFromFormat()`.
- The hardcoded weekly/monthly/quarterly/yearly `PERIODIC_PATTERNS` regexes
  stay as-is — they are fixed conventions, not user-configurable, and out of
  scope.

### 3. Cleanup

- `package.json`: remove `date-fns` from `dependencies`.
- esbuild: no change. `moment` is imported via `import { moment } from
  'obsidian'`, which resolves through the already-external `obsidian` module.
- Build-time check: confirm TypeScript resolves moment's types. If the
  type-check fails, add `moment` to `devDependencies` (types only).
- No settings migration: moment is a strict superset of the formats date-fns
  handled, so existing saved `dateFormat` values keep working.
- Documentation: update the **Date format** setting description and any
  relevant `AGENTS.md` / `README.md` wording to reference Moment.js tokens.

## Testing

Test-driven, following the project's `npm run lint && npm test && npm run
build` rule:

- Carry the issue-#19 tests into the new branch as acceptance tests:
  `formatDate` with `YY.MM.DD`, `parseDate` of a `YY` date, and invalid-`YY`
  rejection.
- Add `periodic-detection` tests covering a `YY`-based daily-note format.
- Confirm strict mode rejects overflow dates (`2026-02-30`, `2026-13-01`) and
  format mismatches — the existing `parseDate` test cases must still pass.
- All 241 existing tests must remain green.

## Process

- New branch off `main`.
- PR #22 (the interim date-fns `YY` patch) is closed unmerged; this work is the
  single fix for issue #19.
- Scope: `date-parser.ts`, `periodic-detection.ts`, their tests, and
  `package.json`.

## Out of scope

- Weekly/monthly/quarterly/yearly periodic-note pattern configurability.
- Any change to the canonical internal date representation (`YYYY-MM-DD`).
