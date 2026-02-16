import {
	extractPartialLink,
	filterAndSortLinkSuggestions,
} from '../../src/core/note-link-helpers';

describe('extractPartialLink', () => {
	it('returns partial text after [[', () => {
		expect(extractPartialLink('some text [[meet')).toBe('meet');
	});

	it('returns null when no [[ present', () => {
		expect(extractPartialLink('no brackets here')).toBeNull();
	});

	it('returns null when [[ is already closed', () => {
		expect(extractPartialLink('text [[done]] more')).toBeNull();
	});

	it('returns empty string for bare [[', () => {
		expect(extractPartialLink('text [[')).toBe('');
	});

	it('uses the last unclosed [[', () => {
		expect(extractPartialLink('[[closed]] text [[open')).toBe('open');
	});

	it('returns lowercase partial', () => {
		expect(extractPartialLink('[[Meeting')).toBe('meeting');
	});

	it('returns null for single [', () => {
		expect(extractPartialLink('text [partial')).toBeNull();
	});

	it('handles [[ at start of string', () => {
		expect(extractPartialLink('[[foo')).toBe('foo');
	});
});

describe('filterAndSortLinkSuggestions', () => {
	const files = [
		{ basename: 'Meeting Notes' },
		{ basename: 'Daily Log' },
		{ basename: 'Team Meeting' },
		{ basename: 'meeting-agenda' },
	];

	it('filters files matching the partial', () => {
		const result = filterAndSortLinkSuggestions(files, 'meeting');
		expect(result).toHaveLength(3);
		expect(result.map((f) => f.basename)).toEqual(
			expect.arrayContaining(['Meeting Notes', 'Team Meeting', 'meeting-agenda'])
		);
	});

	it('sorts starts-with matches first', () => {
		const result = filterAndSortLinkSuggestions(files, 'meeting');
		// "Meeting Notes" and "meeting-agenda" start with "meeting", "Team Meeting" doesn't
		expect(result).toHaveLength(3);
		expect(result[0]!.basename.toLowerCase().startsWith('meeting')).toBe(true);
		expect(result[1]!.basename.toLowerCase().startsWith('meeting')).toBe(true);
		expect(result[2]!.basename).toBe('Team Meeting');
	});

	it('sorts alphabetically within same priority', () => {
		const result = filterAndSortLinkSuggestions(files, 'meeting');
		// starts-with group: "Meeting Notes" before "meeting-agenda" alphabetically
		const startsWithGroup = result.filter((f) =>
			f.basename.toLowerCase().startsWith('meeting')
		);
		expect(startsWithGroup).toHaveLength(2);
		expect(startsWithGroup[0]!.basename).toBe('Meeting Notes');
		expect(startsWithGroup[1]!.basename).toBe('meeting-agenda');
	});

	it('returns empty array when no matches', () => {
		const result = filterAndSortLinkSuggestions(files, 'xyz');
		expect(result).toHaveLength(0);
	});

	it('returns all files for empty partial', () => {
		const result = filterAndSortLinkSuggestions(files, '');
		expect(result).toHaveLength(files.length);
	});

	it('preserves original object references', () => {
		const result = filterAndSortLinkSuggestions(files, 'daily');
		expect(result[0]).toBe(files[1]);
	});
});
