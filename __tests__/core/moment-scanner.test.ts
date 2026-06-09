import {
	scanFileForMoments,
	isStandaloneMoment,
	parseStandaloneFilename,
} from '../../src/core/moment-scanner';

describe('isStandaloneMoment', () => {
	it('returns true for standard standalone filename', () => {
		expect(isStandaloneMoment('2026-02-04 - Call with Lawyer.md')).toBe(true);
	});

	it('returns true for filename with en-dash', () => {
		expect(isStandaloneMoment('2026-02-04 – Meeting notes.md')).toBe(true);
	});

	it('returns true for date-only filename', () => {
		expect(isStandaloneMoment('2026-02-04.md')).toBe(true);
	});

	it('returns true for space-separated title without a dash', () => {
		expect(isStandaloneMoment('2026-04-09 Title Here.md')).toBe(true);
	});

	it('returns false for regular filename', () => {
		expect(isStandaloneMoment('Meeting notes.md')).toBe(false);
	});

	it('returns false for filename with date in middle', () => {
		expect(isStandaloneMoment('Notes from 2026-02-04.md')).toBe(false);
	});

	it('returns false when text abuts the date with no separator', () => {
		expect(isStandaloneMoment('2026-02-04abc.md')).toBe(false);
	});

	it('returns false for non-md files', () => {
		expect(isStandaloneMoment('2026-02-04 - Notes.txt')).toBe(false);
	});

	it('works with custom pattern', () => {
		const pattern = /^(\d{4}-\d{2}-\d{2})_(.+)\.md$/;
		expect(isStandaloneMoment('2026-02-04_Notes.md', pattern)).toBe(true);
		expect(isStandaloneMoment('2026-02-04 - Notes.md', pattern)).toBe(false);
	});
});

describe('parseStandaloneFilename', () => {
	it('parses standard standalone filename', () => {
		const result = parseStandaloneFilename('2026-02-04 - Call with Lawyer.md');
		expect(result).toEqual({
			date: '2026-02-04',
			title: 'Call with Lawyer',
		});
	});

	it('parses filename with en-dash', () => {
		const result = parseStandaloneFilename('2026-02-04 – Meeting notes.md');
		expect(result).toEqual({
			date: '2026-02-04',
			title: 'Meeting notes',
		});
	});

	it('parses date-only filename', () => {
		const result = parseStandaloneFilename('2026-02-04.md');
		expect(result).toEqual({
			date: '2026-02-04',
			title: null,
		});
	});

	it('parses a space-separated title without a dash', () => {
		const result = parseStandaloneFilename('2026-04-09 Title Here.md');
		expect(result).toEqual({
			date: '2026-04-09',
			title: 'Title Here',
		});
	});

	it('returns null for non-matching filename', () => {
		expect(parseStandaloneFilename('Regular notes.md')).toBeNull();
	});
});

describe('scanFileForMoments', () => {
	it('finds inline moments with wiki-linked dates', () => {
		const content = `# Project

## Notes

### [[2026-02-04]] Call with Lawyer
Discussed contract terms.

### [[2026-02-03]] Initial meeting
First discussion.
`;
		const result = scanFileForMoments(content, 'project.md');

		expect(result).toHaveLength(2);
		expect(result[0]).toMatchObject({
			type: 'inline',
			date: '2026-02-04',
			title: 'Call with Lawyer',
			filePath: 'project.md',
			headingLevel: 3,
			headingLine: 4,
		});
		expect(result[1]).toMatchObject({
			type: 'inline',
			date: '2026-02-03',
			title: 'Initial meeting',
			filePath: 'project.md',
			headingLevel: 3,
			headingLine: 7,
		});
	});

	it('finds inline moments with plain dates at start', () => {
		const content = `## Notes

### 2026-02-04 Meeting
Some content.
`;
		const result = scanFileForMoments(content, 'file.md');

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			date: '2026-02-04',
			title: 'Meeting',
		});
	});

	it('finds inline moments with date in middle of heading', () => {
		const content = `### Meeting on [[2026-02-04]] morning
Notes here.
`;
		const result = scanFileForMoments(content, 'file.md');

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			date: '2026-02-04',
			title: 'Meeting on morning',
		});
	});

	it('returns empty array for file with no moments', () => {
		const content = `# Regular File

## Section
Just some content.
`;
		const result = scanFileForMoments(content, 'file.md');
		expect(result).toHaveLength(0);
	});

	it('handles empty content', () => {
		const result = scanFileForMoments('', 'file.md');
		expect(result).toHaveLength(0);
	});

	it('handles headings with no title', () => {
		const content = `### [[2026-02-04]]
Just a date marker.
`;
		const result = scanFileForMoments(content, 'file.md');

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			date: '2026-02-04',
			title: null,
		});
	});

	it('assigns firstSeen timestamp', () => {
		const content = `### [[2026-02-04]] Test
Content.
`;
		const before = Date.now();
		const result = scanFileForMoments(content, 'file.md');
		const after = Date.now();

		expect(result[0]?.firstSeen).toBeGreaterThanOrEqual(before);
		expect(result[0]?.firstSeen).toBeLessThanOrEqual(after);
	});

	it('handles different heading levels', () => {
		const content = `## [[2026-02-01]] H2 moment
Content.

#### [[2026-02-02]] H4 moment
More content.
`;
		const result = scanFileForMoments(content, 'file.md');

		expect(result).toHaveLength(2);
		expect(result[0]?.headingLevel).toBe(2);
		expect(result[1]?.headingLevel).toBe(4);
	});
});
