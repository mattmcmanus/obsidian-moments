/**
 * Parsed moment heading information
 */
export interface ParsedMomentHeading {
	/** The date extracted from the heading (YYYY-MM-DD format) */
	date: string;
	/** The title with the date removed, or null if no title text */
	title: string | null;
	/** The heading level (2-6, H1 is excluded) */
	level: number;
}

/** Pattern for wiki-linked ISO date anywhere in text */
const WIKILINK_DATE_PATTERN = /\[\[(\d{4}-\d{2}-\d{2})\]\]/;

/** Pattern for plain ISO date at start of text (after heading markers) */
const PLAIN_DATE_START_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:\s|$)/;

/** Pattern to match heading markers (## to ######) */
const HEADING_PATTERN = /^(#{2,6})\s+(.*)$/;

/**
 * Parse a heading line to extract moment information.
 *
 * Supports:
 * - Wiki-linked dates anywhere in heading: `### Meeting on [[2026-02-04]] morning`
 * - Plain dates at start of heading text: `### 2026-02-04 Call with Lawyer`
 *
 * H1 headings are excluded (typically used for document titles).
 *
 * @param headingLine - The full heading line including # markers
 * @returns Parsed moment info, or null if not a valid moment heading
 */
export function parseHeadingForMoment(headingLine: string): ParsedMomentHeading | null {
	if (!headingLine) {
		return null;
	}

	// Match heading structure (H2-H6 only)
	const headingMatch = headingLine.match(HEADING_PATTERN);
	if (!headingMatch || !headingMatch[1] || !headingMatch[2]) {
		return null;
	}

	const level = headingMatch[1].length;
	const headingText = headingMatch[2].trim();

	// Try wiki-linked date first (can be anywhere in heading)
	const wikiLinkMatch = headingText.match(WIKILINK_DATE_PATTERN);
	if (wikiLinkMatch && wikiLinkMatch[0] && wikiLinkMatch[1]) {
		const date = wikiLinkMatch[1];
		const title = extractTitle(headingText, wikiLinkMatch[0]);
		return { date, title, level };
	}

	// Try plain date at start of heading text
	const plainDateMatch = headingText.match(PLAIN_DATE_START_PATTERN);
	if (plainDateMatch && plainDateMatch[0] && plainDateMatch[1]) {
		const date = plainDateMatch[1];
		const remainingText = headingText.slice(plainDateMatch[0].length).trim();
		const title = remainingText.length > 0 ? remainingText : null;
		return { date, title, level };
	}

	return null;
}

/**
 * Extract the title from heading text by removing the date portion.
 *
 * @param headingText - The heading text (without # markers)
 * @param dateMatch - The matched date string to remove (e.g., "[[2026-02-04]]")
 * @returns The title text, or null if nothing remains after removing the date
 */
export function extractTitle(headingText: string, dateMatch: string): string | null {
	// Remove the date match
	const withoutDate = headingText.replace(dateMatch, '');

	// Collapse multiple spaces and trim
	const cleaned = withoutDate.replace(/\s+/g, ' ').trim();

	return cleaned.length > 0 ? cleaned : null;
}
