import {
	detectPeriodicNoteType,
	getDateRangeForPeriodicNote,
} from '../../src/core/periodic-detection';

describe('detectPeriodicNoteType', () => {
	describe('daily notes', () => {
		it('detects daily note from filename matching format', () => {
			const result = detectPeriodicNoteType('2026-02-04.md', 'daily/', 'YYYY-MM-DD');
			expect(result).toEqual({
				type: 'daily',
				date: '2026-02-04',
			});
		});

		it('detects daily note in folder', () => {
			const result = detectPeriodicNoteType('daily/2026-02-04.md', 'daily/', 'YYYY-MM-DD');
			expect(result).toEqual({
				type: 'daily',
				date: '2026-02-04',
			});
		});

		it('detects daily note with different format', () => {
			const result = detectPeriodicNoteType('04-02-2026.md', '', 'DD-MM-YYYY');
			expect(result).toEqual({
				type: 'daily',
				date: '2026-02-04',
			});
		});

		it('detects daily note with two-digit year format', () => {
			const result = detectPeriodicNoteType('26.05.20.md', '', 'YY.MM.DD');
			expect(result).toEqual({
				type: 'daily',
				date: '2026-05-20',
			});
		});

		it('returns null for non-daily note', () => {
			const result = detectPeriodicNoteType('random-note.md', 'daily/', 'YYYY-MM-DD');
			expect(result).toBeNull();
		});
	});

	describe('weekly notes', () => {
		it('detects weekly note from filename', () => {
			const result = detectPeriodicNoteType(
				'2026-W06.md',
				'weekly/',
				'YYYY-MM-DD'
			);
			expect(result).toEqual({
				type: 'weekly',
				date: '2026-W06',
			});
		});

		it('detects weekly note in folder', () => {
			const result = detectPeriodicNoteType(
				'weekly/2026-W06.md',
				'weekly/',
				'YYYY-MM-DD'
			);
			expect(result).toEqual({
				type: 'weekly',
				date: '2026-W06',
			});
		});
	});

	describe('monthly notes', () => {
		it('detects monthly note from filename', () => {
			const result = detectPeriodicNoteType('2026-02.md', 'monthly/', 'YYYY-MM-DD');
			expect(result).toEqual({
				type: 'monthly',
				date: '2026-02',
			});
		});
	});

	describe('yearly notes', () => {
		it('detects yearly note from filename', () => {
			const result = detectPeriodicNoteType('2026.md', 'yearly/', 'YYYY-MM-DD');
			expect(result).toEqual({
				type: 'yearly',
				date: '2026',
			});
		});
	});
});

describe('getDateRangeForPeriodicNote', () => {
	describe('daily range', () => {
		it('returns single day range', () => {
			const result = getDateRangeForPeriodicNote('daily', '2026-02-04');
			expect(result).toEqual({
				startDate: '2026-02-04',
				endDate: '2026-02-04',
			});
		});
	});

	describe('weekly range', () => {
		it('returns week range for ISO week', () => {
			// Week 6 of 2026 is Feb 2-8
			const result = getDateRangeForPeriodicNote('weekly', '2026-W06');
			expect(result).toEqual({
				startDate: '2026-02-02',
				endDate: '2026-02-08',
			});
		});

		it('returns week range for first week of year', () => {
			// Week 1 of 2026 starts Dec 29, 2025
			const result = getDateRangeForPeriodicNote('weekly', '2026-W01');
			expect(result).toEqual({
				startDate: '2025-12-29',
				endDate: '2026-01-04',
			});
		});
	});

	describe('monthly range', () => {
		it('returns month range', () => {
			const result = getDateRangeForPeriodicNote('monthly', '2026-02');
			expect(result).toEqual({
				startDate: '2026-02-01',
				endDate: '2026-02-28',
			});
		});

		it('handles leap year February', () => {
			const result = getDateRangeForPeriodicNote('monthly', '2024-02');
			expect(result).toEqual({
				startDate: '2024-02-01',
				endDate: '2024-02-29',
			});
		});

		it('handles 31-day months', () => {
			const result = getDateRangeForPeriodicNote('monthly', '2026-01');
			expect(result).toEqual({
				startDate: '2026-01-01',
				endDate: '2026-01-31',
			});
		});
	});

	describe('yearly range', () => {
		it('returns year range', () => {
			const result = getDateRangeForPeriodicNote('yearly', '2026');
			expect(result).toEqual({
				startDate: '2026-01-01',
				endDate: '2026-12-31',
			});
		});
	});

	describe('quarterly range', () => {
		it('returns Q1 range', () => {
			const result = getDateRangeForPeriodicNote('quarterly', '2026-Q1');
			expect(result).toEqual({
				startDate: '2026-01-01',
				endDate: '2026-03-31',
			});
		});

		it('returns Q2 range', () => {
			const result = getDateRangeForPeriodicNote('quarterly', '2026-Q2');
			expect(result).toEqual({
				startDate: '2026-04-01',
				endDate: '2026-06-30',
			});
		});

		it('returns Q3 range', () => {
			const result = getDateRangeForPeriodicNote('quarterly', '2026-Q3');
			expect(result).toEqual({
				startDate: '2026-07-01',
				endDate: '2026-09-30',
			});
		});

		it('returns Q4 range', () => {
			const result = getDateRangeForPeriodicNote('quarterly', '2026-Q4');
			expect(result).toEqual({
				startDate: '2026-10-01',
				endDate: '2026-12-31',
			});
		});
	});
});
