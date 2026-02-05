/**
 * Default date format (ISO 8601)
 */
export const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';

/**
 * Format a Date object as a string using the given format.
 *
 * Supported tokens:
 * - YYYY: 4-digit year
 * - MM: 2-digit month (01-12)
 * - DD: 2-digit day (01-31)
 *
 * @param date - The Date object to format
 * @param format - The format string (default: YYYY-MM-DD)
 * @returns Formatted date string
 */
export function formatDate(date: Date, format: string = DEFAULT_DATE_FORMAT): string {
	const year = date.getFullYear().toString();
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	const day = date.getDate().toString().padStart(2, '0');

	return format
		.replace('YYYY', year)
		.replace('MM', month)
		.replace('DD', day);
}

/**
 * Parse a date string using the given format.
 *
 * @param dateString - The date string to parse
 * @param format - The format string (default: YYYY-MM-DD)
 * @returns A Date object, or null if parsing fails or date is invalid
 */
export function parseDate(dateString: string, format: string = DEFAULT_DATE_FORMAT): Date | null {
	if (!dateString) {
		return null;
	}

	const pattern = buildDatePattern(format);
	if (!pattern.test(dateString)) {
		return null;
	}

	// Extract positions of YYYY, MM, DD in format
	const yearIndex = format.indexOf('YYYY');
	const monthIndex = format.indexOf('MM');
	const dayIndex = format.indexOf('DD');

	// Build a map of position to component
	const positions: Array<{ index: number; type: 'year' | 'month' | 'day'; length: number }> = [
		{ index: yearIndex, type: 'year' as const, length: 4 },
		{ index: monthIndex, type: 'month' as const, length: 2 },
		{ index: dayIndex, type: 'day' as const, length: 2 },
	].sort((a, b) => a.index - b.index);

	// Extract values based on positions
	let year = 0;
	let month = 0;
	let day = 0;
	let currentPos = 0;

	for (const pos of positions) {
		// Skip separator characters
		const separatorLength = pos.index - currentPos;
		currentPos += separatorLength;

		const value = parseInt(dateString.slice(currentPos, currentPos + pos.length), 10);
		currentPos += pos.length;

		switch (pos.type) {
			case 'year':
				year = value;
				break;
			case 'month':
				month = value;
				break;
			case 'day':
				day = value;
				break;
		}
	}

	// Validate the date components
	if (month < 1 || month > 12) {
		return null;
	}

	// Create date and validate
	const date = new Date(year, month - 1, day);

	// Check if the date is valid (handles things like Feb 30)
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day
	) {
		return null;
	}

	return date;
}

/**
 * Check if a date string is valid according to the given format.
 *
 * @param dateString - The date string to validate
 * @param format - The format string (default: YYYY-MM-DD)
 * @returns True if the date string is valid
 */
export function isValidDateString(dateString: string, format: string = DEFAULT_DATE_FORMAT): boolean {
	return parseDate(dateString, format) !== null;
}

/**
 * Get today's date as a formatted string.
 *
 * @param format - The format string (default: YYYY-MM-DD)
 * @returns Today's date formatted as a string
 */
export function getTodayString(format: string = DEFAULT_DATE_FORMAT): string {
	return formatDate(new Date(), format);
}

/**
 * Build a regex pattern that matches dates in the given format.
 *
 * @param format - The format string (e.g., YYYY-MM-DD)
 * @returns A RegExp that matches dates in that format
 */
export function buildDatePattern(format: string): RegExp {
	// Escape regex special characters in the format, except for our tokens
	const escaped = format
		.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		.replace('YYYY', '\\d{4}')
		.replace('MM', '\\d{2}')
		.replace('DD', '\\d{2}');

	return new RegExp(`^${escaped}$`);
}
