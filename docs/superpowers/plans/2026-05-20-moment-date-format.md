# Moment-Based Date Formatting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace date-fns with Obsidian's bundled Moment.js so the plugin natively handles Moment date-format tokens (fixes #19) and the two parallel format tokenizers are unified.

**Architecture:** `src/core/date-parser.ts` is the single chokepoint for the date library; it is reimplemented on `moment` (imported from `obsidian`). `src/core/periodic-detection.ts`'s hand-rolled daily-format tokenizer is replaced by a strict `moment` parse. date-fns is removed entirely.

**Tech Stack:** TypeScript, Moment.js (provided by Obsidian at runtime, zero bundle cost), Jest + ts-jest (ESM preset).

**Spec:** `docs/superpowers/specs/2026-05-20-moment-date-format-design.md`

---

## File Structure

- `__tests__/__mocks__/obsidian.ts` — **Create.** Jest mock for the `obsidian` module; re-exports `moment` so core tests can import it.
- `jest.config.js` — **Modify.** Add a `moduleNameMapper` entry routing `obsidian` to the mock.
- `src/core/date-parser.ts` — **Modify.** Reimplement `formatDate`/`parseDate` on `moment`; delete `toFnsFormat()` and the date-fns import.
- `__tests__/core/date-parser.test.ts` — **Modify.** Add `YY` (two-digit year) tests.
- `src/core/periodic-detection.ts` — **Modify.** Replace the daily-note tokenizer with a `moment` parse; delete `buildDatePatternForDetection()` and `parseDateFromFormat()`.
- `__tests__/core/periodic-detection.test.ts` — **Modify.** Add a `YY`-based daily-format test.
- `package.json` — **Modify.** Remove `date-fns` from `dependencies`; add `moment` to `devDependencies`.
- `src/settings/settings-tab.ts` — **Modify.** Update the **Date format** setting description.

---

## Task 1: Add an `obsidian` test mock

The plugin will import `moment` from `obsidian`. Under Jest there is no real `obsidian` module, so core tests that reach `date-parser.ts` need a mock. The standalone `moment` package (a transitive dependency of `obsidian`) is used for the mock.

**Files:**
- Create: `__tests__/__mocks__/obsidian.ts`
- Modify: `jest.config.js` (the `moduleNameMapper` object)

- [ ] **Step 1: Create the mock file**

Create `__tests__/__mocks__/obsidian.ts`:

```ts
// Test mock for the `obsidian` module.
//
// The plugin imports `moment` from `obsidian` (Obsidian bundles Moment.js).
// Under Jest there is no real `obsidian` module, so re-export the standalone
// `moment` package instead — it is the same library Obsidian provides.
import moment from 'moment';

export { moment };
```

- [ ] **Step 2: Route `obsidian` imports to the mock**

In `jest.config.js`, replace the `moduleNameMapper` object:

```js
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1',
	},
```

with:

```js
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1',
		'^obsidian$': '<rootDir>/__tests__/__mocks__/obsidian.ts',
	},
```

- [ ] **Step 3: Verify the suite still passes**

Run: `npm test`
Expected: PASS — `Test Suites: 11 passed`, `Tests: 238 passed`. (No file imports `obsidian` yet, so the mapper is inert; this confirms it did not break resolution.)

- [ ] **Step 4: Commit**

```bash
git add __tests__/__mocks__/obsidian.ts jest.config.js
git commit -m "test: Add obsidian module mock re-exporting moment"
```

---

## Task 2: Reimplement `date-parser.ts` on Moment.js

**Files:**
- Test: `__tests__/core/date-parser.test.ts`
- Modify: `src/core/date-parser.ts`

- [ ] **Step 1: Write the failing tests**

In `__tests__/core/date-parser.test.ts`, add this block at the end of the file (after the closing `});` of the `parseDate` describe):

