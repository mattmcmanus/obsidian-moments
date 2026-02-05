# Moments Plugin - Development Plan

## Vision

Moments is an Obsidian plugin that unifies date-based note-taking across your vault. Rather than scattering notes or forcing a single organizational pattern, Moments embraces how people naturally work:

- **Inline moments**: Date-prefixed headers within project files (e.g., `### [[2026-02-04]] Call with Lawyer` under a `## Notes` section)
- **Standalone moments**: Dedicated dated notes (e.g., `2026-02-04 - Call with Lawyer.md`)
- **Timeline view**: A chronological panel that weaves all dated content together

---

## Core Concepts

### Moment Types

1. **Inline Moment**: A heading within any file that starts with a date (wiki-linked or plain)
   - Pattern: `### [[2026-02-04]] Call with Lawyer` or `### 2026-02-04 Call with Lawyer`
   - Lives within a configurable section of a file (e.g., `## Notes`)
   - Title extracted by stripping the date prefix (e.g., "Call with Lawyer")

2. **Standalone Moment**: A dedicated note file with a date prefix
   - Pattern: `2026-02-04 - Call with Lawyer.md` (configurable)
   - Lives in a configurable folder
   - Entire file content is the moment

3. **Implicit Moment**: Files created or modified on a given day that have NO explicit moments
   - **Exclusion rule**: If a file contains ANY inline moment or IS a standalone moment, it is excluded from implicit list entirely
   - Shown as secondary/muted entries in timeline
   - Format: `[[Pizza party]] created` or `[[Science Fair]] updated`
   - Provides context for what else was happening that day

### Visual Hierarchy in Timeline

```
┌─────────────────────────────────────────────────┐
│  February 4, 2026                        [^][v] │
├─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐    │
│  │ Call with Lawyer                        │    │  ← Primary: inline moment
│  │ Discussed the contract terms...         │    │     (title + content)
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ Meeting notes - Project Alpha           │    │  ← Primary: standalone moment
│  │ Full content of the dated note...       │    │     (full embed)
│  └─────────────────────────────────────────┘    │
│                                                 │
│  [[Pizza party]] created                        │  ← Secondary: implicit moment
│  [[Science Fair]] updated                       │     (muted text)
└─────────────────────────────────────────────────┘
```

---

## Features

### Phase 1: Core Note Creation

#### 1.1 Add Inline Moment (Command)
- **Command**: `moments:add-inline` - "Insert moment in current file"
- If no file is active: prompts user to select a file first (file suggester)
- Opens a modal to enter the moment title
- Auto-generates today's date (with option to pick different date)
- Inserts heading at configured location:
  - If target section configured: finds or creates section, then prepends/appends
  - If no target section: inserts at cursor or end of file
- Heading format: `### [[2026-02-04]] Call with Lawyer`

#### 1.2 Create Standalone Moment (Command)
- **Command**: `moments:create-standalone` - "Create new moment note"
- Opens a modal to enter the moment title
- Auto-generates today's date (with option to pick different date)
- Creates file with configured naming pattern
- Location: Respects Obsidian's "Default location for new notes" setting
- Opens the new file for editing

#### 1.3 Ribbon Actions
- **Ribbon icon**: Opens a small menu with both options
- Two distinct commands for clarity:
  - `moments:add-inline` - "Insert moment in current file"
  - `moments:create-standalone` - "Create new moment note"
- Each opens its own focused modal (no toggle confusion)

### Phase 2: Timeline View

#### 2.1 Timeline Panel
- **View types**:
  - Sidebar panel (leaf view)
  - Full page view (can be opened as a tab)
  - Homepage mode (opens on app launch - configurable)
- Sections delineated by day (collapsible)
- Each day section contains:
  - **Primary content**: Embedded moments with extracted titles
  - **Secondary content**: Muted implicit moments
- **Empty state**: Friendly onboarding message when no moments exist
  - "No moments yet"
  - Brief explanation of what moments are
  - "Create your first moment" button (opens standalone creation)

#### 2.2 Timeline Header/Controls
- **Navigation**:
  - Today button (jump to current day)
  - Prev/next day arrows
  - Date input field (type a date to jump to it)
- **Quick actions** (especially for mobile/homepage mode):
  - New moment button (opens standalone moment creation)
  - Search vault button
- **Filter indicator**: Shows current filter state (e.g., "Showing Feb 4, 2026" or "Showing all")

