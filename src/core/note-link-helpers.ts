/**
 * Pure functions for extracting and filtering [[note link]] suggestions.
 * Extracted from NoteLinkSuggest for testability.
 */

/**
 * Represents a file with a basename, used for filtering/sorting suggestions.
 * Structurally compatible with Obsidian's TFile.
 */
export interface LinkSuggestionFile {
	basename: string;
}

/**
 * Extract the partial link text from a query string containing an unclosed [[.
 * Returns the lowercase partial text after the last unclosed [[, or null if
 * there is no active link context (no [[ or already closed with ]]).
 */
export function extractPartialLink(query: string): string | null {
	const lastOpen = query.lastIndexOf('[[');
	if (lastOpen === -1) return null;

	// Check if there's a ]] after the [[
	const afterOpen = query.slice(lastOpen + 2);
	if (afterOpen.includes(']]')) return null;

	return afterOpen.toLowerCase();
}

/**
 * Filter and sort files by how well their basename matches a partial link.
 * Files whose basename starts with the partial sort first, then alphabetical.
 */
export function filterAndSortLinkSuggestions<T extends LinkSuggestionFile>(
	files: T[],
	partial: string
): T[] {
	return files
		.filter((file) => file.basename.toLowerCase().includes(partial))
		.sort((a, b) => {
			const aStartsWith = a.basename.toLowerCase().startsWith(partial);
			const bStartsWith = b.basename.toLowerCase().startsWith(partial);
			if (aStartsWith && !bStartsWith) return -1;
			if (!aStartsWith && bStartsWith) return 1;
			return a.basename.localeCompare(b.basename);
		});
}
