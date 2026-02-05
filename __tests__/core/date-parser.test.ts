import {
	formatDate,
	parseDate,
	isValidDateString,
	getTodayString,
	buildDatePattern,
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

describe('isValidDateString', () => {
	it('returns true for valid ISO date', () => {
		expect(isValidDateString('2026-02-04')).toBe(true);
	});

	it('returns true for valid date with custom format', () => {
		expect(isValidDateString('04/02/2026', 'DD/MM/YYYY')).toBe(true);
	});

	it('returns false for invalid date', () => {
		expect(isValidDateString('not-a-date')).toBe(false);
		expect(isValidDateString('2026-02-30')).toBe(false); // Invalid Feb date
	});

	it('returns false for empty string', () => {
		expect(isValidDateString('')).toBe(false);
	});
});

describe('getTodayString', () => {
	it('returns today date in ISO format', () => {
		const result = getTodayString();
		// Just check format, not exact value (would break on different days)
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('returns today date in custom format', () => {
		const result = getTodayString('DD/MM/YYYY');
		expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
	});
});

describe('buildDatePattern', () => {
	it('builds regex for ISO format', () => {
		const pattern = buildDatePattern('YYYY-MM-DD');
		expect(pattern.test('2026-02-04')).toBe(true);
		expect(pattern.test('26-02-04')).toBe(false);
	});

	it('builds regex for DD/MM/YYYY format', () => {
		const pattern = buildDatePattern('DD/MM/YYYY');
		expect(pattern.test('04/02/2026')).toBe(true);
		expect(pattern.test('2026-02-04')).toBe(false);
	});

	it('builds regex for MM-DD-YYYY format', () => {
		const pattern = buildDatePattern('MM-DD-YYYY');
		expect(pattern.test('02-04-2026')).toBe(true);
	});

	it('escapes special regex characters in separator', () => {
		const pattern = buildDatePattern('YYYY.MM.DD');
		expect(pattern.test('2026.02.04')).toBe(true);
		// The dot should be literal, not match any character
		expect(pattern.test('2026X02X04')).toBe(false);
	});
});