#### 2.3 Timeline Filtering
- **Default**: Show all moments (scrollable, lazy-loaded)
- **Day filter**: Click on a day header to isolate
- **Range filter**: Select start/end dates
- **Auto-filter on periodic note** (setting, default: true):
  - When viewing a daily note → filter to that day
  - When viewing a weekly note → filter to that week
  - When viewing a monthly note → filter to that month
  - When viewing a quarterly note → filter to that quarter
  - When viewing a yearly note → filter to that year

#### 2.4 Content Embedding
- **Inline moments**: Show heading title (date stripped) + content under that heading
- **Standalone moments**: Embed full note content
- **Implicit moments**: Single line, muted: `[[Note name]] created/updated`
- Click any moment to navigate to source

### Phase 3: Integration & Polish

#### 3.1 Periodic Notes Integration
- Works independently (no plugin dependency required)
- Detects and respects settings from:
  - Core Daily Notes plugin
  - Periodic Notes community plugin
- When detected, defers to their date format settings
- Links moments to corresponding periodic notes when they exist

#### 3.2 Templates
- **Inline heading template**: `{{date}} {{title}}` (default)
- **Standalone filename template**: `{{date}} - {{title}}` (default)
- **Standalone content template**: Configurable initial content
- **Variables**: `{{date}}`, `{{title}}`, `{{time}}`, `{{datetime}}`

#### 3.3 Commands Summary
| Command ID | Name | Hotkey | Description |
|------------|------|--------|-------------|
| `moments:add-inline` | Insert moment in current file | `Cmd+Alt+N` | Insert dated heading in current file |
| `moments:create-standalone` | Create new moment note | — | Create new dated note file |
| `moments:open-timeline` | Open timeline | — | Open timeline in sidebar |
| `moments:open-timeline-tab` | Open timeline in new tab | — | Open timeline as full page |
| `moments:go-to-today` | Go to today | — | Jump timeline to today |

#### 3.4 Error Handling
Use Obsidian's `Notice` API for user feedback (standard growl-style notifications):

```typescript
import { Notice } from 'obsidian';

// Success
new Notice('Moment created');

// Error
new Notice('Could not create moment: file write failed');

// Info
new Notice('No moments found for this date');
```

Standard patterns:
- Show success notice after creating moment
- Show error notice with brief explanation on failure
- Don't show notices for routine operations (cache updates, scanning)

---

## Settings

### Date Settings
- **Date format**: Format for dates in headings/filenames (default: `YYYY-MM-DD`)
  - *Auto-detected from Daily Notes / Periodic Notes if installed*
- **Date link style**:
  - `[[YYYY-MM-DD]]` - Wiki-link (default)
  - `YYYY-MM-DD` - Plain text

### Inline Moments
- **Target section mode**:
  - `none` - No target section, insert at cursor/end
  - `specified` - Use specified heading (default)
- **Target section heading**: The heading to insert under (default: `## Notes`)
  - Creates section if it doesn't exist
  - Section created at end of file (after any existing content)
- **Position**:
  - `prepend` - Newest first (default)
  - `append` - Oldest first
- **Heading level**: H2, H3, H4, H5, H6 (default: H3 `###`)
- **Heading template**: Template string (default: `{{date}} {{title}}`)

### Standalone Moments
- **Folder**: Respects Obsidian's "Default location for new notes" setting
  - No separate folder config needed - uses the system default
- **Filename template**: Pattern for filenames (default: `{{date}} - {{title}}`)
- **Note template**: Initial content for new notes (default: empty)

### Timeline View
- **Auto-filter on periodic note**: Filter timeline when viewing periodic notes (default: true)
- **Show implicit moments**: Show created/modified files (default: true)
- **Open on startup**: Use timeline as homepage (default: false)
- **Default view**: `sidebar` or `tab` (default: sidebar)

---

## Technical Architecture

