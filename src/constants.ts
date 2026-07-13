/**
 * Constants for the Moments plugin
 */

/**
 * Plugin ID
 */
export const PLUGIN_ID = 'moments';

/**
 * Timeline view type identifier
 */
export const TIMELINE_VIEW_TYPE = 'moments-timeline';

// Re-export defaults from their canonical source modules
export { DEFAULT_DATE_FORMAT } from './core/date-parser';
export { DEFAULT_HEADING_TEMPLATE, DEFAULT_FILENAME_TEMPLATE } from './core/template-engine';

/**
 * Default target section for inline moments
 */
export const DEFAULT_TARGET_SECTION = '## Notes';

/**
 * Default heading level for inline moments
 */
export const DEFAULT_HEADING_LEVEL = 3;

/**
 * Icon for the ribbon
 */
export const RIBBON_ICON = 'calendar-clock';

/**
 * Command IDs
 */
export const COMMANDS = {
	ADD_INLINE: 'add-inline',
	CREATE_STANDALONE: 'create-standalone',
	OPEN_TIMELINE: 'open-timeline',
	OPEN_TIMELINE_TAB: 'open-timeline-tab',
	GO_TO_DATE: 'go-to-date',
} as const;

/**
 * Delay before focusing the title input in a modal.
 * Needed because Obsidian's Modal.open() renders asynchronously;
 * without a short delay the input element isn't yet in the DOM.
 */
export const MODAL_FOCUS_DELAY_MS = 10;

/**
 * Delay before repositioning the cursor after inserting content.
 * Allows Obsidian's editor to finish processing the setValue/modify
 * before we move the cursor and scroll into view.
 */
export const CURSOR_REPOSITION_DELAY_MS = 50;