/**
 * Debug logging utility for Moments plugin.
 * Only logs when debug mode is enabled in settings.
 */

let debugEnabled = false;

/**
 * Set whether debug mode is enabled.
 */
export function setDebugMode(enabled: boolean): void {
	debugEnabled = enabled;
	if (enabled) {
		console.debug('[Moments] Debug mode enabled');
	}
}

/**
 * Log a debug message with optional data.
 */
export function debug(message: string, data?: unknown): void {
	if (!debugEnabled) return;

	const timestamp = new Date().toISOString().split('T')[1]?.slice(0, 12) ?? '';
	if (data !== undefined) {
		console.debug(`[Moments ${timestamp}] ${message}`, data);
	} else {
		console.debug(`[Moments ${timestamp}] ${message}`);
	}
}

/**
 * Log a debug message for a timed operation.
 * Returns a function to call when the operation completes.
 */
export function debugTimed(operation: string): () => void {
	if (!debugEnabled) return () => {};

	const start = performance.now();
	debug(`${operation} started`);

	return () => {
		const duration = (performance.now() - start).toFixed(2);
		debug(`${operation} completed in ${duration}ms`);
	};
}

/**
 * Log cache statistics.
 */
export function debugCacheStats(stats: {
	totalMoments: number;
	totalDates: number;
	totalFiles: number;
}): void {
	if (!debugEnabled) return;

	debug('Cache stats', {
		moments: stats.totalMoments,
		dates: stats.totalDates,
		files: stats.totalFiles,
	});
}
