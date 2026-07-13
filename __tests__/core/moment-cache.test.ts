import {
	createMomentCache,
	addMomentToCache,
	replaceMomentsForFile,
	removeMomentsForFile,
	getMomentsForDate,
	getMomentsForFile,
	getMomentsInDateRange,
	hasExplicitMoments,
	getAllDatesWithMoments,
	clearCache,
} from '../../src/core/moment-cache';
import type { Moment } from '../../src/types';

function createTestMoment(overrides: Partial<Moment> = {}): Moment {
	return {
		type: 'inline',
		date: '2026-02-04',
		title: 'Test moment',
		filePath: 'test.md',
		headingLevel: 3,
		headingLine: 5,
		firstSeen: Date.now(),
		...overrides,
	};
}

describe('createMomentCache', () => {
	it('creates empty cache', () => {
		const cache = createMomentCache();

		expect(cache.byDate.size).toBe(0);
		expect(cache.byFile.size).toBe(0);
		expect(cache.filesWithMoments.size).toBe(0);
		expect(cache.lastScan).toBeGreaterThan(0);
	});
});

describe('addMomentToCache', () => {
	it('adds moment to byDate index', () => {
		const cache = createMomentCache();
		const moment = createTestMoment({ date: '2026-02-04' });

		addMomentToCache(cache, moment);

		expect(cache.byDate.get('2026-02-04')).toContain(moment);
	});

	it('adds moment to byFile index', () => {
		const cache = createMomentCache();
		const moment = createTestMoment({ filePath: 'project.md' });

		addMomentToCache(cache, moment);

		expect(cache.byFile.get('project.md')).toContain(moment);
	});

	it('adds file to filesWithMoments set', () => {
		const cache = createMomentCache();
		const moment = createTestMoment({ filePath: 'project.md' });

		addMomentToCache(cache, moment);

		expect(cache.filesWithMoments.has('project.md')).toBe(true);
	});

	it('handles multiple moments on same date', () => {
		const cache = createMomentCache();
		const moment1 = createTestMoment({ date: '2026-02-04', title: 'First' });
		const moment2 = createTestMoment({ date: '2026-02-04', title: 'Second' });

		addMomentToCache(cache, moment1);
		addMomentToCache(cache, moment2);

		const moments = cache.byDate.get('2026-02-04');
		expect(moments).toHaveLength(2);
	});

	it('handles multiple moments in same file', () => {
		const cache = createMomentCache();
		const moment1 = createTestMoment({ filePath: 'project.md', headingLine: 5 });
		const moment2 = createTestMoment({ filePath: 'project.md', headingLine: 10 });

		addMomentToCache(cache, moment1);
		addMomentToCache(cache, moment2);

		const moments = cache.byFile.get('project.md');
		expect(moments).toHaveLength(2);
	});
});

describe('removeMomentsForFile', () => {
	it('removes all moments for a file', () => {
		const cache = createMomentCache();
		const moment1 = createTestMoment({ filePath: 'project.md', date: '2026-02-04' });
		const moment2 = createTestMoment({ filePath: 'project.md', date: '2026-02-05' });
		addMomentToCache(cache, moment1);
		addMomentToCache(cache, moment2);

		removeMomentsForFile(cache, 'project.md');

		expect(cache.byFile.has('project.md')).toBe(false);
		expect(cache.filesWithMoments.has('project.md')).toBe(false);
	});

	it('removes moments from byDate index', () => {
		const cache = createMomentCache();
		const moment = createTestMoment({ filePath: 'project.md', date: '2026-02-04' });
		addMomentToCache(cache, moment);

		removeMomentsForFile(cache, 'project.md');

		const momentsForDate = cache.byDate.get('2026-02-04');
		expect(momentsForDate).toBeUndefined();
	});

	it('preserves moments from other files on same date', () => {
		const cache = createMomentCache();
		const moment1 = createTestMoment({ filePath: 'file1.md', date: '2026-02-04' });
		const moment2 = createTestMoment({ filePath: 'file2.md', date: '2026-02-04' });
		addMomentToCache(cache, moment1);
		addMomentToCache(cache, moment2);

		removeMomentsForFile(cache, 'file1.md');

		const momentsForDate = cache.byDate.get('2026-02-04');
		expect(momentsForDate).toHaveLength(1);
		expect(momentsForDate?.[0]?.filePath).toBe('file2.md');
	});
});