```
src/
├── main.ts                     # Plugin entry, lifecycle, command registration
├── types.ts                    # TypeScript interfaces
├── constants.ts                # Defaults, regex patterns, view type IDs
│
├── core/                       # Pure functions (no Obsidian imports) - fully testable
│   ├── date-parser.ts          # Date parsing, formatting, validation
│   ├── heading-parser.ts       # Extract moment info from heading text
│   ├── content-extractor.ts    # Extract content between headings
│   └── template-engine.ts      # Variable substitution for templates
│
├── settings/
│   ├── settings.ts             # Settings interface and defaults
│   ├── settings-tab.ts         # Settings UI tab
│   └── plugin-detection.ts     # Detect Daily Notes / Periodic Notes settings
│
├── moments/
│   ├── moment-types.ts         # Moment type definitions
│   ├── moment-creator.ts       # Create inline/standalone moments (uses core/)
│   ├── moment-scanner.ts       # Scan vault for all moments
│   └── moment-cache.ts         # Cache management and indexing
│
├── commands/
│   ├── index.ts                # Register all commands
│   ├── add-inline.ts           # Insert moment in current file
│   ├── create-standalone.ts    # Create new moment note
│   └── timeline-commands.ts    # Open timeline, go to today, etc.
│
├── views/
│   ├── timeline-view.ts        # Main timeline view (ItemView)
│   ├── timeline-state.ts       # View state management
│   ├── day-section.ts          # Collapsible day component
│   ├── moment-card.ts          # Moment content card component
│   └── implicit-moment.ts      # Implicit moment line component
│
└── ui/
    ├── moment-modal.ts         # Modal for creating moments
    ├── date-input.ts           # Simple date input (text field, validates format)
    └── file-suggester.ts       # File selection dropdown

__tests__/
├── core/                       # Unit tests for pure functions
│   ├── date-parser.test.ts
│   ├── heading-parser.test.ts
│   ├── content-extractor.test.ts
│   └── template-engine.test.ts
│
├── integration/                # Integration tests with Obsidian mocks
│   ├── moment-creator.test.ts
│   ├── moment-scanner.test.ts
│   └── moment-cache.test.ts
│
└── __mocks__/
    └── obsidian.ts             # Obsidian API mocks
```

### View Registration

```typescript
// Timeline view type
const TIMELINE_VIEW_TYPE = 'moments-timeline';

// Register as ItemView for both sidebar and tab usage
this.registerView(TIMELINE_VIEW_TYPE, (leaf) => new TimelineView(leaf, this));
```

### Moment Cache Strategy

1. **Initial scan on load**:
   - Use `app.vault.getMarkdownFiles()` for file list
   - Use `app.metadataCache` for heading extraction (avoid re-parsing)
   - Use `app.vault.getFileByPath()` stat for created/modified dates

2. **Incremental updates**:
   - Listen to `metadataCache.on('changed')` for content changes
   - Listen to `vault.on('create')`, `vault.on('delete')`, `vault.on('rename')`

3. **Cache structure**:
   ```typescript
   interface Moment {
     type: 'inline' | 'standalone';
     date: string;              // YYYY-MM-DD
     title: string | null;      // Extracted title (null if heading has no title text)
     filePath: string;
     headingLevel?: number;     // For inline: H2, H3, etc.
     headingLine?: number;      // For inline: line number in file
     firstSeen: number;         // Timestamp when first cached (for ordering)
   }

   interface MomentCache {
     // Indexed by date string (YYYY-MM-DD)
     byDate: Map<string, Moment[]>;
     // Indexed by file path (for quick lookup and exclusion from implicit)
     byFile: Map<string, Moment[]>;
     // Set of file paths that have explicit moments (for implicit exclusion)
     filesWithMoments: Set<string>;
     // Last full scan timestamp
     lastScan: number;
   }
   ```

4. **Ordering within a day**:
   - Sort by `firstSeen` timestamp (when moment was first cached)
   - Newest first within each day
   - On cache rebuild, fall back to file modified time
   - Standalone moments use file creation time as firstSeen

### Date Parsing & Moment Detection

**Expressive heading detection** - wiki-linked date anywhere in heading:
```markdown
### [[2026-02-04]] Call with Lawyer     → date: 2026-02-04, title: "Call with Lawyer"
### [[2026-02-04]]                       → date: 2026-02-04, title: null (embed without title)
### Meeting on [[2026-02-04]] morning    → date: 2026-02-04, title: "Meeting on morning"
### Weekly sync [[2026-02-04]]           → date: 2026-02-04, title: "Weekly sync"
```

```typescript
// Wiki-linked date anywhere in heading (primary detection)
const WIKILINK_DATE = /\[\[(\d{4}-\d{2}-\d{2})\]\]/;

// Plain date at start of heading (fallback, configurable format)
const PLAIN_DATE_START = /^(\d{4}-\d{2}-\d{2})\s*/;

// Extract title by removing the date portion
function extractTitle(heading: string, dateMatch: RegExpMatchArray): string | null {
  const withoutDate = heading.replace(dateMatch[0], '').trim();
  return withoutDate.length > 0 ? withoutDate : null;
}
```

