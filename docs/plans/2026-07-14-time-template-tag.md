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

- **Inline** moments: time recovered from the heading (see Parsing). Moments
  without a time fall back to `firstSeen`.
- **Standalone** moments: `firstSeen` already holds file ctime, so they sort by
  creation time with no extra work.

Sort key per moment: the parsed date+time as an epoch when available, else
`firstSeen`. Compare descending. This keeps every moment on one comparable
scale regardless of type.

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
- `moment-scanner.ts`: carry the recovered `time` string onto the `Moment` for
  either style.
- Sorting converts `date + time` to an epoch using the configured date/time
  formats; a parse failure falls back to `firstSeen`. Headings with no time
  (either style) keep working unchanged.

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

- `Moment` gains `time?: string` (the recovered/printed time).
- `TemplateVariables.time` is now populated for inline headings; the unused
  `datetime` field can go.

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

## Open questions

- **Format changes over time:** if a user changes `timeFormat` later, older
  aliases carry the old format and may not re-parse for sorting. They fall back
  to `firstSeen` — acceptable, or worth normalising on rescan?