describe('replaceMomentsForFile', () => {
	it('re-scanning a file yields one moment, not a duplicate', () => {
		const cache = createMomentCache();
		const moment = createTestMoment({ filePath: 'daily.md', date: '2026-02-04' });

		// Two scans of the same file (e.g. startup scan + file-event batch).
		replaceMomentsForFile(cache, 'daily.md', [moment]);
		replaceMomentsForFile(cache, 'daily.md', [moment]);

		expect(getMomentsForFile(cache, 'daily.md')).toHaveLength(1);
		expect(cache.byDate.get('2026-02-04')).toHaveLength(1);
	});

	it('replaces the file’s previous moments with the new set', () => {
		const cache = createMomentCache();
		replaceMomentsForFile(cache, 'note.md', [
			createTestMoment({ filePath: 'note.md', date: '2026-02-04', headingLine: 5 }),
		]);

		replaceMomentsForFile(cache, 'note.md', [
			createTestMoment({ filePath: 'note.md', date: '2026-02-06', headingLine: 8 }),
		]);

		const moments = getMomentsForFile(cache, 'note.md');
		expect(moments).toHaveLength(1);
		expect(moments[0]?.date).toBe('2026-02-06');
		expect(cache.byDate.has('2026-02-04')).toBe(false);
	});

	it('adds every moment when a file has more than one', () => {
		const cache = createMomentCache();

		replaceMomentsForFile(cache, 'note.md', [
			createTestMoment({ filePath: 'note.md', date: '2026-02-04', headingLine: 5 }),
			createTestMoment({ filePath: 'note.md', date: '2026-02-04', headingLine: 10 }),
		]);

		expect(getMomentsForFile(cache, 'note.md')).toHaveLength(2);
		expect(cache.byDate.get('2026-02-04')).toHaveLength(2);
	});

	it('clears the file from the cache when given no moments', () => {
		const cache = createMomentCache();
		replaceMomentsForFile(cache, 'note.md', [
			createTestMoment({ filePath: 'note.md', date: '2026-02-04' }),
		]);

		replaceMomentsForFile(cache, 'note.md', []);

		expect(cache.byFile.has('note.md')).toBe(false);
		expect(hasExplicitMoments(cache, 'note.md')).toBe(false);
		expect(cache.byDate.has('2026-02-04')).toBe(false);
	});

	it('leaves moments from other files untouched', () => {
		const cache = createMomentCache();
		addMomentToCache(cache, createTestMoment({ filePath: 'other.md', date: '2026-02-04' }));

		replaceMomentsForFile(cache, 'note.md', [
			createTestMoment({ filePath: 'note.md', date: '2026-02-04' }),
		]);
		replaceMomentsForFile(cache, 'note.md', [
			createTestMoment({ filePath: 'note.md', date: '2026-02-04' }),
		]);

		expect(getMomentsForFile(cache, 'other.md')).toHaveLength(1);
		expect(cache.byDate.get('2026-02-04')).toHaveLength(2);
	});
});

describe('getMomentsForDate', () => {
	it('returns moments for a specific date', () => {
		const cache = createMomentCache();
		const moment = createTestMoment({ date: '2026-02-04' });
		addMomentToCache(cache, moment);

		const result = getMomentsForDate(cache, '2026-02-04');

		expect(result).toHaveLength(1);
		expect(result[0]).toBe(moment);
	});

	it('returns empty array for date with no moments', () => {
		const cache = createMomentCache();

		const result = getMomentsForDate(cache, '2026-02-04');

		expect(result).toEqual([]);
	});

	it('sorts moments by firstSeen (newest first)', () => {
		const cache = createMomentCache();
		const older = createTestMoment({ date: '2026-02-04', firstSeen: 1000, title: 'Older' });
		const newer = createTestMoment({ date: '2026-02-04', firstSeen: 2000, title: 'Newer' });
		addMomentToCache(cache, older);
		addMomentToCache(cache, newer);

		const result = getMomentsForDate(cache, '2026-02-04');

		expect(result[0]?.title).toBe('Newer');
		expect(result[1]?.title).toBe('Older');
	});
});

