# Lightweight Day Indicators Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace individual implicit moment entries with grouped summaries and add an active file moments indicator when the related filter is active.

**Architecture:** Two lightweight indicators render at the bottom of each day group: (1) an active file indicator showing how many moments the current file has on that day, and (2) a grouped implicit summary replacing N individual entries with a single truncated line. Both share a muted `.moments-day-indicator` style. The `ImplicitMoment` type is simplified by dropping the `action` field. Two new pure functions in `timeline-helpers.ts` handle text formatting (testable).

**Tech Stack:** TypeScript, Obsidian API, Jest

---

## Task 1: Pure functions — `formatImplicitSummary` and `formatActiveFileIndicator`

**Files:**
- Modify: `src/core/timeline-helpers.ts` (add two functions at bottom)
- Modify: `__tests__/core/timeline-helpers.test.ts` (add test cases)

### Step 1: Write the failing tests

Add to `__tests__/core/timeline-helpers.test.ts`:

```typescript
describe('formatImplicitSummary', () => {
    it('returns empty string for no files', () => {
        expect(formatImplicitSummary([])).toBe('');
    });

    it('formats a single file', () => {
        expect(formatImplicitSummary(['Note A'])).toBe('Note A modified');
    });

    it('formats two files', () => {
        expect(formatImplicitSummary(['Note A', 'Note B'])).toBe('Note A, Note B modified');
    });

    it('formats three files without truncation', () => {
        expect(formatImplicitSummary(['Note A', 'Note B', 'Note C']))
            .toBe('Note A, Note B, Note C modified');
    });

    it('truncates four or more files to two visible names', () => {
        expect(formatImplicitSummary(['Note A', 'Note B', 'Note C', 'Note D']))
            .toBe('Note A, Note B, and 2 more modified');
    });

    it('truncates many files correctly', () => {
        const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
        expect(formatImplicitSummary(files))
            .toBe('A, B, and 5 more modified');
    });
});

describe('formatActiveFileIndicator', () => {
    it('formats singular moment count', () => {
        expect(formatActiveFileIndicator(1, 'Project Alpha'))
            .toBe('1 moment in Project Alpha');
    });

    it('formats plural moment count', () => {
        expect(formatActiveFileIndicator(3, 'Project Alpha'))
            .toBe('3 moments in Project Alpha');
    });
});
```

Update the import at the top to include the new functions:

```typescript
import {
    getPreviousMonth,
    getDatesForMonth,
    groupMomentsByDate,
    formatImplicitSummary,
    formatActiveFileIndicator,
} from '../../src/core/timeline-helpers';
```

### Step 2: Run tests to verify they fail

Run: `npm test -- --testPathPattern=timeline-helpers`
Expected: FAIL — `formatImplicitSummary` and `formatActiveFileIndicator` are not exported.

### Step 3: Implement the functions

Add to `src/core/timeline-helpers.ts`:

```typescript
/**
 * Format a grouped summary of implicit (modified) files for a day.
 * Shows up to 3 names; if more, shows 2 names + "and X more".
 *
 * @param fileNames - Array of file display names
 * @returns Formatted summary string, or empty string if no files
 */
export function formatImplicitSummary(fileNames: string[]): string {
    if (fileNames.length === 0) return '';
    if (fileNames.length <= 3) {
        return `${fileNames.join(', ')} modified`;
    }
    const visible = fileNames.slice(0, 2);
    const remaining = fileNames.length - 2;
    return `${visible.join(', ')}, and ${remaining} more modified`;
}

/**
 * Format the active file moments indicator for a day.
 *
 * @param count - Number of moments in the active file on this day
 * @param fileName - Display name of the active file
 * @returns Formatted indicator string (e.g., "3 moments in Project Alpha")
 */
export function formatActiveFileIndicator(count: number, fileName: string): string {
    return `${count} ${count === 1 ? 'moment' : 'moments'} in ${fileName}`;
}
```

### Step 4: Run tests to verify they pass

Run: `npm run lint && npm test && npm run build`
Expected: All tests pass including new ones. Lint and build clean.

### Step 5: Commit

```
feat: Add formatImplicitSummary and formatActiveFileIndicator pure functions
```

---

## Task 2: Simplify `ImplicitMoment` type — drop `action` field

**Files:**
- Modify: `src/types.ts:31-44` (remove `action` field)
- Modify: `src/main.ts:472-546` (remove `action` from pushed objects in `getImplicitMomentsForDisplay`)
- Modify: `src/views/timeline-view.ts:658-681` (remove action rendering in `renderImplicitMoment`)
- Modify: `src/settings/settings-tab.ts:199-208` (update description text)

### Step 1: Remove `action` from `ImplicitMoment`

In `src/types.ts`, change the interface from:

```typescript
export interface ImplicitMoment {
    filePath: string;
    fileName: string;
    action: 'created' | 'updated';
    date: string;
    timestamp: number;
}
```

To:

```typescript
export interface ImplicitMoment {
    filePath: string;
    fileName: string;
    date: string;
    timestamp: number;
}
```