```ts
describe('two-digit year (YY) format', () => {
	it('formats a date with YY.MM.DD format', () => {
		const date = new Date(2026, 4, 20); // May 20, 2026
		expect(formatDate(date, 'YY.MM.DD')).toBe('26.05.20');
	});

	it('parses a YY.MM.DD date string', () => {
		const result = parseDate('26.05.20', 'YY.MM.DD');
		expect(result?.getFullYear()).toBe(2026);
		expect(result?.getMonth()).toBe(4); // 0-indexed
		expect(result?.getDate()).toBe(20);
	});

	it('returns null for an invalid YY.MM.DD date', () => {
		expect(parseDate('26.13.20', 'YY.MM.DD')).toBeNull(); // Invalid month
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/core/date-parser.test.ts`
Expected: FAIL — the three new tests throw `RangeError: Use \`yy\` instead of \`YY\``. (date-fns rejects the bare `YY` token left by `toFnsFormat()`.) The 12 existing tests still pass.

- [ ] **Step 3: Reimplement `date-parser.ts` on moment**

Replace the **entire contents** of `src/core/date-parser.ts` with:

```ts
import { moment } from 'obsidian';

/**
 * Default date format (ISO 8601).
 *
 * Formats use Moment.js tokens — the same token language Obsidian and the
 * core Daily Notes plugin use (YYYY, YY, MM, DD, ...).
 */
export const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';

/**
 * Format a Date object as a string using the given Moment.js format.
 */
export function formatDate(date: Date, format: string = DEFAULT_DATE_FORMAT): string {
	return moment(date).format(format);
}

/**
 * Parse a date string using the given Moment.js format.
 *
 * Parsing is strict: the string must match the format exactly and represent
 * a real calendar date (e.g. Feb 30 and month 13 are rejected).
 *
 * @returns A Date object, or null if parsing fails or the date is invalid
 */
export function parseDate(dateString: string, format: string = DEFAULT_DATE_FORMAT): Date | null {
	if (!dateString) return null;

	const parsed = moment(dateString, format, true);
	return parsed.isValid() ? parsed.toDate() : null;
}
```

This removes the `date-fns` import and the `toFnsFormat()` helper.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/core/date-parser.test.ts`
Expected: PASS — all 15 tests in the file green (12 existing + 3 new). If the run errors on importing `obsidian`, the Task 1 mock is misconfigured — fix the mock before continuing.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — `Tests: 241 passed`.

- [ ] **Step 6: Commit**

```bash
git add src/core/date-parser.ts __tests__/core/date-parser.test.ts
git commit -m "refactor: Reimplement date-parser on Obsidian's Moment.js"
```

---

## Task 3: Reimplement periodic-detection daily detection on Moment.js

`detectPeriodicNoteType()` has its own regex-based tokenizer for the daily-note format. Replace it with a strict `moment` parse and delete the dead helpers.

**Files:**
- Test: `__tests__/core/periodic-detection.test.ts`
- Modify: `src/core/periodic-detection.ts`

- [ ] **Step 1: Write the failing test**

In `__tests__/core/periodic-detection.test.ts`, inside the `describe('daily notes', ...)` block, add this test after the `'detects daily note with different format'` test:

```ts
		it('detects daily note with two-digit year format', () => {
			const result = detectPeriodicNoteType('26.05.20.md', '', 'YY.MM.DD');
			expect(result).toEqual({
				type: 'daily',
				date: '2026-05-20',
			});
		});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/core/periodic-detection.test.ts`
Expected: FAIL — `expect(received).toEqual(expected)`, received `null`. (`buildDatePatternForDetection()` does not translate the `YY` token, so the filename does not match.) Existing tests still pass.

- [ ] **Step 3: Add the moment import**

In `src/core/periodic-detection.ts`, the first line is currently:

```ts
import { formatDate } from './date-parser';
```

Replace it with:

```ts
import { moment } from 'obsidian';
import { formatDate } from './date-parser';
```

- [ ] **Step 4: Replace the daily-detection logic**

In `detectPeriodicNoteType()`, replace this block:

```ts
	// Build pattern from daily format
	const dailyPattern = buildDatePatternForDetection(dailyFormat);

	// Check if matches daily format
	const matchesDaily = dailyPattern.test(filename);

	if (matchesDaily) {
		const date = parseDateFromFormat(filename, dailyFormat);
		if (date) {
			return { type: 'daily', date };
		}
	}