describe('getMomentsForFile', () => {
	it('returns moments for a specific file', () => {
		const cache = createMomentCache();
		const moment = createTestMoment({ filePath: 'project.md' });
		addMomentToCache(cache, moment);

		const result = getMomentsForFile(cache, 'project.md');

		expect(result).toHaveLength(1);
		expect(result[0]).toBe(moment);
	});

	it('returns empty array for file with no moments', () => {
		const cache = createMomentCache();

		const result = getMomentsForFile(cache, 'project.md');

		expect(result).toEqual([]);
	});
});

describe('getMomentsInDateRange', () => {
	it('returns moments within date range (inclusive)', () => {
		const cache = createMomentCache();
		const moment1 = createTestMoment({ date: '2026-02-01' });
		const moment2 = createTestMoment({ date: '2026-02-04' });
		const moment3 = createTestMoment({ date: '2026-02-10' });
		addMomentToCache(cache, moment1);
		addMomentToCache(cache, moment2);
		addMomentToCache(cache, moment3);

		const result = getMomentsInDateRange(cache, '2026-02-01', '2026-02-05');

		expect(result).toHaveLength(2);
		expect(result.map((m) => m.date)).toContain('2026-02-01');
		expect(result.map((m) => m.date)).toContain('2026-02-04');
	});

	it('handles single day range', () => {
		const cache = createMomentCache();
		const moment = createTestMoment({ date: '2026-02-04' });
		addMomentToCache(cache, moment);

		const result = getMomentsInDateRange(cache, '2026-02-04', '2026-02-04');

		expect(result).toHaveLength(1);
	});

	it('returns empty array for range with no moments', () => {
		const cache = createMomentCache();
		const moment = createTestMoment({ date: '2026-02-04' });
		addMomentToCache(cache, moment);

		const result = getMomentsInDateRange(cache, '2026-03-01', '2026-03-31');

		expect(result).toEqual([]);
	});
});

describe('hasExplicitMoments', () => {
	it('returns true if file has explicit moments', () => {
		const cache = createMomentCache();
		const moment = createTestMoment({ filePath: 'project.md' });
		addMomentToCache(cache, moment);

		expect(hasExplicitMoments(cache, 'project.md')).toBe(true);
	});

	it('returns false if file has no explicit moments', () => {
		const cache = createMomentCache();

		expect(hasExplicitMoments(cache, 'other.md')).toBe(false);
	});
});

describe('getAllDatesWithMoments', () => {
	it('returns dates sorted newest first', () => {
		const cache = createMomentCache();
		addMomentToCache(cache, createTestMoment({ date: '2026-01-15' }));
		addMomentToCache(cache, createTestMoment({ date: '2026-03-01' }));
		addMomentToCache(cache, createTestMoment({ date: '2026-02-04' }));

		const dates = getAllDatesWithMoments(cache);

		expect(dates).toEqual(['2026-03-01', '2026-02-04', '2026-01-15']);
	});

	it('returns empty array for empty cache', () => {
		const cache = createMomentCache();

		expect(getAllDatesWithMoments(cache)).toEqual([]);
	});

	it('returns unique dates even with multiple moments per date', () => {
		const cache = createMomentCache();
		addMomentToCache(cache, createTestMoment({ date: '2026-02-04', title: 'First' }));
		addMomentToCache(cache, createTestMoment({ date: '2026-02-04', title: 'Second' }));

		const dates = getAllDatesWithMoments(cache);

		expect(dates).toEqual(['2026-02-04']);
	});
});

describe('clearCache', () => {
	it('empties all cache indexes', () => {
		const cache = createMomentCache();
		addMomentToCache(cache, createTestMoment({ date: '2026-02-04', filePath: 'a.md' }));
		addMomentToCache(cache, createTestMoment({ date: '2026-02-05', filePath: 'b.md' }));

		clearCache(cache);

		expect(cache.byDate.size).toBe(0);
		expect(cache.byFile.size).toBe(0);
		expect(cache.filesWithMoments.size).toBe(0);
	});

	it('updates lastScan timestamp', () => {
		const cache = createMomentCache();
		const beforeClear = cache.lastScan;

		// Small delay to ensure different timestamp
		clearCache(cache);

		expect(cache.lastScan).toBeGreaterThanOrEqual(beforeClear);
	});
});

describe('removeMomentsForFile - edge cases', () => {
	it('handles removing moments for a file not in the cache', () => {
		const cache = createMomentCache();

		removeMomentsForFile(cache, 'nonexistent.md');

		expect(cache.byFile.size).toBe(0);
	});
});
