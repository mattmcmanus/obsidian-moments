import {
	extractContentUnderHeading,
	findNextHeadingLine,
	getHeadingLevel,
} from '../../src/core/content-extractor';

describe('getHeadingLevel', () => {
	it('returns level for H2', () => {
		expect(getHeadingLevel('## Heading')).toBe(2);
	});

	it('returns level for H3', () => {
		expect(getHeadingLevel('### Heading')).toBe(3);
	});

	it('returns level for H6', () => {
		expect(getHeadingLevel('###### Heading')).toBe(6);
	});

	it('returns level for H1', () => {
		expect(getHeadingLevel('# Heading')).toBe(1);
	});

	it('returns null for non-heading', () => {
		expect(getHeadingLevel('Just text')).toBeNull();
		expect(getHeadingLevel('Not a # heading')).toBeNull();
		expect(getHeadingLevel('')).toBeNull();
	});

	it('handles heading with no space after #', () => {
		// Obsidian requires space after #, so this should not be a heading
		expect(getHeadingLevel('##NoSpace')).toBeNull();
	});
});

describe('findNextHeadingLine', () => {
	const lines = [
		'### [[2026-02-04]] First moment',  // 0
		'Some content here.',                 // 1
		'More content.',                      // 2
		'',                                   // 3
		'### [[2026-02-05]] Second moment',  // 4
		'Different content.',                 // 5
		'## Higher level',                    // 6
		'Under higher level.',                // 7
	];

	it('finds next heading of same level', () => {
		expect(findNextHeadingLine(lines, 0, 3)).toBe(4);
	});

	it('finds next heading of higher level', () => {
		expect(findNextHeadingLine(lines, 4, 3)).toBe(6);
	});

	it('returns -1 when no more headings', () => {
		expect(findNextHeadingLine(lines, 6, 2)).toBe(-1);
	});

	it('ignores headings of lower level', () => {
		const testLines = [
			'## Section',           // 0
			'Content',              // 1
			'#### Subsection',      // 2 - lower level, should be ignored
			'More content',         // 3
			'## Next Section',      // 4 - same level, should be found
		];
		expect(findNextHeadingLine(testLines, 0, 2)).toBe(4);
	});
});

describe('extractContentUnderHeading', () => {
	it('extracts content until next same-level heading', () => {
		const content = `### [[2026-02-04]] First moment
Some content here.
More content.

### [[2026-02-05]] Second moment
Different content.`;

		const result = extractContentUnderHeading(content, 0, 3);
		expect(result).toBe('Some content here.\nMore content.');
	});

	it('extracts content until higher-level heading', () => {
		const content = `### [[2026-02-04]] Moment
Content under moment.
More text.

## New Section
Different content.`;

		const result = extractContentUnderHeading(content, 0, 3);
		expect(result).toBe('Content under moment.\nMore text.');
	});

	it('extracts content to end of file when no next heading', () => {
		const content = `### [[2026-02-04]] Last moment
Final content here.
More final content.`;

		const result = extractContentUnderHeading(content, 0, 3);
		expect(result).toBe('Final content here.\nMore final content.');
	});

	it('includes lower-level headings in content', () => {
		const content = `### [[2026-02-04]] Moment
Content here.

#### Subsection
Subsection content.

### Next moment
Different.`;

		const result = extractContentUnderHeading(content, 0, 3);
		expect(result).toBe('Content here.\n\n#### Subsection\nSubsection content.');
	});

	it('handles empty content under heading', () => {
		const content = `### [[2026-02-04]] Empty moment

### [[2026-02-05]] Next moment
Has content.`;

		const result = extractContentUnderHeading(content, 0, 3);
		expect(result).toBe('');
	});

	it('handles heading at end of file', () => {
		const content = `### [[2026-02-04]] Final moment`;

		const result = extractContentUnderHeading(content, 0, 3);
		expect(result).toBe('');
	});

	it('trims trailing whitespace', () => {
		const content = `### [[2026-02-04]] Moment
Content here.


### Next
More.`;

		const result = extractContentUnderHeading(content, 0, 3);
		expect(result).toBe('Content here.');
	});

	it('handles Windows line endings', () => {
		const content = `### [[2026-02-04]] Moment\r\nContent here.\r\nMore content.\r\n\r\n### Next\r\nOther.`;

		const result = extractContentUnderHeading(content, 0, 3);
		expect(result).toBe('Content here.\nMore content.');
	});

	it('handles line number offset correctly', () => {
		const content = `# Title

## Section

### [[2026-02-04]] Moment
Content for this moment.

### [[2026-02-05]] Next
Other content.`;

		// Moment is at line 4 (0-indexed)
		const result = extractContentUnderHeading(content, 4, 3);
		expect(result).toBe('Content for this moment.');
	});
});
