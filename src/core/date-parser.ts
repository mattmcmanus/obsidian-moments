import { format as fnsFormat, parse as fnsParse, isValid } from 'date-fns';

/**
 * Default date format (ISO 8601).
 * Uses moment-style tokens (YYYY, MM, DD) for user-facing consistency.
 */
export const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';

/**
 * Convert moment-style format tokens to date-fns tokens.
 * YYYY → yyyy, YY → yy, DD → dd (MM is the same in both).
 *
 * YYYY is replaced before YY so the four-digit token is not mistaken
 * for two two-digit ones. date-fns treats bare YY/YYYY as week-numbering
 * year tokens and throws, so every year token must be lower-cased.
 */
function toFnsFormat(format: string): string {
	return format
		.replace(/YYYY/g, 'yyyy')
		.replace(/YY/g, 'yy')
		.replace(/DD/g, 'dd');
}

/**
 * Format a Date object as a string using the given format.
 *
 * Supported tokens: YYYY (4-digit year), YY (2-digit year), MM (month), DD (day)
 */
export function formatDate(date: Date, format: string = DEFAULT_DATE_FORMAT): string {
	return fnsFormat(date, toFnsFormat(format));
}

/**
 * Parse a date string using the given format.
 *
 * @returns A Date object, or null if parsing fails or date is invalid
 */
export function parseDate(dateString: string, format: string = DEFAULT_DATE_FORMAT): Date | null {
	if (!dateString) return null;

	const fmtStr = toFnsFormat(format);
	// Use the current date as the reference so a 2-digit year (YY)
	// resolves into the present century rather than the 1900s.
	const date = fnsParse(dateString, fmtStr, new Date());

	if (!isValid(date)) return null;

	// Verify round-trip to catch things like month 13 or Feb 30
	// that date-fns silently rolls over
	if (fnsFormat(date, fmtStr) !== dateString) return null;

	return date;
}