### Step 2: Update `getImplicitMomentsForDisplay` in `main.ts`

Remove `action: 'created',` and `action: 'updated',` from the two object literals pushed into the result map (~lines 518 and 530).

### Step 3: Update `renderImplicitMoment` in `timeline-view.ts`

Remove the action `<span>` creation (~lines 677-680):

```typescript
// Remove this block:
el.createEl('span', {
    cls: 'moments-implicit-action',
    text: ` ${implicit.action}`,
});
```

Replace with a static "modified" label:

```typescript
el.createEl('span', {
    cls: 'moments-implicit-action',
    text: ' modified',
});
```

(This is temporary — Task 3 will replace `renderImplicitMoment` entirely.)

### Step 4: Update settings description

In `src/settings/settings-tab.ts`, change the implicit moments setting description from:
`'Show files created or modified on each day as secondary entries'`
To:
`'Show modified files as a summary at the bottom of each day'`

### Step 5: Verify

Run: `npm run lint && npm test && npm run build`
Expected: All pass. The `action` field was only used in rendering — no tests reference it.

### Step 6: Commit

```
refactor: Drop created/updated distinction from ImplicitMoment — use "modified"
```

---

## Task 3: Replace individual implicit rendering with grouped summary

**Files:**
- Modify: `src/views/timeline-view.ts` — replace `renderImplicitMoment()` with `renderImplicitSummary()`, update call site in `renderDaySection()`
- Modify: `styles.css` — replace `.moments-implicit-action` with shared `.moments-day-indicator` class

### Step 1: Add `renderImplicitSummary` method

Replace `renderImplicitMoment()` (~lines 658-681) with:

```typescript
private renderImplicitSummary(container: HTMLElement, implicitMoments: ImplicitMoment[]): void {
    if (implicitMoments.length === 0) return;

    const el = container.createEl('div', { cls: 'moments-day-indicator' });

    // Deduplicate file names (a file should only appear once per day,
    // but guard against edge cases)
    const seen = new Set<string>();
    const uniqueImplicits: ImplicitMoment[] = [];
    for (const implicit of implicitMoments) {
        if (!seen.has(implicit.filePath)) {
            seen.add(implicit.filePath);
            uniqueImplicits.push(implicit);
        }
    }

    const fileNames = uniqueImplicits.map((m) => m.fileName);

    if (fileNames.length <= 3) {
        // Show all names as clickable links
        for (let i = 0; i < fileNames.length; i++) {
            if (i > 0) {
                el.appendText(', ');
            }
            this.createImplicitFileLink(el, uniqueImplicits[i]);
        }
        el.appendText(' modified');
    } else {
        // Show first 2 as links + "and X more modified"
        for (let i = 0; i < 2; i++) {
            if (i > 0) {
                el.appendText(', ');
            }
            this.createImplicitFileLink(el, uniqueImplicits[i]);
        }
        el.appendText(`, and ${fileNames.length - 2} more modified`);
    }
}

private createImplicitFileLink(container: HTMLElement, implicit: ImplicitMoment): void {
    const link = container.createEl('a', {
        cls: 'moments-implicit-link',
        text: implicit.fileName,
    });
    link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const file = this.app.vault.getAbstractFileByPath(implicit.filePath);
        if (file instanceof TFile) {
            this.pinned = true;
            this.updateHeader();
            void this.app.workspace.getLeaf().openFile(file);
        }
    });
}
```

### Step 2: Update call site in `renderDaySection()`

Replace the implicit moments loop (~lines 517-520):

```typescript
// Before:
for (const implicit of implicitMoments) {
    this.renderImplicitMoment(content, implicit);
}

// After:
if (this.plugin.settings.showImplicitMoments) {
    this.renderImplicitSummary(content, implicitMoments);
}
```

Wait — `showImplicitMoments` is already checked in `renderTimeline()` before populating `allImplicitByDate`. The array passed here will be empty if the setting is off. But adding the guard here is cleaner for self-documentation. Actually, remove the guard — it's redundant and the data is already gated. Just:

```typescript
this.renderImplicitSummary(content, implicitMoments);
```

### Step 3: Update CSS

In `styles.css`, replace the implicit moment styles (lines 193-212):

```css
/* Day Indicators (implicit summary, active file indicator) */
.moments-day-indicator {
    padding: 4px 12px;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    line-height: 1.4;
}

.moments-implicit-link {
    color: var(--text-muted);
    text-decoration: none;
}

.moments-implicit-link:hover {
    color: var(--text-accent);
    text-decoration: underline;
}
```

Remove `.moments-implicit` and `.moments-implicit-action` — no longer used.

### Step 4: Verify

Run: `npm run lint && npm test && npm run build`

### Step 5: Commit

```
feat: Replace individual implicit moments with grouped summary indicator
```

---

## Task 4: Add active file moments indicator

**Files:**
- Modify: `src/main.ts` — add `getMomentsForActiveFile()` public method
- Modify: `src/views/timeline-view.ts` — add `activeFileMomentsByDate` instance data, compute in `renderTimeline()`, add `renderActiveFileIndicator()`, call in `renderDaySection()`

