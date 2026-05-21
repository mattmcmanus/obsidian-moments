import { moment } from 'obsidian';
import { formatDate } from './date-parser';

/**
 * Types of periodic notes
 */
export type PeriodicNoteType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * Result of detecting a periodic note
 */
export interface PeriodicNoteInfo {
	type: PeriodicNoteType;
	date: string;
}

/**
 * Date range for filtering
 */
export interface DateRange {
	startDate: string;
	endDate: string;
}

/**
 * Default patterns for periodic notes
 */
export const PERIODIC_PATTERNS = {
	daily: /^(\d{4}-\d{2}-\d{2})$/,
	weekly: /^(\d{4})-W(\d{2})$/,
	monthly: /^(\d{4}-\d{2})$/,
	quarterly: /^(\d{4})-Q([1-4])$/,
	yearly: /^(\d{4})$/,
};

/**
 * Detect if a file is a periodic note based on filename and settings.
 *
 * @param filePath - Full file path
 * @param dailyFolder - Folder for daily notes (e.g., "daily/")
 * @param dailyFormat - Format for daily notes (e.g., "YYYY-MM-DD")
 * @returns Periodic note info, or null if not a periodic note
 */
export function detectPeriodicNoteType(
	filePath: string,
	dailyFolder: string,
	dailyFormat: string
): PeriodicNoteInfo | null {
	// Get just the filename without extension
	const filename = filePath.split('/').pop()?.replace(/\.md$/, '') || '';

	// Check if the filename matches the configured daily-note format.
	// Strict parsing requires an exact match and a real calendar date.
	const dailyMoment = moment(filename, dailyFormat, true);
	if (dailyMoment.isValid()) {
		return { type: 'daily', date: dailyMoment.format('YYYY-MM-DD') };
	}

	// Check weekly pattern (YYYY-Www)
	const weeklyMatch = filename.match(PERIODIC_PATTERNS.weekly);
	if (weeklyMatch && weeklyMatch[1] && weeklyMatch[2]) {
		return { type: 'weekly', date: `${weeklyMatch[1]}-W${weeklyMatch[2]}` };
	}

	// Check monthly pattern (YYYY-MM)
	const monthlyMatch = filename.match(PERIODIC_PATTERNS.monthly);
	if (monthlyMatch && monthlyMatch[1]) {
		// Make sure it's not a daily note (YYYY-MM-DD)
		if (!PERIODIC_PATTERNS.daily.test(filename)) {
			return { type: 'monthly', date: monthlyMatch[1] };
		}
	}

	// Check quarterly pattern (YYYY-Qn)
	const quarterlyMatch = filename.match(PERIODIC_PATTERNS.quarterly);
	if (quarterlyMatch && quarterlyMatch[1] && quarterlyMatch[2]) {
		return { type: 'quarterly', date: `${quarterlyMatch[1]}-Q${quarterlyMatch[2]}` };
	}

	// Check yearly pattern (YYYY)
	const yearlyMatch = filename.match(PERIODIC_PATTERNS.yearly);
	if (yearlyMatch && yearlyMatch[1] && filename.length === 4) {
		return { type: 'yearly', date: yearlyMatch[1] };
	}

	return null;
}

/**
 * Get the date range for a periodic note.
 *
 * @param type - Type of periodic note
 * @param dateStr - Date string (format depends on type)
 * @returns Start and end dates in ISO format
 */
export function getDateRangeForPeriodicNote(
	type: PeriodicNoteType,
	dateStr: string
): DateRange {
	switch (type) {
		case 'daily':
			return { startDate: dateStr, endDate: dateStr };

		case 'weekly':
			return getWeekRange(dateStr);

		case 'monthly':
			return getMonthRange(dateStr);

		case 'quarterly':
			return getQuarterRange(dateStr);

		case 'yearly':
			return getYearRange(dateStr);
	}
}

/**
 * Get date range for a week (ISO week format YYYY-Www).
 */
function getWeekRange(weekStr: string): DateRange {
	const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
	if (!match || !match[1] || !match[2]) {
		throw new Error(`Invalid week format: ${weekStr}`);
	}

	const year = parseInt(match[1], 10);
	const week = parseInt(match[2], 10);

	// Calculate the Monday of the given ISO week
	// ISO week 1 is the week containing January 4th
	const jan4 = new Date(year, 0, 4);
	const dayOfWeek = jan4.getDay() || 7; // Convert Sunday (0) to 7
	const firstMonday = new Date(jan4);
	firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);

	// Calculate the Monday of the requested week
	const weekStart = new Date(firstMonday);
	weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);

	// Calculate the Sunday (end of week)
	const weekEnd = new Date(weekStart);
	weekEnd.setDate(weekStart.getDate() + 6);

	return {
		startDate: formatDate(weekStart),
		endDate: formatDate(weekEnd),
	};
}

/**
 * Get date range for a month (YYYY-MM).
 */
function getMonthRange(monthStr: string): DateRange {
	const match = monthStr.match(/^(\d{4})-(\d{2})$/);
	if (!match || !match[1] || !match[2]) {
		throw new Error(`Invalid month format: ${monthStr}`);
	}

	const year = parseInt(match[1], 10);
	const month = parseInt(match[2], 10);

	const startDate = new Date(year, month - 1, 1);
	const endDate = new Date(year, month, 0); // Day 0 of next month = last day of this month

	return {
		startDate: formatDate(startDate),
		endDate: formatDate(endDate),
	};
}

/**
 * Get date range for a quarter (YYYY-Qn).
 */
function getQuarterRange(quarterStr: string): DateRange {
	const match = quarterStr.match(/^(\d{4})-Q([1-4])$/);
	if (!match || !match[1] || !match[2]) {
		throw new Error(`Invalid quarter format: ${quarterStr}`);
	}

	const year = parseInt(match[1], 10);
	const quarter = parseInt(match[2], 10);

	const startMonth = (quarter - 1) * 3; // 0, 3, 6, 9
	const endMonth = startMonth + 3; // 3, 6, 9, 12

	const startDate = new Date(year, startMonth, 1);
	const endDate = new Date(year, endMonth, 0); // Last day of the quarter

	return {
		startDate: formatDate(startDate),
		endDate: formatDate(endDate),
	};
}

/**
 * Get date range for a year (YYYY).
 */
function getYearRange(yearStr: string): DateRange {
	const year = parseInt(yearStr, 10);

	return {
		startDate: `${year}-01-01`,
		endDate: `${year}-12-31`,
	};
}
