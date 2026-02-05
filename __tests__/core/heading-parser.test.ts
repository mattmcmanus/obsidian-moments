import {
	parseHeadingForMoment,
	extractTitle,
	type ParsedMomentHeading,
} from '../../src/core/heading-parser';

describe('parseHeadingForMoment', () => {
	describe('wiki-linked dates', () => {
		it('extracts date and title from standard wiki-linked heading', () => {
			const result = parseHeadingForMoment('### [[2026-02-04]] Call with Lawyer');
			expect(result).toEqual({
				date: '2026-02-04',
				title: 'Call with Lawyer',
				level: 3,
			});
		});

		it('handles heading with no title (just date)', () => {
			const result = parseHeadingForMoment('### [[2026-02-04]]');
			expect(result).toEqual({
				date: '2026-02-04',
				title: null,
				level: 3,
			});
		});

		it('extracts date from middle of heading', () => {
			const result = parseHeadingForMoment('## Meeting on [[2026-02-04]] morning');
			expect(result).toEqual({
				date: '2026-02-04',
				title: 'Meeting on morning',
				level: 2,
			});
		});

		it('extracts date from end of heading', () => {
			const result = parseHeadingForMoment('### Weekly sync [[2026-02-04]]');
			expect(result).toEqual({
				date: '2026-02-04',
				title: 'Weekly sync',
				level: 3,
			});
		});

		it('handles different heading levels', () => {
			expect(parseHeadingForMoment('## [[2026-01-15]] H2 heading')?.level).toBe(2);
			expect(parseHeadingForMoment('#### [[2026-01-15]] H4 heading')?.level).toBe(4);
			expect(parseHeadingForMoment('##### [[2026-01-15]] H5 heading')?.level).toBe(5);
			expect(parseHeadingForMoment('###### [[2026-01-15]] H6 heading')?.level).toBe(6);
		});

		it('handles extra whitespace', () => {
			const result = parseHeadingForMoment('###   [[2026-02-04]]   Call with Lawyer  ');
			expect(result).toEqual({
				date: '2026-02-04',
				title: 'Call with Lawyer',
				level: 3,
			});
		});

		it('handles date with separator in title', () => {
			const result = parseHeadingForMoment('### [[2026-02-04]] - Call with Lawyer');
			expect(result).toEqual({
				date: '2026-02-04',
				title: '- Call with Lawyer',
				level: 3,
			});
		});
	});

	describe('plain dates (at start only)', () => {
		it('extracts date and title from plain date heading', () => {
			const result = parseHeadingForMoment('### 2026-02-04 Call with Lawyer');
			expect(result).toEqual({
				date: '2026-02-04',
				title: 'Call with Lawyer',
				level: 3,
			});
		});

		it('handles plain date with no title', () => {
			const result = parseHeadingForMoment('### 2026-02-04');
			expect(result).toEqual({
				date: '2026-02-04',
				title: null,
				level: 3,
			});
		});

		it('does NOT extract plain date from middle of heading', () => {
			// Plain dates only match at start, unlike wiki-links
			const result = parseHeadingForMoment('### Meeting on 2026-02-04 morning');
			expect(result).toBeNull();
		});

		it('handles plain date with separator', () => {
			const result = parseHeadingForMoment('### 2026-02-04 - Call with Lawyer');
			expect(result).toEqual({
				date: '2026-02-04',
				title: '- Call with Lawyer',
				level: 3,
			});
		});
	});

	describe('non-matching headings', () => {
		it('returns null for heading without date', () => {
			const result = parseHeadingForMoment('### Regular heading');
			expect(result).toBeNull();
		});

		it('returns null for heading with invalid date format', () => {
			const result = parseHeadingForMoment('### [[02-04-2026]] American format');
			expect(result).toBeNull();
		});

		it('returns null for heading with partial date', () => {
			const result = parseHeadingForMoment('### [[2026-02]] Just month');
			expect(result).toBeNull();
		});

		it('returns null for non-heading text', () => {
			const result = parseHeadingForMoment('Just some text with [[2026-02-04]]');
			expect(result).toBeNull();
		});

		it('returns null for H1 heading (typically used for titles)', () => {
			const result = parseHeadingForMoment('# [[2026-02-04]] Title');
			expect(result).toBeNull();
		});

		it('returns null for empty string', () => {
			const result = parseHeadingForMoment('');
			expect(result).toBeNull();
		});
	});

	describe('edge cases', () => {
		it('handles multiple wiki-links (uses first date)', () => {
			const result = parseHeadingForMoment('### [[2026-02-04]] to [[2026-02-10]] Trip');
			expect(result).toEqual({
				date: '2026-02-04',
				title: 'to [[2026-02-10]] Trip',
				level: 3,
			});
		});

		it('prefers wiki-link date over plain date', () => {
			const result = parseHeadingForMoment('### 2025-01-01 [[2026-02-04]] Mixed');
			// Should find the wiki-link date first
			expect(result?.date).toBe('2026-02-04');
		});

		it('handles heading with only whitespace after date', () => {
			const result = parseHeadingForMoment('### [[2026-02-04]]   ');
			expect(result).toEqual({
				date: '2026-02-04',
				title: null,
				level: 3,
			});
		});
	});
});

describe('extractTitle', () => {
	it('removes wiki-linked date and trims', () => {
		const result = extractTitle('[[2026-02-04]] Call with Lawyer', '[[2026-02-04]]');
		expect(result).toBe('Call with Lawyer');
	});

	it('returns null for empty result after removal', () => {
		const result = extractTitle('[[2026-02-04]]', '[[2026-02-04]]');
		expect(result).toBeNull();
	});

	it('handles date in middle of text', () => {
		const result = extractTitle('Meeting on [[2026-02-04]] morning', '[[2026-02-04]]');
		expect(result).toBe('Meeting on morning');
	});

	it('collapses multiple spaces after removal', () => {
		const result = extractTitle('[[2026-02-04]]   Call  with   Lawyer', '[[2026-02-04]]');
		expect(result).toBe('Call with Lawyer');
	});
});