### Step 1: Add `getMomentsForActiveFile()` to plugin

In `src/main.ts`, add a public method (near `getMomentsForDisplay`):

```typescript
/**
 * Get all moments belonging to a specific file (for active file indicator).
 */
getMomentsForActiveFile(filePath: string): Moment[] {
    return getMomentsForFile(this.momentCache, filePath);
}
```

Add `getMomentsForFile` to the import from `./core/moment-cache` (line ~10).

### Step 2: Add instance field to TimelineView

In `src/views/timeline-view.ts`, add after `allImplicitByDate`:

```typescript
private activeFileMomentsByDate = new Map<string, number>();
```

### Step 3: Compute active file data in `renderTimeline()`

After the implicit data fetch (~line 218), add:

```typescript
// Count active file's own moments per day (for indicator when related filter is active)
this.activeFileMomentsByDate = new Map<string, number>();
if (this.filter.relatedToFile) {
    const activeFileMoments = this.plugin.getMomentsForActiveFile(this.filter.relatedToFile);
    for (const m of activeFileMoments) {
        this.activeFileMomentsByDate.set(
            m.date,
            (this.activeFileMomentsByDate.get(m.date) ?? 0) + 1
        );
    }
}
```

Include in the fingerprint computation — add after the implicit fingerprint section in `computeFingerprint()`:

```typescript
// Active file indicator fingerprint
for (const [date, count] of this.activeFileMomentsByDate) {
    parts.push(`a:${date}:${count}`);
}
```

Also add `this.activeFileMomentsByDate` to the `allDates` set construction so days with only active file moments (no explicit moments or implicits) still show up:

```typescript
const allDates = new Set([
    ...this.groupedByDate.keys(),
    ...this.allImplicitByDate.keys(),
    ...this.activeFileMomentsByDate.keys(),
]);
```

### Step 4: Add `renderActiveFileIndicator()` method

```typescript
private renderActiveFileIndicator(container: HTMLElement, date: string): void {
    const count = this.activeFileMomentsByDate.get(date);
    if (!count || !this.filter.relatedToFile) return;

    const file = this.app.vault.getAbstractFileByPath(this.filter.relatedToFile);
    if (!(file instanceof TFile)) return;

    const text = formatActiveFileIndicator(count, file.basename);
    const el = container.createEl('div', { cls: 'moments-day-indicator' });
    const link = el.createEl('a', {
        cls: 'moments-implicit-link',
        text,
    });
    link.addEventListener('click', (e) => {
        e.preventDefault();
        void this.app.workspace.getLeaf().openFile(file);
    });
}
```

Add `formatActiveFileIndicator` to the import from `../core/timeline-helpers`.

### Step 5: Call in `renderDaySection()`

After the moment card loop, before the implicit summary call:

```typescript
// Create card shells (content rendered lazily via IntersectionObserver)
for (const moment of moments) {
    this.createMomentCardShell(content, moment);
}

// Active file moments indicator (when related filter is active)
this.renderActiveFileIndicator(content, date);

// Grouped implicit moments summary
this.renderImplicitSummary(content, implicitMoments);
```

### Step 6: Verify

Run: `npm run lint && npm test && npm run build`

### Step 7: Commit

```
feat: Add active file moments indicator to timeline day groups
```

---

## Task 5: Documentation updates

**Files:**
- Modify: `AGENTS.md`

### Step 1: Update AGENTS.md

In the "Key design decisions" or "Architecture" section, add:

```
- Day indicators: implicit moments grouped into "X, Y, and N more modified" summaries; active file indicator shows "N moments in File" when related filter is active
```

### Step 2: Verify

Run: `npm run lint && npm test && npm run build`

### Step 3: Commit

```
docs: Document lightweight day indicators in AGENTS.md
```

---

## Edge cases

- **Empty implicit array**: `renderImplicitSummary` returns early, renders nothing.
- **Single implicit moment**: Shows "Note A modified" — no truncation, no awkward plurals.
- **Active file with no moments on a day**: `renderActiveFileIndicator` checks count and returns early.
- **No related filter active**: `activeFileMomentsByDate` is empty map, indicator never renders.
- **Fingerprint stability**: Active file data is included in fingerprint so changes trigger re-render.
- **allDates includes active file days**: A day with only active file moments (no explicit or implicit) still renders — this ensures the indicator is visible even if the related filter excludes all explicit moments for that day.

## Verification

After all tasks:

```bash
npm run lint && npm test && npm run build
```

Manual testing in Obsidian:
1. Timeline shows grouped "Note A, Note B modified" instead of individual entries
2. Day with 5+ implicit moments shows "Note A, Note B, and 3 more modified"
3. Clicking file names in implicit summary still opens the file
4. With related filter active, "3 moments in Project Alpha" indicator appears on relevant days
5. Clicking the active file indicator focuses the note
6. Toggle "Show implicit moments" off — grouped summary disappears
7. Performance: large vault day with many modified files renders one summary div instead of dozens
