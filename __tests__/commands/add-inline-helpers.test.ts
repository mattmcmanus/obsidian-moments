import {
	findSectionLine,
	findSectionEnd,
	insertAfterSection,
	insertAtSectionEnd,
	appendSection,
} from '../../src/core/section-helpers';

describe('findSectionLine', () => {
	it('finds a section heading by exact match', () => {
		const content = '# Title\n\n## Notes\n\nSome content';
		expect(findSectionLine(content, '## Notes')).toBe(2);
	});

	it('is case-insensitive', () => {
		const content = '# Title\n\n## notes\n\nSome content';
		expect(findSectionLine(content, '## Notes')).toBe(2);
	});

	it('ignores leading/trailing whitespace', () => {
		const content = '# Title\n\n  ## Notes  \n\nSome content';
		expect(findSectionLine(content, '## Notes')).toBe(2);
	});

	it('returns -1 if section not found', () => {
		const content = '# Title\n\nSome content';
		expect(findSectionLine(content, '## Notes')).toBe(-1);
	});

	it('returns -1 for empty content', () => {
		expect(findSectionLine('', '## Notes')).toBe(-1);
	});

	it('finds first occurrence when multiple matches exist', () => {
		const content = '## Notes\n\nFirst\n\n## Notes\n\nSecond';
		expect(findSectionLine(content, '## Notes')).toBe(0);
	});
});

describe('findSectionEnd', () => {
	it('finds end at next same-level heading', () => {
		const lines = ['## Notes', '', 'Content', '', '## Other'];
		expect(findSectionEnd(lines, 0)).toBe(4);
	});

	it('finds end at higher-level heading', () => {
		const lines = ['## Notes', '', 'Content', '', '# Top level'];
		expect(findSectionEnd(lines, 0)).toBe(4);
	});

	it('returns -1 if section goes to end of file', () => {
		const lines = ['## Notes', '', 'Content', '', 'More content'];
		expect(findSectionEnd(lines, 0)).toBe(-1);
	});

	it('ignores lower-level headings within section', () => {
		const lines = ['## Notes', '', '### Sub', '', 'Content', '', '## Other'];
		expect(findSectionEnd(lines, 0)).toBe(6);
	});

	it('returns -1 for invalid section line', () => {
		const lines = ['Regular text', '', 'Content'];
		expect(findSectionEnd(lines, 0)).toBe(-1);
	});
});

describe('insertAfterSection', () => {
	it('inserts content after section heading with blank line', () => {
		const content = '# Title\n\n## Notes\n\nExisting content';
		const result = insertAfterSection(content, 2, '### [[2026-02-04]] Meeting');

		const lines = result.split('\n');
		expect(lines[2]).toBe('## Notes');
		expect(lines[3]).toBe('');
		expect(lines[4]).toBe('### [[2026-02-04]] Meeting');
	});

	it('inserts at beginning of file when section is line 0', () => {
		const content = '## Notes\n\nExisting content';
		const result = insertAfterSection(content, 0, '### [[2026-02-04]] Meeting');

		expect(result).toContain('## Notes\n\n### [[2026-02-04]] Meeting');
	});
});

describe('insertAtSectionEnd', () => {
	it('inserts before the next section', () => {
		const content = '## Notes\n\nExisting content\n\n## Other';
		const result = insertAtSectionEnd(content, 0, '### [[2026-02-04]] Meeting');

		expect(result).toContain('### [[2026-02-04]] Meeting');
		expect(result).toContain('## Other');
		// New content should come before ## Other
		const meetingIdx = result.indexOf('### [[2026-02-04]] Meeting');
		const otherIdx = result.indexOf('## Other');
		expect(meetingIdx).toBeLessThan(otherIdx);
	});

	it('appends to end when section goes to end of file', () => {
		const content = '## Notes\n\nExisting content';
		const result = insertAtSectionEnd(content, 0, '### [[2026-02-04]] Meeting');

		expect(result).toContain('Existing content');
		expect(result).toContain('### [[2026-02-04]] Meeting');
		expect(result.endsWith('### [[2026-02-04]] Meeting')).toBe(true);
	});
});

describe('appendSection', () => {
	it('adds section to end of file with spacing', () => {
		const content = '# Title\n\nSome content';
		const result = appendSection(content, '## Notes');

		expect(result).toBe('# Title\n\nSome content\n\n## Notes\n');
	});

	it('trims trailing whitespace before appending', () => {
		const content = '# Title\n\nSome content\n\n\n';
		const result = appendSection(content, '## Notes');

		expect(result).toBe('# Title\n\nSome content\n\n## Notes\n');
	});

	it('works with empty content', () => {
		const result = appendSection('', '## Notes');

		expect(result).toBe('\n\n## Notes\n');
	});
});
