import { moment } from 'obsidian';

/**
 * Default date format (ISO 8601).
 *
 * Formats use Moment.js tokens — the same token language Obsidian and the
 * core Daily Notes plugin use (YYYY, YY, MM, DD, ...).
 */
export const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';

/**
 * Format a Date object as a string using the given Moment.js format.
 */
export function formatDate(date: Date, format: string = DEFAULT_DATE_FORMAT): string {
	return moment(date).format(format);
}

/**
 * Parse a date string using the given Moment.js format.
 *
 * Parsing is strict: the string must match the format exactly and represent
 * a real calendar date (e.g. Feb 30 and month 13 are rejected).
 *
 * @returns A Date object, or null if parsing fails or the date is invalid
 */
export function parseDate(dateString: string, format: string = DEFAULT_DATE_FORMAT): Date | null {
	if (!dateString) return null;

	const parsed = moment(dateString, format, true);
	return parsed.isValid() ? parsed.toDate() : null;
}
