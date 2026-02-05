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

/**
 * Default date format (ISO 8601)
 */
export const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';

/**
 * Default heading template for inline moments
 */
export const DEFAULT_HEADING_TEMPLATE = '{{date}} {{title}}';

/**
 * Default filename template for standalone moments
 */
export const DEFAULT_FILENAME_TEMPLATE = '{{date}} - {{title}}';

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
	GO_TO_TODAY: 'go-to-today',
} as const;

/**
 * Hotkeys
 */
export const HOTKEYS = {
	ADD_INLINE: [{ modifiers: ['Mod', 'Alt'], key: 'n' }],
} as const;