**Standalone filename pattern** (configurable):
```typescript
// Default: "2026-02-04 - Call with Lawyer.md"
const STANDALONE_PATTERN = /^(\d{4}-\d{2}-\d{2})\s*[-–]\s*(.+)\.md$/;
```

### Content Extraction

For inline moments, extract content from after the heading until:
- Next heading of **same or higher level** (H3 stops at H3, H2, or H1)
- End of file

```typescript
function extractMomentContent(
  fileContent: string,
  headingLine: number,
  headingLevel: number
): string {
  // Standard heading-scoped content extraction
}
```

### Plugin Detection

```typescript
interface DetectedSettings {
  dateFormat: string | null;
  dailyNotesFolder: string | null;
  weeklyNotesFolder: string | null;
  // etc.
}

function detectPeriodicNotesSettings(app: App): DetectedSettings {
  // Check for Periodic Notes plugin
  const periodicNotes = app.plugins.getPlugin('periodic-notes');
  if (periodicNotes) {
    return extractPeriodicNotesSettings(periodicNotes);
  }

  // Check for core Daily Notes
  const dailyNotes = app.internalPlugins.getPluginById('daily-notes');
  if (dailyNotes?.enabled) {
    return extractDailyNotesSettings(dailyNotes);
  }

  return { dateFormat: null, dailyNotesFolder: null, weeklyNotesFolder: null };
}
```

---

## Data Flow

### Creating an Inline Moment

```
User triggers command
        ↓
Open MomentModal (title input, date picker)
        ↓
User submits
        ↓
Get active file (or selected file)
        ↓
Read file content
        ↓
Find target section (or create if missing)
        ↓
Build heading string from template
        ↓
Insert at prepend/append position
        ↓
Write file
        ↓
Update moment cache
        ↓
Position cursor after new heading
```

### Timeline Rendering

```
View opens / filter changes
        ↓
Determine date range to display
        ↓
Query moment cache for range
        ↓
Query file metadata for implicit moments
        ↓
Filter implicit: exclude any file in cache.filesWithMoments
        ↓
Group by day
        ↓
Sort days (newest first)
        ↓
Within each day, sort moments by firstSeen (newest first)
        ↓
Render day sections (virtualized for performance)
        ↓
Each section renders:
  - Primary: moment cards with embedded content
  - Secondary: implicit moment lines (muted)
```

### Auto-Filter on Periodic Note

```
User opens a file
        ↓
Check if auto-filter enabled (setting)
        ↓
Detect if file is a periodic note:
  - Match against daily notes pattern/folder
  - Match against weekly notes pattern/folder
  - etc.
        ↓
If periodic note detected:
  - Calculate date range for that period
  - Update timeline filter state
  - Refresh timeline view
```

---

## Mobile Considerations

### Touch-Friendly UI
- Large tap targets for buttons and interactive elements
- Swipe gestures for day navigation (optional)
- Pull-to-refresh for timeline

### Homepage Mode
When configured as homepage:
- Opens timeline view on app launch
- Prominent quick action buttons:
  - **+ New moment**: Opens standalone moment creation
  - **Search**: Opens vault search
  - **Today**: Jumps to today in timeline
- Works well as a "daily dashboard"

### Performance on Mobile
- Aggressive lazy loading for timeline
- Limit initial render to recent days
- Load older content on scroll
- Smaller embed previews on mobile (truncated)

---

## Resolved Decisions

| Question | Decision |
|----------|----------|
| Periodic notes dependency | Independent. Supports both core Daily Notes and Periodic Notes plugin. Defers to their date format settings when installed. |
| Date parsing | Configurable format, default ISO (`YYYY-MM-DD`). Auto-detect from installed plugins. |
| Target section creation | Configurable: either no target section (insert at cursor) or specify section that gets auto-created if missing (at end of file). |
| Embedding display | Show extracted title (date stripped) + content under heading for inline moments. Full embed for standalone. |
| Implicit moments | Secondary visual treatment. Muted text format: `[[Note]] created/updated`. |
| Caching | Leverage Obsidian's metadataCache for headings. Build our own date-indexed cache for fast timeline queries. |
| Mobile support | Critical. Timeline works as sidebar, tab, or homepage. Quick action buttons for new note and search. |
| Auto-filter behavior | Setting (default: true). Automatically filters timeline when viewing a periodic note. |
| Ordering within day | Track `firstSeen` timestamp when moment is first cached. Sort by newest first. Falls back to file modified time on cache rebuild. |
| Date picker UI | Simple text input with format validation for now. Can enhance with calendar widget later. |
| Command structure | Two distinct commands (inline vs standalone) rather than unified modal with toggle. Clearer mental model for users. |
| Empty timeline | Friendly onboarding message with explanation and "Create your first moment" button. |
| No active file (inline) | Prompt user to select a file via file suggester before proceeding. |
| Standalone folder | Respect Obsidian's "Default location for new notes" setting. No separate folder config. |
| Date in heading | Expressive - wiki-linked date can be anywhere in heading. Title = heading text minus the date. |
| No title in heading | Valid - embed shows content without title header. |
| Content extraction | Standard - extract until next heading of same or higher level. |
| Default hotkey | `Cmd+Alt+N` for inline moment creation. |
| Error handling | Use Obsidian's `Notice` API (standard growl-style notifications). |
| Testing | Jest for unit/integration tests. Pure core logic separated from Obsidian API layer. |

