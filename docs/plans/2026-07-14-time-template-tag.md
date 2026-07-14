# Time support for moments — design

**Status:** Draft
**Date:** 2026-07-14
**Related:** [issue #35](https://github.com/mattmcmanus/obsidian-moments/issues/35)

## Summary

Let inline moments carry a time of day, and let the timeline order a day by that
time. Time is encoded inside the date wiki-link's alias so the link target stays
a clean daily-note date:

```
### [[2026-07-14|2026-07-14 14:30]] Call with lawyer
```

An **Include time** toggle (inline moments only) turns this on; a **Time format**
field controls how the time is printed. Standalone moments take their time from
the file's creation timestamp. The timeline stays reverse-chronological — within
a day, later times sort first.

Use case (from the reporter): timestamped "breadcrumbs" for interstitial
journaling — drop entries through the day, read the day back in order.

## Goals

- Inline moments can include a time of day, printed in a user-chosen format.
- Time is carried in the wiki-link alias, keeping the link target a bare date.
- The timeline orders moments within a day by time, newest first.
- Standalone moments order by file creation time.

## Non-goals

- **No chronological (oldest-first) mode.** The timeline stays reverse-
  chronological across days and within a day. No ordering-direction setting.
- **No manual `{{time}}` placeholder.** Time is driven by the Include time
  toggle and encoded into the date link, not positioned by hand in the template.
- **No time in standalone filenames.** Standalone timing comes from file ctime.
- **No manual time entry.** Inline moments stamp the current time at creation.

## Decisions

| Question | Decision |
| --- | --- |
| Where time is shown | In the date wiki-link alias: `[[date\|date time]]`. |
| Enabling it | `includeTime` toggle, inline moments only, default off. |
| Format | `timeFormat` setting (Moment tokens), default `HH:mm`, used when enabled. |
| Standalone time | File creation time (already the standalone `firstSeen`). |
| Ordering | Reverse-chronological, time-aware within a day. No direction toggle. |

## Rendering

`buildHeadingString` wraps the date. When a time is present it folds into the
alias; otherwise behaviour is unchanged.

- Wiki-link style + time: `[[2026-07-14|2026-07-14 14:30]]`
- Plain style + time: `2026-07-14 14:30`
- No time (toggle off): `[[2026-07-14]]` / `2026-07-14` (today's behaviour)

The alias's visible text is the full `date time` so the heading reads
completely while the link still points at the bare daily note. Presence of a
`time` value on the template variables drives this — `add-inline` sets it only
when `includeTime` is on. Filenames use the raw date and are untouched.

## Ordering

The timeline is reverse-chronological and stays that way. The only change is the
within-day tiebreak: sort by the moment's time, latest first, instead of by
scan order.

The within-day sort the timeline actually renders lives in `groupMomentsByDate`
(`timeline-helpers.ts:113`), re-run every render — **not** `moment-cache.ts`.
The "all moments" display path in `main.ts` pushes `byDate` entries in insertion
order and relies on that re-sort. Both must be addressed:

- Fix the comparator in `groupMomentsByDate` (primary).
- Route the `main.ts` all-moments path through `getMomentsForDate` so ordering
  is centralised, and align the secondary sorts in `moment-cache.ts`.

Each moment carries a precomputed numeric `sortTime` (date+time epoch) set at
scan time; the comparator is `(b.sortTime ?? b.firstSeen) - (a.sortTime ?? a.firstSeen)`,
descending. Precomputing keeps the comparators config-free (they have no access
to `timeFormat`).

- **Inline** moments: `sortTime` from the recovered heading time (see Parsing);
  absent when there is no parseable time, so they fall back to `firstSeen`.
- **Standalone** moments: no `sortTime`; `firstSeen` already holds file ctime,
  so they sort by creation time with no extra work.

## Parsing

To sort inline moments by time, the scanner recovers the time from the heading.
Both date-link styles are supported symmetrically — the time always sits
adjacent to the date, so recovery attempts the configured `timeFormat` at that
one known spot rather than scanning free heading text.

- **Wiki-link style** — `[[2026-07-14|2026-07-14 14:30]]`. Extend the wiki-link
  date pattern to capture an optional alias,
  `[[(\d{4}-\d{2}-\d{2})(?:\|([^\]]*))?]]`. When an alias is present, the time is
  the alias with the leading date removed.
- **Plain style** — `2026-07-14 14:30 Call`. The date still matches at the start
  of the heading text; the time is the token immediately after it. Parse that
  token against `timeFormat`; when it parses, treat it as the time and strip it
  from the title, otherwise leave the whole remainder as the title.
- `moment-scanner.ts`: carry the recovered `time` and `sortTime` onto the
  `Moment` for either style.
- Sorting uses the precomputed `sortTime` epoch; a parse failure leaves it unset
  and the moment falls back to `firstSeen`. Headings with no time keep working
  unchanged.

**Two scan paths.** Production scans via the `metadataCache` heading loop in
`main.ts:365`, and `scanFileForMoments` is only the raw-content fallback
(`main.ts:412`). Both must recover time, so recovery lives in the shared
`parseHeadingForMoment` (given an optional `timeFormat`) plus a small addition to
`main.ts`'s bracket-stripped-link fallback (read the link's `displayText`).
Note: metadataCache strips wiki-link brackets, so in the running app an aliased
heading `[[date|date time]]` reaches the parser as plain `date time` text and is
recovered through the **plain branch**. The wiki-link-alias regex fires only in
the raw-content fallback and in unit tests — both are still implemented.

Config threading follows the existing core convention (explicit format params,
e.g. `parseDate(str, format)`): add an optional `timeFormat?` param that, when
omitted, disables time recovery — keeping every current single-arg test call
green. `dateFormat` is not needed for recovery because the date is matched as
ISO by regex.

## Settings

Inline moments section gains two controls:

- **Include time** — toggle, default off. When on, new inline moments stamp the
  current time into the date link.
- **Time format** — text field, default `HH:mm`, Moment tokens. Mirrors the
  existing Date format control.

**Time format only appears when Include time is on.** Follow the existing
`targetSectionMode` pattern in `settings-tab.ts`: the Include time toggle's
`onChange` saves and then calls `this.display()` to re-render the tab, and the
Time format row is only added to the group when `settings.includeTime` is true.
(The alternative `moments-hidden` CSS toggle is also in use, but conditional
`addSetting` matches the closest precedent and avoids rendering a dead field.)

The heading-template description drops its `{{time}}` mention, since time is no
longer a manual placeholder.

## Types

- `Moment` gains `time?: string` (the recovered/printed time) and
  `sortTime?: number` (precomputed date+time epoch for the within-day sort;
  absent when there is no parseable time).
- `TemplateVariables.time` is now populated for inline headings; the unused
  `datetime` field can go.

## Implementation (verified against code)

Ordered, file-by-file. Line numbers are current at time of writing.

1. **`src/core/date-parser.ts`** — add `DEFAULT_TIME_FORMAT = 'HH:mm'`, a
   `formatTime(date, format?)` helper, and
   `parseDateTimeToEpoch(date, time, timeFormat): number | null` (strict
   `moment(`${date} ${time}`, `YYYY-MM-DD ${timeFormat}`, true)`, returns
   `.valueOf()` or `null`).
2. **`src/constants.ts`** — re-export `DEFAULT_TIME_FORMAT` (line 16 block).
3. **`src/types.ts`** — add `time?` and `sortTime?` to `Moment`.
4. **`src/core/heading-parser.ts`** — `ParsedMomentHeading` gains `time?`.
   Widen `WIKILINK_DATE_PATTERN` to capture an optional alias
   (`/\[\[(\d{4}-\d{2}-\d{2})(?:\|([^\]]*))?\]\]/`). `parseHeadingForMoment(line,
   timeFormat?)`: wiki-link branch recovers time from the alias only when it
   starts with the date (`alias.slice(date.length).trim()`), so custom aliases
   are never misread; plain branch strict-parses the first remainder token
   against `timeFormat`, strips it from the title on success, leaves it otherwise.
   Recovery is skipped entirely when `timeFormat` is omitted.
5. **`src/core/moment-scanner.ts`** — `scanFileForMoments(content, filePath,
   timeFormat?)` passes `timeFormat` through and stamps `time` + `sortTime`.
   `createStandaloneMomentFromFile` unchanged.
6. **`src/main.ts`** — thread `this.settings.timeFormat` into the metadataCache
   loop (`parseHeadingForMoment` at line 374) and the raw-content fallback (line
   412); stamp `time`/`sortTime` on the pushed moment (line 397); in the
   bracket-stripped-link fallback (line 378) recover time from
   `dateLink.displayText`; route the all-moments display path (line 450) through
   `getMomentsForDate`.
7. **`src/core/timeline-helpers.ts`** — comparator at line 113 →
   `(b.sortTime ?? b.firstSeen) - (a.sortTime ?? a.firstSeen)`.
8. **`src/core/moment-cache.ts`** — same tiebreak in `getMomentsForDate` (line
   112) and `getMomentsInDateRange` (line 152).
9. **`src/core/template-engine.ts`** — fold time into the date in
   `buildHeadingString`: wiki-link+time → `[[date|date time]]`, plain+time →
   `date time`, no-time unchanged. Remove unused `TemplateVariables.datetime`.
   `buildFilename` and `evaluateCoreTemplate` unchanged.
10. **`src/commands/add-inline.ts`** — set
    `time: settings.includeTime ? formatTime(new Date(), settings.timeFormat) : undefined`.
11. **`src/commands/standalone-note.ts`, `src/ui/moment-modal.ts`** — no change.
12. **`src/settings/settings.ts`** — add `includeTime: boolean` (default false)
    and `timeFormat: string` (default `DEFAULT_TIME_FORMAT`).
13. **`src/settings/settings-tab.ts`** — Include time toggle (saves +
    `this.display()`), Time format row added only when `includeTime` is true;
    drop `{{time}}` from the heading-template description.

## Round-trip safety

A heading with no alias time (`### [[2026-07-14]] Call`) parses exactly as
today. Adding the alias only introduces an optional capture group and an
optional `time` on the moment. No migration; existing notes are unaffected and
simply sort by `firstSeen` as before.

## Testing

- `template-engine.test.ts`: date renders as aliased datetime when a time is
  present; plain style renders `date time`; unchanged when time absent;
  filenames unaffected.
- `heading-parser.test.ts`: alias time extracted; plain-style time extracted and
  stripped from title; a plain-style title that isn't a time is left intact;
  bare wiki-link and bare plain date still parse.
- `moment-cache.test.ts`: within-day order by time (latest first) for both
  styles; missing-time fallback to `firstSeen`; standalone moments order by
  ctime.
- Run `npm run lint && npm test && npm run build`.

## Risks & edge cases

- **Non-ISO `dateFormat` (pre-existing).** The scanner detects ISO dates only.
  With a format like `MM/DD/YYYY`, headings are never re-detected — the moment,
  not just its time, disappears from the timeline. Inherited limitation; out of
  scope, worth a doc note.
- **`timeFormat` with a space** (e.g. `h:mm A` → `2:30 PM`) breaks the plain
  branch's single-token recovery. Mitigation: when `timeFormat` contains
  whitespace, also try the first two tokens. Wiki-link-alias recovery is
  unaffected (it slices by the date prefix).
- **Title beginning with a time-like token** (plain style, `2026-07-14 12:00
  countdown` under `HH:mm`) strips `12:00` as the time. Inherent to positional
  recovery; rare and acceptable.
- **Backdated date, current clock time.** A moment dated yesterday stamps
  today's time (design: stamp current time, no manual entry). Expected.
- **Stale aliases after a `timeFormat` change.** Old entries carry the old
  format and may not re-parse; the strict-parse `?? firstSeen` fallback handles
  this gracefully. No migration now (revisit if reported).
