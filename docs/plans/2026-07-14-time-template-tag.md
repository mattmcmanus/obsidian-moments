# `{{time}}` template tag & chronological ordering — design

**Status:** Draft
**Date:** 2026-07-14
**Related:** [issue #35](https://github.com/mattmcmanus/obsidian-moments/issues/35)

## Summary

Make the `{{time}}` heading/filename variable real, and let the timeline read a
day in time order. Today `{{time}}` is advertised in the settings UI and
reserved on `TemplateVariables`, but no call site populates it, so it renders
back as the literal text `{{time}}`.

Moments get a time stamp of `HH:mm` at creation. The timeline sorts moments
within a day by that time, honouring a single new "Timeline order" setting that
applies consistently across days *and* within each day.

Use case (from the reporter): timestamped "breadcrumbs" for interstitial
journaling — drop entries through the day, read them back in order.

## Goals

- `{{time}}` resolves to the creation time in `HH:mm` (24-hour) form.
- `{{time}}` works everywhere templates render: inline headings, standalone
  filenames, and standalone note bodies.
- The timeline can order moments within a day by their time.
- Ordering is consistent: one direction applies to both the day list and the
  moments inside a day.

## Non-goals

- **No configurable time format.** Time is always `HH:mm`. See "Why the format
  is fixed" — a configurable format would make round-trip parsing fragile and
  the settings panel harder to explain. `14:30` is what the reporter asked for.
- **No manual time entry in the modal.** Time is auto-stamped at creation. This
  also removes the "insert a backdated entry at the right spot" problem — there
  is no backdated entry.
- **No `{{time:FORMAT}}` inline syntax** in headings/filenames (the note-body
  path via `evaluateCoreTemplate` already supports it and is unchanged).
- No change to how dates are parsed or linked.

## Decisions

| Question | Decision |
| --- | --- |
| Time source | Auto-stamp the current time when the moment is created. |
| Format | Fixed `HH:mm`, 24-hour. No setting. |
| Ordering scope | One direction across the whole timeline (days and within-day), not mixed. |
| Ordering control | A single "Timeline order" setting: **Newest first** (default) / **Oldest first**. |
| Time recovery for sorting | Parse the `HH:mm` token back out of the heading (robust across reloads). |

## Why `firstSeen` can't drive ordering

`firstSeen` looks like a creation timestamp but isn't a reliable one:

- For inline moments it is `Date.now()` captured **once per file scan**
  (`scanFileForMoments`), stamped on every heading in the file. Every entry in a
  daily note shares the same value, and it is **reset on each rescan/reload**.
  It records when the plugin last read the file, not when the entry was written.
- Only standalone moments get a stable `firstSeen` (file creation time).

So a daily note of interstitial entries — the exact target use case — cannot be
ordered by `firstSeen`. The time must be recovered from the heading text.

## Why the format is fixed

To sort chronologically the plugin has to read the time back out of a heading
like `### [[2026-07-14]] 14:30 Call with lawyer`. Headings are free-form: users
place `{{time}}` wherever they like and edit headings by hand. Locating and
parsing an *arbitrary* user-chosen format inside free text is fragile and hard
to describe in settings.

Fixing the emitted form to `HH:mm` makes recovery a single deterministic
regex (`\b([01]?\d|2[0-3]):[0-5]\d\b`), found anywhere in the heading — the same
"scan the heading for a known token" approach already used for dates. It also
keeps the settings panel to one new control instead of a format string users
must get exactly right for sorting to work.

## Design

### 1. Emit the time

- `date-parser.ts`: add `DEFAULT_TIME_FORMAT = 'HH:mm'` and a `formatTime(date)`
  helper (thin wrapper over `moment().format`).
- `commands/add-inline.ts` and `commands/standalone-note.ts`: populate
  `time: formatTime(new Date())` on the `TemplateVariables` passed to
  `buildHeadingString` / `buildFilename` / `renderTemplate`. `renderTemplate`
  already substitutes any provided variable, so no engine change is needed for
  substitution — only the missing value.
- `template-engine.ts`: refresh the `TemplateVariables` doc comment; drop the
  unused `datetime` field unless a caller needs it.

### 2. Recover the time (parsing)

- `heading-parser.ts`: after extracting the date, scan the remaining heading
  text for the first `HH:mm` token. Return it as `time?: string` on
  `ParsedMomentHeading`, and strip it from the derived `title` so titles stay
  clean.
- `moment-scanner.ts`: carry `time` onto the `Moment` it builds.
- Standalone moments have no heading; their `time` stays undefined and they fall
  back to `firstSeen` (their stable file ctime) for ordering.

### 3. Sort by time

- `types.ts`: add `time?: string` (`HH:mm`) to `Moment`.
- `moment-cache.ts`: the day-level sorts (`getMomentsForDate`,
  `getMomentsInDateRange`) key on `time` when present, falling back to
  `firstSeen`, then take a direction argument driven by the setting.
- `moment-cache.ts`: `getAllDatesWithMoments` honours the same direction for the
  day list.

Comparator within a day (ascending shown; descending negates):

```
by time asc, missing-time last, then firstSeen asc as a tiebreak
```

### 4. Settings

- `settings.ts` / `settings-tab.ts`: add `timelineOrder: 'newest' | 'oldest'`,
  default `'newest'` (preserves today's reverse-chronological behaviour). One
  dropdown under the Timeline section: **Newest first** / **Oldest first**. It
  drives both the day list and within-day ordering, so the timeline never mixes
  directions.
- Keep the existing `{{time}}` mention in the heading-template description — it
  is now accurate.

### 5. Round-trip safety

`### [[2026-07-14]] 14:30 Call` already parses today: the date is found first and
everything after becomes the title. This change only pulls the `HH:mm` token out
of that title and onto `Moment.time`. Headings without a time keep working
unchanged (`time` undefined, `firstSeen` fallback). No migration needed.

## Testing

- `template-engine.test.ts`: `{{time}}` substitution; template with no `{{time}}`
  unaffected; `{{time}}` in filename templates.
- `heading-parser.test.ts`: time extracted from various positions; time stripped
  from title; heading with no time yields `time: undefined`; a time-like string
  inside a title (e.g. wiki-link labels) doesn't cause a false title strip.
- `moment-cache.test.ts`: within-day ordering by time asc/desc; missing-time
  fallback ordering; day-list direction follows the setting.
- Run `npm run lint && npm test && npm run build`.

## Open questions

- **False positives:** a title that legitimately contains `9:15` (e.g. "call at
  9:15 about…") would be read as the moment's time. Acceptable given the fixed
  format and first-match rule, or should parsing only trust a time immediately
  adjacent to the date? Leaning: first-match, document the behaviour.
- **Ordering default:** keep `newest` as default (chosen here) so existing users
  see no change; the reporter flips to `oldest`.
