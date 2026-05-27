# Unified moment modal — design

**Status:** Draft
**Date:** 2026-05-26
**Related:** [issue #15](https://github.com/mattmcmanus/obsidian-moments/issues/15)

## Summary

Replace the two separate moment-creation modals (Inline, Standalone) with a single "New moment" modal that exposes a scope toggle. The Inline path gains a file picker so users can target any vault file, not just the active one. An optional content textarea and a remembered "Open after create" checkbox round out the quick-capture workflow described in issue #15.

## Goals

- One modal, one command for creating moments of either scope.
- Inline moments can target any markdown file, with the active file as the default.
- Quick-capture flow: optionally include body content without opening the target file.
- Per-scope memory of the "Open after create" preference.

## Non-goals

- No new templating syntax. Content appends after a rendered Standalone template; no `{{content}}` placeholder.
- No Templater-aware content handling beyond what already exists for templates.
- No in-modal date-format override.
- No multi-file fan-out (one moment per submit).

## UX

### Layout

```
┌─ New moment ──────────────────────────────┐
│                                           │
│  Title    [Call with lawyer___________]   │
│  Date     [2026-05-26]                    │
│                                           │
│  Scope    [ Inline ][ Standalone ]        │
│                                           │
│  File     [Daily/2026-05-26.md________]   │   when Inline
│   …or                                     │
│  Folder   [Journal__________________]     │   when Standalone
│                                           │
│           [+ Add content]                 │   reveals textarea
│                                           │
│  ☑ Open after create                      │
│                                           │
│             [Cancel]      [Create]        │
└───────────────────────────────────────────┘
```

### Behaviors

- **Default state:** opens on Inline scope. File is pre-filled with the active file's path; if there is no active file the field is empty.
- **Scope toggle:** two buttons in a single `Setting` row. The active button gets `mod-cta`. Click swaps the conditional row (File ↔ Folder); other rows are untouched.
- **File field:** text input with fuzzy autocomplete over `app.vault.getMarkdownFiles()`. Type-to-filter; arrow keys + Enter select.
- **Folder field:** unchanged from today.
- **Content:** starts collapsed showing a `+ Add content` link-button. Clicking swaps it for a textarea that auto-grows as you type. No collapse-back affordance once expanded.
- **Open after create:** checkbox bound to a scope-specific settings key. Toggling persists immediately. Default `true` for both scopes (preserves today's always-open behavior).
- **Submit (Enter or Create button):**
  - Inline: file path must resolve to an existing TFile (`getFileByPath(normalizePath(value))`). Otherwise the modal stays open with a `Notice('Pick a file')`.
  - Standalone: same validation as today.
  - Date: same validation as today.

### Scope-switch state preservation

Toggling scope keeps Title, Date, Content, and Open-after intact. The File path (Inline) and Folder path (Standalone) each retain their own values in transient modal state — flipping scope hides one row but does not clear its value, so flipping back restores what was typed.

## Architecture

### New files

**`src/ui/file-suggest.ts`** — `FileSuggest extends AbstractInputSuggest<TFile>`, mirroring `FolderSuggest`. Source: `app.vault.getMarkdownFiles()`. Fuzzy match on `file.path`. Sets the input value on choose and dispatches an `input` event so the modal's state stays in sync.

**`src/commands/new-moment.ts`** — Single command handler. Opens the modal pre-set to Inline with the active file (if any). On submit, dispatches to `applyInlineMoment` or `applyStandaloneMoment` based on `result.scope`.

### Modified files

**`src/ui/moment-modal.ts`** — major rewrite.

New result type:

```ts
type MomentModalResult =
  | { scope: 'inline';      title: string; date: string; file: TFile; content: string; openAfter: boolean }
  | { scope: 'standalone';  title: string; date: string; folder: string; content: string; openAfter: boolean };
```

Constructor now takes the plugin handle (not just `app`) because toggling the checkbox writes to settings immediately:

```ts
new MomentModal(plugin, { initialScope: 'inline', defaultInlineFile, defaultFolder, onSubmit });
```

Render order is fixed: Title → Date → Scope → conditional File/Folder row → conditional Content row → Open-after → buttons. The conditional rows live in dedicated `containerEl` regions that are re-rendered on scope toggle and content-expand. No leaked listeners (each region's child elements are emptied via `containerEl.empty()` before re-render).

**`src/commands/add-inline.ts`** — extract the post-modal flow into `applyInlineMoment(app, settings, result)`. Drop the modal-opening + `FileSuggesterModal` path entirely.

Inline write-path branching driven by target vs. active file and `openAfter`:

| Target vs. active | openAfter | Write mechanism      | Cursor reposition |
|-------------------|-----------|----------------------|-------------------|
| Same file         | ignored\* | active editor        | yes               |
| Different file    | true      | openFile → editor    | yes               |
| Different file    | false     | `vault.process()`    | no                |

\* When the target equals the active file there is no navigation to suppress; the checkbox value is recorded but has no observable effect.

**`src/commands/create-standalone.ts`** — extract post-modal flow into `applyStandaloneMoment(app, settings, result)`. Drop the modal-opening code. Skip the post-create `openFile` when `openAfter === false`; the template suggester only opens if the file was actually opened.

**`src/commands/standalone-note.ts`** — `StandaloneNoteResult` gains optional `content?: string`. Append rule:

```ts
const rendered = settings.noteTemplate ? renderTemplate(settings.noteTemplate, vars) : '';
const body = content
  ? (rendered ? rendered + '\n\n' + content : content)
  : rendered;
```

**`src/core/section-helpers.ts`** — `insertHeading` gains optional 4th param `body?: string`. When present, the inserted block is `heading + '\n' + body`. Function still returns the new full content; callers don't need to track the body separately.

Inline cursor positioning (`positionCursorAfterHeading`) accepts a `bodyLineOffset` to land the cursor at end of body when content was provided. For stay-in-context inline writes (no `openAfter`) using `vault.process`, cursor positioning is skipped.

**`src/settings/settings.ts`** — add two booleans:

```ts
/** When true, navigate to the file after inserting an inline moment. */
inlineOpenAfterCreate: boolean;        // default true
/** When true, open the new file after creating a standalone moment. */
standaloneOpenAfterCreate: boolean;    // default true
```

No settings-tab UI for these — the modal checkbox is the only surface; persistence is the "remembered" mechanism.

**`src/constants.ts`** — replace `COMMANDS.ADD_INLINE` and `COMMANDS.CREATE_STANDALONE` with `COMMANDS.NEW_MOMENT = 'new-moment'`.

**`src/commands/index.ts`** — register one command, `new-moment`, name "New moment".

### Deletions

- `src/ui/file-suggester.ts` — no remaining callers after `add-inline.ts` is refactored.

## Data flow

```
User triggers "New moment" command
  └─ new-moment.ts: opens MomentModal(plugin, { initialScope: 'inline', defaultInlineFile, defaultFolder })
       └─ User edits fields, optionally toggles scope, optionally expands content
       └─ User clicks Create → modal validates → calls onSubmit(result)
            ├─ result.scope === 'inline'     → applyInlineMoment(app, settings, result)
            │                                    ├─ build heading via template-engine
            │                                    ├─ choose write mechanism per branching table
            │                                    └─ position cursor + Notice (or skip both when stay-in-context)
            └─ result.scope === 'standalone' → applyStandaloneMoment(app, settings, result)
                                                 ├─ createStandaloneNote (now accepts content)
                                                 ├─ if openAfter: openFile + template picker
                                                 └─ Notice
```

## Error handling

- Modal submit catches and surfaces failures via `Notice`, mirroring existing command patterns.
- Inline file-doesn't-exist on submit → soft fail, modal stays open, user fixes the path.
- Folder auto-create failure on Standalone — already handled in `standalone-note.ts` (race tolerance).
- `vault.process()` failure in stay-in-context inline writes → existing "Failed to create moment" notice.

## Testing

Add to existing 238-test suite; target 90%+ coverage on new modal logic, overall coverage stays ≥93%.

- **`__tests__/core/section-helpers.test.ts`** — `insertHeading(..., body)` cases: with body in 'specified' section (prepend, append), with body in 'none' mode, empty body acts identically to today.
- **Standalone note tests** — `createStandaloneNote` with content: appended after rendered template with blank line; content + empty template; neither (today's behavior).
- **New unit tests** for `applyInlineMoment` write-path branching (3 cases per the table above).
- **Modal integration tests:**
  - Opens defaulted to Inline with active file pre-filled.
  - Opens with no active file: File field empty; Create surfaces validation notice and modal stays open.
  - Scope toggle swaps File ↔ Folder row; field values preserved for both sides across toggles.
  - `+ Add content` reveals textarea; toggling scope preserves content text.
  - Submit with invalid file path shows notice and keeps modal open.
  - Open-after checkbox state mirrors settings per scope and persists on change.
- **Delete** tests for `FileSuggesterModal`.

## Breaking change

Old command IDs `add-inline` and `create-standalone` are removed. Users with hotkeys on those IDs lose them silently — Obsidian's hotkey UI drops bindings to unknown command IDs without error. Mitigation:

- CHANGELOG entry calls this out explicitly and directs users to rebind to "New moment".
- README "Commands" section reduced to one entry.
- Version bump to **0.5.0** (minor): visible behavior change, no data migration.

No settings migration needed: the two new booleans default to `true`, preserving today's always-open behavior.

## Out of scope (follow-ups)

- `{{content}}` placeholder for Standalone templates.
- Templater-aware content rendering.
- Quick-jump keybinding inside the modal to focus the File picker.
- Multi-file inline insert.
- Collapse-back affordance for the content textarea once expanded.
