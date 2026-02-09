/**
 * Pure functions for finding and manipulating sections in markdown content.
 * These are used by the add-inline command but extracted here for testability.
 */

/**
 * Find a section heading in file content and return its line number.
 * Returns -1 if not found.
 */
export function findSectionLine(content: string, sectionHeading: string): number {
	const lines = content.split('\n');
	const normalizedSection = sectionHeading.trim().toLowerCase();

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line !== undefined && line.trim().toLowerCase() === normalizedSection) {
			return i;
		}
	}
	return -1;
}

/**
 * Find the end of a section (line before next same-or-higher level heading).
 * Returns the line number to insert at for append, or -1 if section goes to end.
 */
export function findSectionEnd(lines: string[], sectionLine: number): number {
	// Get section level
	const sectionLineContent = lines[sectionLine];
	if (!sectionLineContent) return -1;
	const sectionMatch = sectionLineContent.match(/^(#+)/);
	if (!sectionMatch || !sectionMatch[1]) return -1;
	const sectionLevel = sectionMatch[1].length;

	for (let i = sectionLine + 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;
		const match = line.match(/^(#+)\s/);
		if (match && match[1] && match[1].length <= sectionLevel) {
			return i;
		}
	}
	return -1; // Section goes to end of file
}

/**
 * Insert content after a section heading (for prepend behavior).
 */
export function insertAfterSection(
	content: string,
	sectionLine: number,
	newContent: string
): string {
	const lines = content.split('\n');

	// Insert after the section heading, with blank line before
	lines.splice(sectionLine + 1, 0, '', newContent);

	return lines.join('\n');
}

/**
 * Insert content at the end of a section (for append behavior).
 */
export function insertAtSectionEnd(
	content: string,
	sectionLine: number,
	newContent: string
): string {
	const lines = content.split('\n');
	const endLine = findSectionEnd(lines, sectionLine);

	if (endLine === -1) {
		// Section goes to end of file
		lines.push('', newContent);
	} else {
		// Insert before the next section
		lines.splice(endLine, 0, newContent, '');
	}

	return lines.join('\n');
}

/**
 * Add the target section to the end of the file.
 */
export function appendSection(content: string, sectionHeading: string): string {
	// Add section at end with proper spacing
	const trimmed = content.trimEnd();
	return `${trimmed}\n\n${sectionHeading}\n`;
}
