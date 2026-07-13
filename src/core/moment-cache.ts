import type { Moment, MomentCache } from '../types';

/**
 * Create a new empty moment cache.
 *
 * @returns A new MomentCache instance
 */
export function createMomentCache(): MomentCache {
	return {
		byDate: new Map(),
		byFile: new Map(),
		filesWithMoments: new Set(),
		lastScan: Date.now(),
	};
}

/**
 * Add a moment to the cache.
 *
 * @param cache - The cache to update
 * @param moment - The moment to add
 */
export function addMomentToCache(cache: MomentCache, moment: Moment): void {
	// Add to byDate index
	const dateKey = moment.date;
	if (!cache.byDate.has(dateKey)) {
		cache.byDate.set(dateKey, []);
	}
	cache.byDate.get(dateKey)!.push(moment);

	// Add to byFile index
	const fileKey = moment.filePath;
	if (!cache.byFile.has(fileKey)) {
		cache.byFile.set(fileKey, []);
	}
	cache.byFile.get(fileKey)!.push(moment);

	// Add to filesWithMoments set
	cache.filesWithMoments.add(fileKey);
}

/**
 * Replace all cached moments for a file with a new set.
 *
 * Clears any moments previously recorded for the file, then adds the provided
 * ones. Scanning a file therefore stays idempotent: re-scanning yields the same
 * cache state instead of appending duplicate moments. Passing an empty array
 * clears the file from the cache (e.g. when its last moment is removed).
 *
 * @param cache - The cache to update
 * @param filePath - The file whose moments are being replaced
 * @param moments - The moments now present in the file (may be empty)
 */
export function replaceMomentsForFile(
	cache: MomentCache,
	filePath: string,
	moments: Moment[]
): void {
	removeMomentsForFile(cache, filePath);
	for (const moment of moments) {
		addMomentToCache(cache, moment);
	}
}

/**
 * Remove all moments for a specific file from the cache.
 *
 * @param cache - The cache to update
 * @param filePath - The file path to remove moments for
 */
export function removeMomentsForFile(cache: MomentCache, filePath: string): void {
	// Get moments for this file
	const moments = cache.byFile.get(filePath);
	if (!moments) {
		return;
	}

	// Remove from byDate index
	for (const moment of moments) {
		const dateMoments = cache.byDate.get(moment.date);
		if (dateMoments) {
			const filtered = dateMoments.filter((m) => m.filePath !== filePath);
			if (filtered.length === 0) {
				cache.byDate.delete(moment.date);
			} else {
				cache.byDate.set(moment.date, filtered);
			}
		}
	}

	// Remove from byFile index
	cache.byFile.delete(filePath);

	// Remove from filesWithMoments set
	cache.filesWithMoments.delete(filePath);
}

/**
 * Get all moments for a specific date, sorted by firstSeen (newest first).
 *
 * @param cache - The cache to query
 * @param date - The date string (YYYY-MM-DD)
 * @returns Array of moments for that date, sorted newest first
 */
export function getMomentsForDate(cache: MomentCache, date: string): Moment[] {
	const moments = cache.byDate.get(date);
	if (!moments) {
		return [];
	}

	// Sort by firstSeen, newest first
	return [...moments].sort((a, b) => b.firstSeen - a.firstSeen);
}

/**
 * Get all moments for a specific file.
 *
 * @param cache - The cache to query
 * @param filePath - The file path
 * @returns Array of moments in that file
 */
export function getMomentsForFile(cache: MomentCache, filePath: string): Moment[] {
	return cache.byFile.get(filePath) || [];
}

/**
 * Get all moments within a date range (inclusive).
 *
 * @param cache - The cache to query
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Array of moments within the range
 */
export function getMomentsInDateRange(
	cache: MomentCache,
	startDate: string,
	endDate: string
): Moment[] {
	const moments: Moment[] = [];

	for (const [date, dateMoments] of cache.byDate) {
		if (date >= startDate && date <= endDate) {
			moments.push(...dateMoments);
		}
	}

	// Sort by date (newest first), then by firstSeen (newest first)
	return moments.sort((a, b) => {
		if (a.date !== b.date) {
			return b.date.localeCompare(a.date);
		}
		return b.firstSeen - a.firstSeen;
	});
}

/**
 * Check if a file has explicit moments.
 *
 * @param cache - The cache to query
 * @param filePath - The file path to check
 * @returns True if the file has explicit moments
 */
export function hasExplicitMoments(cache: MomentCache, filePath: string): boolean {
	return cache.filesWithMoments.has(filePath);
}

/**
 * Get all unique dates that have moments.
 *
 * @param cache - The cache to query
 * @returns Array of date strings, sorted newest first
 */
export function getAllDatesWithMoments(cache: MomentCache): string[] {
	return Array.from(cache.byDate.keys()).sort((a, b) => b.localeCompare(a));
}

/**
 * Clear the cache.
 *
 * @param cache - The cache to clear
 */
export function clearCache(cache: MomentCache): void {
	cache.byDate.clear();
	cache.byFile.clear();
	cache.filesWithMoments.clear();
	cache.lastScan = Date.now();
}
