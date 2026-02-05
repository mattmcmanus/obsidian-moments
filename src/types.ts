/**
 * Core types for the Moments plugin
 */

/**
 * Type of moment
 */
export type MomentType = 'inline' | 'standalone';

/**
 * A moment detected in the vault
 */
export interface Moment {
	/** Type of moment */
	type: MomentType;
	/** Date in YYYY-MM-DD format */
	date: string;
	/** Extracted title (null if heading has no title text) */
	title: string | null;
	/** Path to the file containing this moment */
	filePath: string;
	/** For inline moments: heading level (2-6) */
	headingLevel?: number;
	/** For inline moments: line number in file (0-indexed) */
	headingLine?: number;
	/** Timestamp when moment was first cached (for ordering) */
	firstSeen: number;
}

/**
 * An implicit moment (file created/modified without explicit date marker)
 */
export interface ImplicitMoment {
	/** Path to the file */
	filePath: string;
	/** File display name */
	fileName: string;
	/** Whether this is a creation or modification */
	action: 'created' | 'updated';
	/** The date this occurred */
	date: string;
	/** Timestamp of the action */
	timestamp: number;
}

/**
 * Position for inserting inline moments
 */
export type InsertPosition = 'prepend' | 'append';

/**
 * Target section mode for inline moments
 */
export type TargetSectionMode = 'none' | 'specified';

/**
 * Date link style
 */
export type DateLinkStyle = 'wikilink' | 'plain';

/**
 * Default view mode for timeline
 */
export type TimelineViewMode = 'sidebar' | 'tab';

/**
 * Timeline filter state
 */
export interface TimelineFilter {
	/** Start date (inclusive) */
	startDate: string | null;
	/** End date (inclusive) */
	endDate: string | null;
	/** Text search filter */
	searchText: string | null;
}

/**
 * Cache for moments indexed by date and file
 */
export interface MomentCache {
	/** Moments indexed by date string (YYYY-MM-DD) */
	byDate: Map<string, Moment[]>;
	/** Moments indexed by file path */
	byFile: Map<string, Moment[]>;
	/** Set of file paths that have explicit moments */
	filesWithMoments: Set<string>;
	/** Timestamp of last full scan */
	lastScan: number;
}
