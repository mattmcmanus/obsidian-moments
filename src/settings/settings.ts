import type {
	InsertPosition,
	TargetSectionMode,
	DateLinkStyle,
	ImplicitMomentsStyle,
	TimelineViewMode,
} from '../types';
import {
	DEFAULT_DATE_FORMAT,
	DEFAULT_HEADING_TEMPLATE,
	DEFAULT_FILENAME_TEMPLATE,
	DEFAULT_TARGET_SECTION,
	DEFAULT_HEADING_LEVEL,
} from '../constants';

/**
 * Plugin settings interface
 */
export interface MomentsSettings {
	// Date settings
	/** Date format string (e.g., "YYYY-MM-DD") */
	dateFormat: string;
	/** Whether to wrap dates in wiki-links */
	dateLinkStyle: DateLinkStyle;

	// Inline moment settings
	/** Target section mode: "none" or "specified" */
	targetSectionMode: TargetSectionMode;
	/** Target section heading (e.g., "## Notes") */
	targetSection: string;
	/** Where to insert new moments: "prepend" or "append" */
	insertPosition: InsertPosition;
	/** Heading level for inline moments (2-6) */
	headingLevel: number;
	/** Template for heading text */
	headingTemplate: string;

	// Standalone moment settings
	/** Template for filenames */
	filenameTemplate: string;
	/** Template for note content */
	noteTemplate: string;

	// Timeline settings
	/** Auto-follow timeline when viewing periodic notes */
	autoFilterOnPeriodicNote: boolean;
	/** Auto-follow timeline to show related moments when viewing a note */
	autoFilterRelatedMoments: boolean;
	/** Show implicit moments (created/modified files) */
	showImplicitMoments: boolean;
	/** Display style for implicit moments */
	implicitMomentsStyle: ImplicitMomentsStyle;
	/** Open timeline on startup */
	openOnStartup: boolean;
	/** Default view mode: "sidebar" or "tab" */
	defaultViewMode: TimelineViewMode;

	// Advanced settings
	/** Enable debug logging to console */
	debugMode: boolean;
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: MomentsSettings = {
	// Date settings
	dateFormat: DEFAULT_DATE_FORMAT,
	dateLinkStyle: 'wikilink',

	// Inline moment settings
	targetSectionMode: 'specified',
	targetSection: DEFAULT_TARGET_SECTION,
	insertPosition: 'prepend',
	headingLevel: DEFAULT_HEADING_LEVEL,
	headingTemplate: DEFAULT_HEADING_TEMPLATE,

	// Standalone moment settings
	filenameTemplate: DEFAULT_FILENAME_TEMPLATE,
	noteTemplate: '',

	// Timeline settings
	autoFilterOnPeriodicNote: true,
	autoFilterRelatedMoments: true,
	showImplicitMoments: true,
	implicitMomentsStyle: 'summary',
	openOnStartup: false,
	defaultViewMode: 'sidebar',

	// Advanced settings
	debugMode: false,
};
