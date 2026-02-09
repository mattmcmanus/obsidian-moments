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