---

## Implementation Order

### Milestone 1: Foundation ✅
1. ✅ Project setup - Update manifest, clean sample code
2. ✅ Settings infrastructure - Types, defaults, settings tab
3. ✅ Plugin detection - Detect Daily Notes / Periodic Notes settings

### Milestone 2: Moment Creation ✅
4. ✅ Moment parser - Date extraction from headings/filenames
5. ✅ Moment modal UI - Title input, date input, validation
6. ✅ Add inline moment command - Insert into current file
7. ✅ Create standalone moment command - Create new file

### Milestone 3: Timeline View ✅
8. ✅ Basic timeline view - ItemView registration
9. ✅ Empty state - Onboarding message and "Create first moment" button
10. ✅ Moment scanner - Find all moments in vault
11. ✅ Moment cache - Index and incremental updates
12. ✅ Day sections - Grouped, collapsible day display
13. ✅ Moment cards - Content embedding
14. ✅ Implicit moments - Secondary display

### Milestone 4: Filtering & Navigation ✅
15. ✅ Timeline navigation - Today, prev/next, date input
16. ✅ Date range filtering - Manual filter controls
17. ✅ Auto-filter - Periodic note detection and auto-filtering

### Milestone 5: Polish ✅
18. ✅ Mobile optimization - Touch UI, responsive styles
19. ✅ Templates - Variable substitution (template-engine.ts)
20. ✅ Edge cases - Error handling, validation
21. ✅ Homepage mode - Open timeline on startup setting

---

## Testing Strategy

**Approach: Test-Driven Development (TDD)**

For each feature:
1. Write failing tests first
2. Run tests, verify they fail for the right reason
3. Implement minimal code to pass
4. Refactor if needed
5. Repeat

Obsidian doesn't provide official testing infrastructure, but we can achieve robust coverage with a layered approach.

### Architecture for Testability

Keep Obsidian API interactions at the edges. Core logic should be pure functions:

```
src/
├── core/                    # Pure functions, no Obsidian imports
│   ├── date-parser.ts       # Date parsing and formatting
│   ├── heading-parser.ts    # Extract moments from heading text
│   ├── content-extractor.ts # Extract content between headings
│   └── template-engine.ts   # Variable substitution
│
├── obsidian/                # Obsidian API wrappers (thin layer)
│   ├── file-ops.ts          # Read/write files via vault
│   ├── metadata.ts          # Access metadataCache
│   └── notices.ts           # Show notifications
│
└── ... (rest of structure)
```

### Testing Layers

#### 1. Unit Tests (Jest) - Core Logic
Test all pure functions with no mocking required:

```typescript
// __tests__/core/heading-parser.test.ts
import { parseHeadingForMoment } from '../src/core/heading-parser';

describe('parseHeadingForMoment', () => {
  it('extracts date and title from wiki-linked heading', () => {
    const result = parseHeadingForMoment('### [[2026-02-04]] Call with Lawyer');
    expect(result).toEqual({
      date: '2026-02-04',
      title: 'Call with Lawyer',
      level: 3
    });
  });

  it('handles heading with no title', () => {
    const result = parseHeadingForMoment('### [[2026-02-04]]');
    expect(result).toEqual({
      date: '2026-02-04',
      title: null,
      level: 3
    });
  });

  it('extracts date from middle of heading', () => {
    const result = parseHeadingForMoment('## Meeting on [[2026-02-04]] morning');
    expect(result).toEqual({
      date: '2026-02-04',
      title: 'Meeting on morning',
      level: 2
    });
  });

  it('returns null for heading without date', () => {
    const result = parseHeadingForMoment('### Regular heading');
    expect(result).toBeNull();
  });
});
```

