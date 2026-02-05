/**
 * Pattern to match heading lines
 */
const HEADING_PATTERN = /^(#{1,6})\s+/;

/**
 * Get the heading level of a line (1-6), or null if not a heading.
 *
 * @param line - The line to check
 * @returns The heading level (1-6), or null if not a heading
 */
export function getHeadingLevel(line: string): number | null {
	const match = line.match(HEADING_PATTERN);
	if (!match || !match[1]) {
		return null;
	}
	return match[1].length;
}

/**
 * Find the line number of the next heading at the same or higher level.
 *
 * @param lines - Array of lines from the file
 * @param startLine - The line to start searching from (exclusive)
 * @param headingLevel - The current heading level
 * @returns The line number of the next heading, or -1 if not found
 */
export function findNextHeadingLine(
	lines: string[],
	startLine: number,
	headingLevel: number
): number {
	for (let i = startLine + 1; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		const level = getHeadingLevel(line);
		// Found a heading at same or higher (lower number) level
		if (level !== null && level <= headingLevel) {
			return i;
		}
	}
	return -1;
}

/**
 * Extract the content under a heading, up to the next heading of same or higher level.
 *
 * @param fileContent - The full file content
 * @param headingLineNumber - The line number of the heading (0-indexed)
 * @param headingLevel - The level of the heading (2-6)
 * @returns The content under the heading, trimmed
 */
export function extractContentUnderHeading(
	fileContent: string,
	headingLineNumber: number,
	headingLevel: number
): string {
	// Normalize line endings
	const normalizedContent = fileContent.replace(/\r\n/g, '\n');
	const lines = normalizedContent.split('\n');

	// Find the end of this heading's content
	const nextHeadingLine = findNextHeadingLine(lines, headingLineNumber, headingLevel);

	// Extract lines between heading and next heading (or end of file)
	const endLine = nextHeadingLine === -1 ? lines.length : nextHeadingLine;
	const contentLines = lines.slice(headingLineNumber + 1, endLine);

	// Join and trim
	const content = contentLines.join('\n').trim();

	return content;
}