```

with:

```ts
	// Check if the filename matches the configured daily-note format.
	// Strict parsing requires an exact match and a real calendar date.
	const dailyMoment = moment(filename, dailyFormat, true);
	if (dailyMoment.isValid()) {
		return { type: 'daily', date: dailyMoment.format('YYYY-MM-DD') };
	}
```

- [ ] **Step 5: Delete the dead helpers**

Delete the two now-unused functions from `src/core/periodic-detection.ts` in their entirety:

- `buildDatePatternForDetection(format: string): RegExp` — including its `/** Build a regex pattern... */` doc comment.
- `parseDateFromFormat(dateStr: string, format: string): string | null` — including its `/** Parse a date string... */` doc comment.

(`getWeekRange`, `getMonthRange`, `getQuarterRange`, `getYearRange`, and the `PERIODIC_PATTERNS` regexes are unchanged.)

- [ ] **Step 6: Run the periodic-detection tests**

Run: `npx jest __tests__/core/periodic-detection.test.ts`
Expected: PASS — all tests in the file green, including the new two-digit-year test.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS — `Tests: 242 passed`.

- [ ] **Step 8: Commit**

```bash
git add src/core/periodic-detection.ts __tests__/core/periodic-detection.test.ts
git commit -m "refactor: Use moment for periodic daily-note detection"
```

---

## Task 4: Remove date-fns dependency and update user-facing copy

**Files:**
- Modify: `package.json`
- Modify: `src/settings/settings-tab.ts`

- [ ] **Step 1: Update package.json**

In `package.json`, remove the `date-fns` entry from `dependencies`. The `dependencies` block becomes:

```json
	"dependencies": {}
```

In `devDependencies`, add a `moment` entry (alphabetically, after `jest`):

```json
		"moment": "^2.29.4",
```

`moment` is declared as a dev dependency only — Obsidian provides it at runtime and it is never bundled. It is present here for the test mock and type resolution.

- [ ] **Step 2: Sync the lockfile**

Run: `npm install`
Expected: completes without error; `package-lock.json` updated. `date-fns` may remain in the lockfile as a transitive dependency of nothing — that is fine; confirm it is no longer a direct dependency with `npm ls date-fns` (expected: `(empty)` or "not found" at the top level).

- [ ] **Step 3: Update the Date format setting description**

In `src/settings/settings-tab.ts`, find:

```ts
					.setDesc('Format for dates in headings and filenames. Auto-detected from daily notes if installed.')
```

Replace it with:

```ts
					.setDesc('Moment.js format for dates in headings and filenames. Auto-detected from daily notes if installed.')
```

- [ ] **Step 4: Run the full verification**

Run: `npm run lint && npm test && npm run build`
Expected: lint reports no errors; `Tests: 242 passed`; build completes (`tsc -noEmit` resolves `moment` types via `obsidian`, esbuild bundles with no date-fns).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/settings/settings-tab.ts
git commit -m "chore: Remove date-fns dependency"
```

---

## Self-Review Notes

- **Spec coverage:** date-parser reimplementation (Task 2), periodic-detection unification (Task 3), date-fns removal + docs (Task 4), test infrastructure for the `obsidian` import (Task 1) — all spec sections covered.
- **Type consistency:** `formatDate`/`parseDate` keep their existing signatures; callers are unaffected. `detectPeriodicNoteType`'s signature is unchanged.
- **Behavior:** moment strict mode replaces the date-fns round-trip check (verified: rejects `2026-02-30`, `2026-13-01`, format mismatches). `YY` resolves via moment's fixed pivot (`26` → 2026).

## Wrap-Up (after Task 4)

Not implementation steps — handle once all tasks are green:

1. Push the branch and open a PR titled `fix: Support Moment.js date formats (replace date-fns)`, body referencing `Fixes #19`.
2. Close PR #22 (the interim date-fns `YY` patch) unmerged, with a comment pointing to the new PR.
