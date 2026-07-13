import type { Moment, TimelineFilter } from '../types';

/**
 * Visibility state for the timeline header's controls, derived purely from the
 * active filter and pinned state so it can be unit-tested without a DOM.
 */
export interface HeaderControlsState {
	/** Whether any filter (date or related-file) is active. */
	hasFilter: boolean;
	/** Show the clear (X) button — whenever a filter is active. */
	showClear: boolean;
	/** Show the pin button — only when the filter is pinned. */
	showPin: boolean;
	/** Show the "Go to date" button — only from the unfiltered view. */
	showGoToDate: boolean;
}

/**
 * Compute which header controls should be visible for a given filter/pin state.
 */
export function computeHeaderControlsState(
	filter: TimelineFilter,
	pinned: boolean
): HeaderControlsState {
	const hasFilter = Boolean(
		(filter.startDate && filter.endDate) || filter.relatedToFile
	);
	return {
		hasFilter,
		showClear: hasFilter,
		showPin: pinned,
		showGoToDate: !hasFilter,
	};
}

/**
 * Get the previous month string (YYYY-MM) from a given month.
 */
export function getPreviousMonth(month: string): string {
	const parts = month.split('-').map(Number);
	const year = parts[0] || 2000;
	const monthNum = parts[1] || 1;
	let prevYear = year;
	let prevMonth = monthNum - 1;

	if (prevMonth < 1) {
		prevMonth = 12;
		prevYear--;
	}

	return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
}

/**
 * Get all dates within a specific month from available date sets.
 */
export function getDatesForMonth(
	month: string,
	explicitDates: Iterable<string>,
	implicitDates: Iterable<string>
): string[] {
	const allDates = new Set([...explicitDates, ...implicitDates]);
	return Array.from(allDates).filter((date) => date.startsWith(month));
}

/**
 * Result of searching backward for a month containing dates.
 */
export interface MonthSearchResult {
	/** Every month inspected during the search (start month first, oldest last). */
	visitedMonths: string[];
	/** The first month, searching backward, that contains dates — or null. */
	monthWithDates: string | null;
	/** Dates in `monthWithDates`, sorted newest-first. Empty when none found. */
	dates: string[];
}

/**
 * Search backward from `startMonth` for the first month containing dates.
 *
 * Inspects the start month and up to `maxDepth` previous months. Every month
 * inspected is returned in `visitedMonths` so the caller can mark them all as
 * loaded, avoiding repeat scans of empty months.
 *
 * @param startMonth - Month to start from (YYYY-MM)
 * @param explicitDates - Dates of explicit moments (YYYY-MM-DD)
 * @param implicitDates - Dates of implicit moments (YYYY-MM-DD)
 * @param maxDepth - How many previous months to inspect beyond the start month
 */
export function findMonthWithDates(
	startMonth: string,
	explicitDates: Iterable<string>,
	implicitDates: Iterable<string>,
	maxDepth: number = 12
): MonthSearchResult {
	const explicit = new Set(explicitDates);
	const implicit = new Set(implicitDates);
	const visitedMonths: string[] = [];
	let month = startMonth;

	for (let depth = 0; depth <= maxDepth; depth++) {
		visitedMonths.push(month);
		const dates = getDatesForMonth(month, explicit, implicit);
		if (dates.length > 0) {
			dates.sort((a, b) => b.localeCompare(a));
			return { visitedMonths, monthWithDates: month, dates };
		}
		month = getPreviousMonth(month);
	}

	return { visitedMonths, monthWithDates: null, dates: [] };
}

/**
 * Whether any date falls strictly before the given month.
 *
 * Date strings are YYYY-MM-DD and the month is YYYY-MM; lexical comparison
 * against the shorter month prefix correctly treats every day of an earlier
 * month as "before" and every day of the same month as not before.
 *
 * @param allDates - Date strings to check (YYYY-MM-DD)
 * @param month - Month boundary (YYYY-MM)
 */
export function hasDatesBefore(allDates: Iterable<string>, month: string): boolean {
	for (const date of allDates) {
		if (date < month) return true;
	}
	return false;
}

/**
 * Group moments by their date, sorted newest first within each day.
 */
export function groupMomentsByDate(moments: Moment[]): Map<string, Moment[]> {
	const grouped = new Map<string, Moment[]>();

	for (const moment of moments) {
		if (!grouped.has(moment.date)) {
			grouped.set(moment.date, []);
		}
		grouped.get(moment.date)!.push(moment);
	}

	// Sort moments within each day by firstSeen (newest first)
	for (const [, dateMoments] of grouped) {
		dateMoments.sort((a, b) => b.firstSeen - a.firstSeen);
	}

	return grouped;
}

/**
 * Format a grouped summary of implicit (modified) files for a day.
 * Shows up to 3 names; if more, shows 2 names + "and X more".
 *
 * @param fileNames - Array of file display names
 * @returns Formatted summary string, or empty string if no files
 */
export function formatImplicitSummary(fileNames: string[]): string {
	if (fileNames.length === 0) return '';
	if (fileNames.length <= 3) {
		return `${fileNames.join(', ')} modified`;
	}
	const visible = fileNames.slice(0, 2);
	const remaining = fileNames.length - 2;
	return `${visible.join(', ')}, and ${remaining} more modified`;
}

/**
 * Format the active file moments indicator for a day.
 *
 * @param count - Number of moments in the active file on this day
 * @param fileName - Display name of the active file
 * @returns Formatted indicator string (e.g., "3 moments in Project Alpha")
 */
export function formatActiveFileIndicator(count: number, fileName: string): string {
	return `${count} ${count === 1 ? 'moment' : 'moments'} in ${fileName}`;
}
