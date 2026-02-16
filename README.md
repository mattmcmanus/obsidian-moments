<img width="2618" height="2030" alt="CleanShot 2026-02-16 at 16 16 02@2x" src="https://github.com/user-attachments/assets/44cf5fc2-3187-4ce7-b7bf-49c252ce59ba" />

# Obsidian Moments

A timeline that brings your Obsidian vault together.

## Why Moments?

Daily and periodic notes are a great starting point for date-based organization, but they're not always enough. Meeting notes about a project belong in the project file. Events deserve their own documents. Research updates live with the research. In practice, dated content ends up spread across your vault — and no single note captures the full picture of what happened on a given day.

Moments evolves the idea. Instead of putting everything in one place, keep notes where they naturally belong and let Moments weave them into a unified timeline.

## How it works

Moments recognizes three types of date-connected content:

- **Inline moments** — Dated headings inside any note. Add `### [[2026-02-10]] Contractor walkthrough` under a project's `## Notes` section and it appears in the timeline for that day.
- **Standalone moments** — Dedicated dated notes like `2026-02-10 - Coffee with Sarah.md`. The full note becomes the moment.
- **Implicit moments** — Files created or modified on a given day show up as subtle secondary entries, giving context for what else you were working on.

The timeline view pulls it all together. Open it on February 10th and you see the contractor walkthrough from your renovation project, a standalone note from a coffee catch-up, your daily log, and whatever else you touched that day — all in one chronological view.

> **Want to see it in action?** Open the [`demo/`](demo/) folder as an Obsidian vault to explore a working example.

## Features

### Create Inline Moments

Add a dated heading to any file with a single command. Perfect for adding timestamped updates to project files.

**Command**: `Insert inline moment in current file`

> **Tip:** On mobile, you can add this command to the toolbar for quick one-tap access. Go to **Settings** → **Mobile** → **Manage toolbar options** and add "Insert inline moment in current file".

This inserts a heading like:
```markdown
### [[2026-02-04]] Call with Lawyer
```

Configure:
- Which section to insert under (e.g., `## Notes`)
- Whether to prepend (newest first) or append (oldest first)
- Heading level (H2, H3, H4, etc.)

### Create Standalone Moments

Create a new dated note file with a single command.

**Command**: `Create new standalone moment`

This creates a file like `2026-02-04 - Meeting notes.md` in your default notes location.

### Timeline View

A sidebar panel (or full-page view) showing all your moments chronologically.

**Command**: `Open timeline`

The timeline shows:
- **Day sections**: Collapsible sections for each day
- **Primary content**: Your inline and standalone moments with their full content
- **Secondary content**: Other files created or modified that day (muted, for context)

#### Filtering

- Click a day header to focus on just that day
- Navigate with Today/Previous/Next buttons
- **Auto-filter**: When viewing a daily, weekly, or monthly note, the timeline automatically filters to that period

### Integration with Daily Notes

Moments works independently but respects your existing setup:
- Detects date format from Daily Notes or Periodic Notes plugin
- Auto-filters timeline when viewing periodic notes
- No configuration needed if you're already using these plugins

## Installation

### From Obsidian Community Plugins

1. Open **Settings** → **Community plugins**
2. Select **Browse** and search for "Moments"
3. Select **Install**, then **Enable**

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
2. Create a folder: `<your-vault>/.obsidian/plugins/moments/`
3. Copy the downloaded files into this folder
4. Reload Obsidian and enable the plugin in **Settings** → **Community plugins**

## Settings

### Date Settings

- **Date format**: Format for dates (default: `YYYY-MM-DD`). Auto-detected from Daily Notes if installed.
- **Date link style**: Wiki-link `[[2026-02-04]]` or plain text

### Inline Moments

- **Target section**: The heading to insert moments under (default: `## Notes`). Set to none to insert at cursor.
- **Position**: Prepend (newest first) or append (oldest first)
- **Heading level**: H2, H3, H4, H5, or H6 (default: H3)

### Timeline

- **Auto-filter on periodic note**: Automatically filter timeline when viewing a periodic note (default: on)
- **Show implicit moments**: Show files created/modified as secondary entries (default: on)
- **Open on startup**: Use timeline as your homepage (default: off)

## Usage Examples

### Project Notes Pattern

Keep timestamped updates in your project files:

```markdown
# Project Alpha

## Overview
Project description here...

## Notes

### [[2026-02-04]] Call with Lawyer
Discussed contract terms. Need to review section 3.

### [[2026-02-01]] Kickoff meeting
Initial planning session. Assigned roles.
```

### Standalone Dated Notes

For longer content that deserves its own file:

```
2026-02-04 - Board meeting.md
2026-02-04 - Interview with candidate.md
```

### Timeline View

Open the timeline to see everything from a given day:

```
┌─────────────────────────────────────────────────┐
│  February 4, 2026                               │
├─────────────────────────────────────────────────┤
│  Call with Lawyer                               │
│  Discussed contract terms. Need to review...   │
│                                                 │
│  Board meeting                                  │
│  Full content of the meeting notes...          │
│                                                 │
│  [[Pizza party planning]] created               │
│  [[Q1 Budget]] updated                          │
└─────────────────────────────────────────────────┘
```

## Commands

| Command | Hotkey | Description |
|---------|--------|-------------|
| Insert inline moment in current file | — | Add a dated heading to the current file |
| Create new standalone moment | — | Create a new dated note file |
| Open timeline | — | Open timeline in sidebar |
| Open timeline in new tab | — | Open timeline as full page |
| Go to today | — | Jump timeline to today |

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build for development (watch mode)
npm run dev

# Build for production
npm run build
```

## License

MIT
