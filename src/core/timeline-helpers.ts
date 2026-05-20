import type { Moment } from '../types';

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