#### 2. Unit Tests - Content Extraction
```typescript
// __tests__/core/content-extractor.test.ts
describe('extractContentUnderHeading', () => {
  it('extracts content until next same-level heading', () => {
    const content = `
### [[2026-02-04]] First moment
Some content here.
More content.

### [[2026-02-05]] Second moment
Different content.
`;
    const result = extractContentUnderHeading(content, 1, 3);
    expect(result).toBe('Some content here.\nMore content.');
  });

  it('extracts content until higher-level heading', () => {
    const content = `
### [[2026-02-04]] Moment
Content under moment.

## New Section
Different content.
`;
    const result = extractContentUnderHeading(content, 1, 3);
    expect(result).toBe('Content under moment.');
  });
});
```

#### 3. Integration Tests (Jest + Mocks) - Obsidian Interactions
Mock Obsidian API for testing integration points:

```typescript
// __tests__/integration/moment-creator.test.ts
import { createInlineMoment } from '../src/moments/moment-creator';
import { mockApp, mockFile, mockVault } from '../__mocks__/obsidian';

describe('createInlineMoment', () => {
  it('inserts moment heading in target section', async () => {
    const vault = mockVault({
      'project.md': '# Project\n\n## Notes\n\nExisting content.'
    });

    await createInlineMoment(vault, 'project.md', {
      date: '2026-02-04',
      title: 'Call with Lawyer',
      targetSection: '## Notes',
      position: 'prepend'
    });

    expect(vault.read('project.md')).toContain(
      '## Notes\n\n### [[2026-02-04]] Call with Lawyer\n\nExisting content.'
    );
  });

  it('creates target section if missing', async () => {
    const vault = mockVault({
      'project.md': '# Project\n\nSome content.'
    });

    await createInlineMoment(vault, 'project.md', {
      date: '2026-02-04',
      title: 'Meeting',
      targetSection: '## Notes',
      position: 'prepend'
    });

    expect(vault.read('project.md')).toContain('## Notes\n\n### [[2026-02-04]] Meeting');
  });
});
```

#### 4. Obsidian API Mocks
Create reusable mocks for Obsidian APIs:

```typescript
// __mocks__/obsidian.ts
export function mockVault(files: Record<string, string>) {
  const fileContents = new Map(Object.entries(files));

  return {
    read: (file: TFile) => fileContents.get(file.path) || '',
    modify: (file: TFile, content: string) => {
      fileContents.set(file.path, content);
    },
    create: (path: string, content: string) => {
      fileContents.set(path, content);
      return { path, basename: path.split('/').pop() };
    },
    getMarkdownFiles: () =>
      Array.from(fileContents.keys()).map(path => ({ path })),
    // ... other methods
  };
}

export function mockMetadataCache(headings: Record<string, HeadingCache[]>) {
  return {
    getFileCache: (file: TFile) => ({
      headings: headings[file.path] || []
    }),
    on: jest.fn(),
    // ... other methods
  };
}
```

#### 5. Test Vault (Manual + Automated)
Maintain a test vault for manual testing and potential E2E tests:

```
test-vault/
├── .obsidian/
│   └── plugins/moments/    # Symlink to build output
├── projects/
│   ├── project-a.md        # File with inline moments
│   └── project-b.md        # File without moments
├── moments/
│   ├── 2026-02-04 - Test moment.md
│   └── 2026-02-05 - Another moment.md
└── daily/
    └── 2026-02-04.md       # Daily note for testing auto-filter
```

### Test Coverage Goals

| Area | Coverage Target | Testing Method |
|------|-----------------|----------------|
| Date parsing | 100% | Unit tests |
| Heading parsing | 100% | Unit tests |
| Content extraction | 100% | Unit tests |
| Template engine | 100% | Unit tests |
| Moment creation | 90% | Integration tests with mocks |
| Cache operations | 80% | Integration tests with mocks |
| Timeline rendering | 70% | Integration tests + manual |
| UI components | Manual | Test vault |

### NPM Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage"
  }
}
```

### CI Integration

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:ci
      - run: npm run build
```

---

## Success Criteria

- Creating a moment (inline or standalone) takes < 3 seconds
- Timeline loads within 1 second for typical vaults (< 10k files)
- Intuitive enough that no documentation is needed for basic use
- Full functionality on mobile
- Respects existing Daily Notes / Periodic Notes configuration
- Homepage mode provides a useful daily dashboard experience
