import {
	formatDate,
	parseDate,
} from '../../src/core/date-parser';

describe('formatDate', () => {
	it('formats date with default ISO format', () => {
		const date = new Date(2026, 1, 4); // Feb 4, 2026
		expect(formatDate(date)).toBe('2026-02-04');
	});

	it('formats date with custom format YYYY/MM/DD', () => {
		const date = new Date(2026, 1, 4);
		expect(formatDate(date, 'YYYY/MM/DD')).toBe('2026/02/04');
	});

	it('formats date with DD-MM-YYYY format', () => {
		const date = new Date(2026, 1, 4);
		expect(formatDate(date, 'DD-MM-YYYY')).toBe('04-02-2026');
	});

	it('formats date with MM-DD-YYYY format', () => {
		const date = new Date(2026, 1, 4);
		expect(formatDate(date, 'MM-DD-YYYY')).toBe('02-04-2026');
	});

	it('pads single digit months and days', () => {
		const date = new Date(2026, 0, 5); // Jan 5
		expect(formatDate(date)).toBe('2026-01-05');
	});

	it('handles December correctly', () => {
		const date = new Date(2026, 11, 25); // Dec 25
		expect(formatDate(date)).toBe('2026-12-25');
	});
});

describe('parseDate', () => {
	it('parses ISO format date string', () => {
		const result = parseDate('2026-02-04');
		expect(result).toBeInstanceOf(Date);
		expect(result?.getFullYear()).toBe(2026);
		expect(result?.getMonth()).toBe(1); // 0-indexed
		expect(result?.getDate()).toBe(4);
	});

	it('parses date with custom format YYYY/MM/DD', () => {
		const result = parseDate('2026/02/04', 'YYYY/MM/DD');
		expect(result?.getFullYear()).toBe(2026);
		expect(result?.getMonth()).toBe(1);
		expect(result?.getDate()).toBe(4);
	});

	it('parses date with DD-MM-YYYY format', () => {
		const result = parseDate('04-02-2026', 'DD-MM-YYYY');
		expect(result?.getFullYear()).toBe(2026);
		expect(result?.getMonth()).toBe(1);
		expect(result?.getDate()).toBe(4);
	});

	it('returns null for invalid date string', () => {
		expect(parseDate('not-a-date')).toBeNull();
		expect(parseDate('2026-13-01')).toBeNull(); // Invalid month
		expect(parseDate('2026-02-30')).toBeNull(); // Invalid day for Feb
	});

	it('returns null for empty string', () => {
		expect(parseDate('')).toBeNull();
	});

	it('returns null for mismatched format', () => {
		expect(parseDate('02-04-2026', 'YYYY-MM-DD')).toBeNull();
	});
});

describe('two-digit year (YY) format', () => {
	it('formats a date with YY.MM.DD format', () => {
		const date = new Date(2026, 4, 20); // May 20, 2026
		expect(formatDate(date, 'YY.MM.DD')).toBe('26.05.20');
	});

	it('parses a YY.MM.DD date string', () => {
		const result = parseDate('26.05.20', 'YY.MM.DD');
		expect(result?.getFullYear()).toBe(2026);
		expect(result?.getMonth()).toBe(4); // 0-indexed
		expect(result?.getDate()).toBe(20);
	});

	it('returns null for an invalid YY.MM.DD date', () => {
		expect(parseDate('26.13.20', 'YY.MM.DD')).toBeNull(); // Invalid month
	});
});
