import { getPreviousMonth, getDatesForMonth, groupMomentsByDate } from '../../src/core/timeline-helpers';
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
