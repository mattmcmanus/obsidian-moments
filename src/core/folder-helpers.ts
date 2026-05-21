/**
 * Filter and rank folder-like items for autocomplete suggestions.
 *
 * Pure function — no Obsidian imports — so it operates on any object with a
 * `path` string and returns the same items, ranked:
 *   1. prefix matches before mid-string matches
 *   2. shorter paths first
 *   3. alphabetical
 */
export function filterFolderSuggestions<T extends { path: string }>(
	folders: T[],
	query: string
): T[] {
	const q = query.trim().toLowerCase();

	const matches = q
		? folders.filter((f) => f.path.toLowerCase().includes(q))
		: folders.slice();

	return matches.sort((a, b) => {
		const ap = a.path.toLowerCase();
		const bp = b.path.toLowerCase();

		if (q) {
			const aStarts = ap.startsWith(q);
			const bStarts = bp.startsWith(q);
			if (aStarts !== bStarts) return aStarts ? -1 : 1;
		}

		if (ap.length !== bp.length) return ap.length - bp.length;
		return ap.localeCompare(bp);
	});
}
