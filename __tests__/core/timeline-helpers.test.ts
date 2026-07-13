import {
	getPreviousMonth,
	getDatesForMonth,
	groupMomentsByDate,
	formatImplicitSummary,
	formatActiveFileIndicator,
	findMonthWithDates,
	hasDatesBefore,
	computeHeaderControlsState,
} from '../../src/core/timeline-helpers';
import type { Moment, TimelineFilter } from '../../src/types';

function createFilter(overrides: Partial<TimelineFilter> = {}): TimelineFilter {
	return {
		startDate: null,
		endDate: null,
		searchText: null,
		relatedToFile: null,
		...overrides,
	};
}

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

describe('getPreviousMonth', () => {
	it('returns previous month in same year', () => {
		expect(getPreviousMonth('2026-03')).toBe('2026-02');
	});

	it('wraps to December of previous year', () => {
		expect(getPreviousMonth('2026-01')).toBe('2025-12');
	});

	it('handles mid-year months', () => {
		expect(getPreviousMonth('2026-07')).toBe('2026-06');
	});

	it('pads single-digit months', () => {
		expect(getPreviousMonth('2026-02')).toBe('2026-01');
	});
});

describe('getDatesForMonth', () => {
	it('returns dates matching the month from both sources', () => {
		const explicit = ['2026-02-01', '2026-02-15', '2026-03-01'];
		const implicit = ['2026-02-10', '2026-01-15'];

		const result = getDatesForMonth('2026-02', explicit, implicit);

		expect(result.sort()).toEqual(['2026-02-01', '2026-02-10', '2026-02-15']);
	});

	it('deduplicates dates across explicit and implicit', () => {
		const explicit = ['2026-02-04'];
		const implicit = ['2026-02-04'];

		const result = getDatesForMonth('2026-02', explicit, implicit);

		expect(result).toEqual(['2026-02-04']);
	});

	it('returns empty array for month with no dates', () => {
		const explicit = ['2026-01-15'];
		const implicit = ['2026-03-01'];

		const result = getDatesForMonth('2026-02', explicit, implicit);

		expect(result).toEqual([]);
	});

	it('works with empty inputs', () => {
		const result = getDatesForMonth('2026-02', [], []);

		expect(result).toEqual([]);
	});
});

describe('groupMomentsByDate', () => {
	it('groups moments by their date', () => {
		const moments = [
			createTestMoment({ date: '2026-02-04', title: 'A' }),
			createTestMoment({ date: '2026-02-05', title: 'B' }),
			createTestMoment({ date: '2026-02-04', title: 'C' }),
		];

		const grouped = groupMomentsByDate(moments);

		expect(grouped.size).toBe(2);
		expect(grouped.get('2026-02-04')).toHaveLength(2);
		expect(grouped.get('2026-02-05')).toHaveLength(1);
	});

	it('sorts moments within each day by firstSeen (newest first)', () => {
		const moments = [
			createTestMoment({ date: '2026-02-04', firstSeen: 1000, title: 'Older' }),
			createTestMoment({ date: '2026-02-04', firstSeen: 3000, title: 'Newest' }),
			createTestMoment({ date: '2026-02-04', firstSeen: 2000, title: 'Middle' }),
		];

		const grouped = groupMomentsByDate(moments);
		const dayMoments = grouped.get('2026-02-04')!;

		expect(dayMoments[0]?.title).toBe('Newest');
		expect(dayMoments[1]?.title).toBe('Middle');
		expect(dayMoments[2]?.title).toBe('Older');
	});

	it('returns empty map for no moments', () => {
		const grouped = groupMomentsByDate([]);

		expect(grouped.size).toBe(0);
	});
});

describe('formatImplicitSummary', () => {
	it('returns empty string for no files', () => {
		expect(formatImplicitSummary([])).toBe('');
	});

	it('formats a single file', () => {
		expect(formatImplicitSummary(['Note A'])).toBe('Note A modified');
	});

	it('formats two files', () => {
		expect(formatImplicitSummary(['Note A', 'Note B'])).toBe('Note A, Note B modified');
	});

	it('formats three files without truncation', () => {
		expect(formatImplicitSummary(['Note A', 'Note B', 'Note C']))
			.toBe('Note A, Note B, Note C modified');
	});

	it('truncates four or more files to two visible names', () => {
		expect(formatImplicitSummary(['Note A', 'Note B', 'Note C', 'Note D']))
			.toBe('Note A, Note B, and 2 more modified');
	});

	it('truncates many files correctly', () => {
		const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
		expect(formatImplicitSummary(files))
			.toBe('A, B, and 5 more modified');
	});
});

describe('formatActiveFileIndicator', () => {
	it('formats singular moment count', () => {
		expect(formatActiveFileIndicator(1, 'Project Alpha'))
			.toBe('1 moment in Project Alpha');
	});

	it('formats plural moment count', () => {
		expect(formatActiveFileIndicator(3, 'Project Alpha'))
			.toBe('3 moments in Project Alpha');
	});
});

