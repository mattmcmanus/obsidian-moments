import {
	findSectionLine,
	findSectionEnd,
	insertAfterSection,
	insertAtSectionEnd,
	appendSection,
	insertHeading,
} from '../../src/core/section-helpers';
import type { InsertHeadingOptions } from '../../src/core/section-helpers';

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

describe('findSectionLine edge cases', () => {
	it('does not match partial heading text', () => {
		const content = '# Title\n\n## Notes and more\n\nSome content';
		expect(findSectionLine(content, '## Notes')).toBe(-1);
	});

	it('finds section between adjacent sections', () => {
		const content = '## First\n## Notes\n## Last';
		expect(findSectionLine(content, '## Notes')).toBe(1);
	});
});

describe('insertHeading', () => {
	const specifiedPrepend: InsertHeadingOptions = {
		targetSectionMode: 'specified',
		targetSection: '## Notes',
		insertPosition: 'prepend',
	};

	const specifiedAppend: InsertHeadingOptions = {
		targetSectionMode: 'specified',
		targetSection: '## Notes',
		insertPosition: 'append',
	};

	const noneMode: InsertHeadingOptions = {
		targetSectionMode: 'none',
		targetSection: '## Notes',
		insertPosition: 'prepend',
	};

	it('prepends heading after section heading', () => {
		const content = '# Title\n\n## Notes\n\nExisting';
		const result = insertHeading(content, specifiedPrepend, '### New');

		const lines = result.split('\n');
		expect(lines[2]).toBe('## Notes');
		expect(lines[3]).toBe('');
		expect(lines[4]).toBe('### New');
	});

	it('appends heading at section end', () => {
		const content = '## Notes\n\nExisting\n\n## Other';
		const result = insertHeading(content, specifiedAppend, '### New');

		const newIdx = result.indexOf('### New');
		const otherIdx = result.indexOf('## Other');
		expect(newIdx).toBeGreaterThan(0);
		expect(newIdx).toBeLessThan(otherIdx);
	});

	it('creates missing section when specified mode', () => {
		const content = '# Title\n\nSome content';
		const result = insertHeading(content, specifiedPrepend, '### New');

		expect(result).toContain('## Notes');
		expect(result).toContain('### New');
	});

	it('appends to end of file in none mode', () => {
		const content = '# Title\n\nSome content';
		const result = insertHeading(content, noneMode, '### New');

		expect(result).toBe('# Title\n\nSome content\n\n### New\n');
	});

	it('handles empty content in none mode', () => {
		const result = insertHeading('', noneMode, '### New');

		expect(result).toBe('\n\n### New\n');
	});

	it('handles empty content in specified mode', () => {
		const result = insertHeading('', specifiedPrepend, '### New');

		expect(result).toContain('## Notes');
		expect(result).toContain('### New');
	});
});
