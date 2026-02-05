import type { Moment } from '../types';
import { parseHeadingForMoment } from './heading-parser';

/**
 * Default pattern for standalone moment filenames.
 * Matches: "2026-02-04 - Title.md" or "2026-02-04.md"
 */
const DEFAULT_STANDALONE_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:\s*[-–]\s*(.+))?\.md$/;

/**
 * Check if a filename matches the standalone moment pattern.
 *
 * @param filename - The filename to check (without path)
 * @param pattern - Optional custom pattern
 * @returns True if the filename is a standalone moment
 */
export function isStandaloneMoment(
	filename: string,
	pattern: RegExp = DEFAULT_STANDALONE_PATTERN
): boolean {
	return pattern.test(filename);
}

/**
 * Parse a standalone moment filename to extract date and title.
 *
 * @param filename - The filename to parse (without path)
 * @param pattern - Optional custom pattern
 * @returns Parsed date and title, or null if not a match
 */
export function parseStandaloneFilename(
	filename: string,
	pattern: RegExp = DEFAULT_STANDALONE_PATTERN
): { date: string; title: string | null } | null {
	const match = filename.match(pattern);
	if (!match || !match[1]) {
		return null;
	}

	return {
		date: match[1],
		title: match[2] || null,
	};
}

/**
 * Scan file content for inline moments (date-containing headings).
 *
 * @param content - The file content
 * @param filePath - The file path (for moment metadata)
 * @returns Array of moments found in the file
 */
export function scanFileForMoments(content: string, filePath: string): Moment[] {
	const moments: Moment[] = [];

	if (!content) {
		return moments;
	}

	const lines = content.split('\n');
	const now = Date.now();

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;

		// Check if this line is a heading with a date
		const parsed = parseHeadingForMoment(line);
		if (parsed) {
			moments.push({
				type: 'inline',
				date: parsed.date,
				title: parsed.title,
				filePath,
				headingLevel: parsed.level,
				headingLine: i,
				firstSeen: now,
			});
		}
	}

	return moments;
}

/**
 * Create a standalone moment from file metadata.
 *
 * @param filePath - The file path
 * @param filename - The filename (without path)
 * @param createdTime - File creation timestamp (for firstSeen)
 * @returns A Moment object, or null if not a standalone moment
 */
export function createStandaloneMomentFromFile(
	filePath: string,
	filename: string,
	createdTime: number
): Moment | null {
	const parsed = parseStandaloneFilename(filename);
	if (!parsed) {
		return null;
	}

	return {
		type: 'standalone',
		date: parsed.date,
		title: parsed.title,
		filePath,
		firstSeen: createdTime,
	};
}