describe('findMonthWithDates', () => {
	it('finds dates in the start month', () => {
		const result = findMonthWithDates('2026-05', ['2026-05-04', '2026-05-20'], []);
		expect(result.monthWithDates).toBe('2026-05');
		expect(result.dates).toEqual(['2026-05-20', '2026-05-04']);
		expect(result.visitedMonths).toEqual(['2026-05']);
	});

	it('sorts the returned dates newest-first', () => {
		const result = findMonthWithDates('2026-05', ['2026-05-04', '2026-05-28', '2026-05-15'], []);
		expect(result.dates).toEqual(['2026-05-28', '2026-05-15', '2026-05-04']);
	});

	it('walks backward past empty months until it finds dates', () => {
		const result = findMonthWithDates('2026-05', ['2026-03-10'], []);
		expect(result.monthWithDates).toBe('2026-03');
		expect(result.dates).toEqual(['2026-03-10']);
		expect(result.visitedMonths).toEqual(['2026-05', '2026-04', '2026-03']);
	});

	it('combines explicit and implicit dates', () => {
		const result = findMonthWithDates('2026-05', ['2026-05-04'], ['2026-05-09']);
		expect(result.dates).toEqual(['2026-05-09', '2026-05-04']);
	});

	it('crosses the year boundary when walking backward', () => {
		const result = findMonthWithDates('2026-01', ['2025-12-31'], []);
		expect(result.monthWithDates).toBe('2025-12');
		expect(result.visitedMonths).toEqual(['2026-01', '2025-12']);
	});

	it('returns no month when nothing is found within maxDepth', () => {
		const result = findMonthWithDates('2026-05', ['2020-01-01'], []);
		expect(result.monthWithDates).toBeNull();
		expect(result.dates).toEqual([]);
		// start month plus 12 previous months are all inspected
		expect(result.visitedMonths).toHaveLength(13);
	});

	it('respects a custom maxDepth', () => {
		const result = findMonthWithDates('2026-05', ['2026-01-01'], [], 2);
		expect(result.monthWithDates).toBeNull();
		expect(result.visitedMonths).toEqual(['2026-05', '2026-04', '2026-03']);
	});
});

describe('hasDatesBefore', () => {
	it('returns true when a date precedes the month', () => {
		expect(hasDatesBefore(['2026-04-30', '2026-06-01'], '2026-05')).toBe(true);
	});

	it('returns false when all dates are in or after the month', () => {
		expect(hasDatesBefore(['2026-05-01', '2026-07-15'], '2026-05')).toBe(false);
	});

	it('treats a date within the same month as not before it', () => {
		expect(hasDatesBefore(['2026-05-15'], '2026-05')).toBe(false);
	});

	it('returns false for an empty date set', () => {
		expect(hasDatesBefore([], '2026-05')).toBe(false);
	});
});

describe('computeHeaderControlsState', () => {
	it('shows only Go to date when there is no filter', () => {
		const state = computeHeaderControlsState(createFilter(), false);
		expect(state).toEqual({
			hasFilter: false,
			showClear: false,
			showPin: false,
			showGoToDate: true,
		});
	});

	it('shows clear (but not pin) for an unpinned date filter', () => {
		const filter = createFilter({ startDate: '2026-02-04', endDate: '2026-02-04' });
		const state = computeHeaderControlsState(filter, false);
		expect(state).toEqual({
			hasFilter: true,
			showClear: true,
			showPin: false,
			showGoToDate: false,
		});
	});

	it('shows both pin and clear for a pinned date filter', () => {
		const filter = createFilter({ startDate: '2026-02-04', endDate: '2026-02-04' });
		const state = computeHeaderControlsState(filter, true);
		expect(state).toEqual({
			hasFilter: true,
			showClear: true,
			showPin: true,
			showGoToDate: false,
		});
	});

	it('treats a related-file filter as an active filter', () => {
		const state = computeHeaderControlsState(createFilter({ relatedToFile: 'note.md' }), false);
		expect(state.hasFilter).toBe(true);
		expect(state.showClear).toBe(true);
		expect(state.showGoToDate).toBe(false);
	});

	it('does not treat a half-open date range as a filter', () => {
		const state = computeHeaderControlsState(createFilter({ startDate: '2026-02-04' }), false);
		expect(state.hasFilter).toBe(false);
		expect(state.showGoToDate).toBe(true);
	});

	it('can show the pin even when only pinned state is set (defensive)', () => {
		// pinned implies a filter in practice, but the helper is purely driven
		// by its inputs — showPin follows pinned regardless.
		const state = computeHeaderControlsState(createFilter(), true);
		expect(state.showPin).toBe(true);
	});
});
