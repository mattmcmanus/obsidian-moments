import type { App, TFile, CachedMetadata, HeadingCache, LinkCache, TagCache, EmbedCache } from 'obsidian';
import type { Moment } from '../../src/types';
import {
	getFileRelationInfo,
	findMomentEndLine,
	isMomentRelatedToFile,
	findRelatedMoments,
	isFileRelatedByLinks,
} from '../../src/core/related-detection';

// Helper to create a mock HeadingCache
function mockHeading(line: number, level: number, heading = ''): HeadingCache {
	return {
		heading,
		level,
		position: {
			start: { line, col: 0, offset: 0 },
			end: { line, col: 0, offset: 0 },
		},
	};
}

// Helper to create a mock LinkCache
function mockLink(line: number, link: string): LinkCache {
	return {
		link,
		original: `[[${link}]]`,
		position: {
			start: { line, col: 0, offset: 0 },
			end: { line, col: 0, offset: 0 },
		},
	};
}

// Helper to create a mock EmbedCache
function mockEmbed(line: number, link: string): EmbedCache {
	return {
		link,
		original: `![[${link}]]`,
		position: {
			start: { line, col: 0, offset: 0 },
			end: { line, col: 0, offset: 0 },
		},
	};
}

// Helper to create a mock TagCache
function mockTag(line: number, tag: string): TagCache {
	return {
		tag,
		position: {
			start: { line, col: 0, offset: 0 },
			end: { line, col: 0, offset: 0 },
		},
	};
}

// Helper to create a mock TFile
function mockFile(path: string, basename?: string): TFile {
	return {
		path,
		basename: basename ?? path.replace(/\.md$/, '').replace(/.*\//, ''),
		name: path.replace(/.*\//, ''),
		extension: 'md',
		stat: { ctime: 0, mtime: 0, size: 0 },
		vault: {} as TFile['vault'],
		parent: null,
	// eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- test mock
	} as TFile;
}

// Helper to create a mock App with configurable file caches
function mockApp(
	fileCaches: Record<string, CachedMetadata>,
	files?: TFile[],
	resolvedLinks?: Record<string, Record<string, number>>
): App {
	const fileMap = new Map<string, TFile>();
	for (const f of files ?? []) {
		fileMap.set(f.path, f);
	}

	return {
		metadataCache: {
			getFileCache: (file: TFile) => fileCaches[file.path] ?? null,
			getCache: (path: string) => fileCaches[path] ?? null,
			getFirstLinkpathDest: (linkPath: string, _sourcePath: string) => {
				// Simple resolution: find a file whose basename matches
				const clean = linkPath.split('#')[0]!.split('|')[0]!;
				for (const [path, file] of fileMap) {
					if (file.basename === clean || path === clean || path === clean + '.md') {
						return file;
					}
				}
				return null;
			},
			resolvedLinks: resolvedLinks ?? {},
		},
		vault: {
			getAbstractFileByPath: (path: string) => fileMap.get(path) ?? null,
		},
	} as unknown as App;
}

function createTestMoment(overrides: Partial<Moment> = {}): Moment {
	return {
		type: 'inline',
		date: '2026-02-04',
		title: 'Test moment',
		filePath: 'notes.md',
		headingLevel: 3,
		headingLine: 5,
		firstSeen: Date.now(),
		...overrides,
	};
}

describe('getFileRelationInfo', () => {
	it('extracts basename from file', () => {
		const file = mockFile('People/Rick.md', 'Rick');
		const app = mockApp({ 'People/Rick.md': {} });

		const info = getFileRelationInfo(app, file);
		expect(info.basename).toBe('Rick');
		expect(info.filePath).toBe('People/Rick.md');
		expect(info.aliases).toEqual([]);
	});

	it('extracts array aliases from frontmatter', () => {
		const file = mockFile('Projects.md', 'Projects');
		const app = mockApp({
			'Projects.md': {
				frontmatter: { aliases: ['projects', 'Project List'] } as CachedMetadata['frontmatter'],
			},
		});

		const info = getFileRelationInfo(app, file);
		expect(info.aliases).toEqual(['projects', 'project list']);
	});

	it('extracts single string alias from frontmatter', () => {
		const file = mockFile('Note.md', 'Note');
		const app = mockApp({
			'Note.md': {
				frontmatter: { aliases: 'my-alias' } as CachedMetadata['frontmatter'],
			},
		});

		const info = getFileRelationInfo(app, file);
		expect(info.aliases).toEqual(['my-alias']);
	});

	it('handles alias key (singular)', () => {
		const file = mockFile('Note.md', 'Note');
		const app = mockApp({
			'Note.md': {
				frontmatter: { alias: 'single' } as CachedMetadata['frontmatter'],
			},
		});

		const info = getFileRelationInfo(app, file);
		expect(info.aliases).toEqual(['single']);
	});

	it('handles missing frontmatter', () => {
		const file = mockFile('Note.md', 'Note');
		const app = mockApp({ 'Note.md': {} });

		const info = getFileRelationInfo(app, file);
		expect(info.aliases).toEqual([]);
	});

	it('handles null cache', () => {
		const file = mockFile('Note.md', 'Note');
		const app = mockApp({});

		const info = getFileRelationInfo(app, file);
		expect(info.aliases).toEqual([]);
	});

	it('skips empty and non-string aliases', () => {
		const file = mockFile('Note.md', 'Note');
		const app = mockApp({
			'Note.md': {
				frontmatter: { aliases: ['valid', '', '  ', 42, null] } as CachedMetadata['frontmatter'],
			},
		});

		const info = getFileRelationInfo(app, file);
		expect(info.aliases).toEqual(['valid']);
	});
});

describe('findMomentEndLine', () => {
	it('returns next heading at same level', () => {
		const headings = [
			mockHeading(5, 3),
			mockHeading(15, 3),
			mockHeading(25, 3),
		];

		expect(findMomentEndLine(headings, 5, 3, 100)).toBe(15);
	});

	it('returns next heading at higher level (lower number)', () => {
		const headings = [
			mockHeading(5, 3),
			mockHeading(10, 4), // sub-heading, doesn't end section
			mockHeading(15, 2), // parent heading, ends section
		];

		expect(findMomentEndLine(headings, 5, 3, 100)).toBe(15);
	});

	it('skips sub-headings (lower level, higher number)', () => {
		const headings = [
			mockHeading(5, 3),
			mockHeading(8, 4),
			mockHeading(12, 5),
			mockHeading(20, 3),
		];

		expect(findMomentEndLine(headings, 5, 3, 100)).toBe(20);
	});

	it('returns totalLines when no ending heading found', () => {
		const headings = [
			mockHeading(5, 3),
			mockHeading(10, 4),
		];

		expect(findMomentEndLine(headings, 5, 3, 50)).toBe(50);
	});

	it('handles empty headings array', () => {
		expect(findMomentEndLine([], 5, 3, 100)).toBe(100);
	});

	it('handles heading at level 2', () => {
		const headings = [
			mockHeading(0, 2),
			mockHeading(10, 2),
		];

		expect(findMomentEndLine(headings, 0, 2, 50)).toBe(10);
	});
});

describe('isMomentRelatedToFile', () => {
	it('detects link to target in inline moment section', () => {
		const targetFile = mockFile('People/Rick.md', 'Rick');
		const momentFile = mockFile('notes.md', 'notes');

		const app = mockApp(
			{
				'notes.md': {
					headings: [mockHeading(5, 3), mockHeading(20, 3)],
					links: [mockLink(10, 'Rick')],
					sections: [{ position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 30, col: 0, offset: 0 } } }],
				} as unknown as CachedMetadata,
			},
			[targetFile, momentFile]
		);

		const moment = createTestMoment({ filePath: 'notes.md', headingLine: 5, headingLevel: 3 });
		const info = getFileRelationInfo(app, targetFile);

		expect(isMomentRelatedToFile(app, moment, info)).toBe(true);
	});

	it('detects link on the heading line itself', () => {
		const targetFile = mockFile('People/Rick.md', 'Rick');
		const momentFile = mockFile('notes.md', 'notes');

		const app = mockApp(
			{
				'notes.md': {
					headings: [mockHeading(5, 3), mockHeading(20, 3)],
					links: [mockLink(5, 'Rick')], // Link on the same line as the heading
					sections: [{ position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 30, col: 0, offset: 0 } } }],
				} as unknown as CachedMetadata,
			},
			[targetFile, momentFile]
		);

		const moment = createTestMoment({ filePath: 'notes.md', headingLine: 5, headingLevel: 3 });
		const info = getFileRelationInfo(app, targetFile);

		expect(isMomentRelatedToFile(app, moment, info)).toBe(true);
	});

	it('detects tag on the heading line itself', () => {
		const targetFile = mockFile('Projects.md', 'Projects');
		const momentFile = mockFile('notes.md', 'notes');

		const app = mockApp(
			{
				'notes.md': {
					headings: [mockHeading(5, 3), mockHeading(20, 3)],
					tags: [mockTag(5, '#projects')], // Tag on the same line as the heading
					sections: [{ position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 30, col: 0, offset: 0 } } }],
				} as unknown as CachedMetadata,
				'Projects.md': {},
			},
			[targetFile, momentFile]
		);

		const moment = createTestMoment({ filePath: 'notes.md', headingLine: 5, headingLevel: 3 });
		const info = getFileRelationInfo(app, targetFile);

		expect(isMomentRelatedToFile(app, moment, info)).toBe(true);
	});

	it('ignores link outside moment section', () => {
		const targetFile = mockFile('People/Rick.md', 'Rick');
		const momentFile = mockFile('notes.md', 'notes');

		const app = mockApp(
			{
				'notes.md': {
					headings: [mockHeading(5, 3), mockHeading(20, 3)],
					links: [mockLink(25, 'Rick')], // After the section ends at line 20
					sections: [{ position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 30, col: 0, offset: 0 } } }],
				} as unknown as CachedMetadata,
			},
			[targetFile, momentFile]
		);

		const moment = createTestMoment({ filePath: 'notes.md', headingLine: 5, headingLevel: 3 });
		const info = getFileRelationInfo(app, targetFile);

		expect(isMomentRelatedToFile(app, moment, info)).toBe(false);
	});

	it('detects tag matching basename in inline moment section', () => {
		const targetFile = mockFile('Projects.md', 'Projects');
		const momentFile = mockFile('notes.md', 'notes');

		const app = mockApp(
			{
				'notes.md': {
					headings: [mockHeading(5, 3), mockHeading(20, 3)],
					tags: [mockTag(10, '#projects')],
					sections: [{ position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 30, col: 0, offset: 0 } } }],
				} as unknown as CachedMetadata,
				'Projects.md': {},
			},
			[targetFile, momentFile]
		);

		const moment = createTestMoment({ filePath: 'notes.md', headingLine: 5, headingLevel: 3 });
		const info = getFileRelationInfo(app, targetFile);

		expect(isMomentRelatedToFile(app, moment, info)).toBe(true);
	});

	it('detects tag matching alias in inline moment section', () => {
		const targetFile = mockFile('Projects.md', 'Projects');
		const momentFile = mockFile('notes.md', 'notes');

		const app = mockApp(
			{
				'notes.md': {
					headings: [mockHeading(5, 3), mockHeading(20, 3)],
					tags: [mockTag(10, '#proj')],
					sections: [{ position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 30, col: 0, offset: 0 } } }],
				} as unknown as CachedMetadata,
				'Projects.md': {
					frontmatter: { aliases: ['proj'] } as CachedMetadata['frontmatter'],
				},
			},
			[targetFile, momentFile]
		);

		const moment = createTestMoment({ filePath: 'notes.md', headingLine: 5, headingLevel: 3 });
		const info = getFileRelationInfo(app, targetFile);

		expect(isMomentRelatedToFile(app, moment, info)).toBe(true);
	});

	it('checks entire file for standalone moments', () => {
		const targetFile = mockFile('People/Rick.md', 'Rick');
		const momentFile = mockFile('2026-02-04 - Meeting.md', '2026-02-04 - Meeting');

		const app = mockApp(
			{
				'2026-02-04 - Meeting.md': {
					links: [mockLink(5, 'Rick')],
				} as unknown as CachedMetadata,
			},
			[targetFile, momentFile]
		);

		const moment = createTestMoment({
			type: 'standalone',
			filePath: '2026-02-04 - Meeting.md',
			headingLine: undefined,
			headingLevel: undefined,
		});
		const info = getFileRelationInfo(app, targetFile);

		expect(isMomentRelatedToFile(app, moment, info)).toBe(true);
	});

	it('returns false when moment file has no cache', () => {
		const targetFile = mockFile('People/Rick.md', 'Rick');
		const momentFile = mockFile('notes.md', 'notes');

		const app = mockApp({}, [targetFile, momentFile]);

		const moment = createTestMoment({ filePath: 'notes.md' });
		const info = getFileRelationInfo(app, targetFile);

		expect(isMomentRelatedToFile(app, moment, info)).toBe(false);
	});

	it('returns false when moment file not found in vault', () => {
		const targetFile = mockFile('People/Rick.md', 'Rick');

		const app = mockApp({}, [targetFile]);

		const moment = createTestMoment({ filePath: 'nonexistent.md' });
		const info = getFileRelationInfo(app, targetFile);

		expect(isMomentRelatedToFile(app, moment, info)).toBe(false);
	});

	it('returns false for inline moment without heading info', () => {
		const targetFile = mockFile('People/Rick.md', 'Rick');
		const momentFile = mockFile('notes.md', 'notes');

		const app = mockApp(
			{
				'notes.md': {
					links: [mockLink(10, 'Rick')],
				} as unknown as CachedMetadata,
			},
			[targetFile, momentFile]
		);

		const moment = createTestMoment({
			filePath: 'notes.md',
			headingLine: undefined,
			headingLevel: undefined,
		});
		const info = getFileRelationInfo(app, targetFile);

		expect(isMomentRelatedToFile(app, moment, info)).toBe(false);
	});

	it('detects embed link to target file', () => {
		const targetFile = mockFile('People/Rick.md', 'Rick');
		const momentFile = mockFile('2026-02-04 - Notes.md', '2026-02-04 - Notes');

		const app = mockApp(
			{
				'2026-02-04 - Notes.md': {
					embeds: [mockEmbed(5, 'Rick')],
				} as unknown as CachedMetadata,
			},
			[targetFile, momentFile]
		);

		const moment = createTestMoment({
			type: 'standalone',
			filePath: '2026-02-04 - Notes.md',
			headingLine: undefined,
			headingLevel: undefined,
		});
		const info = getFileRelationInfo(app, targetFile);

		expect(isMomentRelatedToFile(app, moment, info)).toBe(true);
	});

	it('handles link with heading reference', () => {
		const targetFile = mockFile('People/Rick.md', 'Rick');
		const momentFile = mockFile('2026-02-04.md', '2026-02-04');

		const app = mockApp(
			{
				'2026-02-04.md': {
					links: [mockLink(3, 'Rick#section')],
				} as unknown as CachedMetadata,
			},
			[targetFile, momentFile]
		);

		const moment = createTestMoment({
			type: 'standalone',
			filePath: '2026-02-04.md',
			headingLine: undefined,
			headingLevel: undefined,
		});
		const info = getFileRelationInfo(app, targetFile);

		expect(isMomentRelatedToFile(app, moment, info)).toBe(true);
	});
});

describe('findRelatedMoments', () => {
	it('filters to moments related to target file', () => {
		const targetFile = mockFile('People/Rick.md', 'Rick');
		const momentFile1 = mockFile('journal.md', 'journal');
		const momentFile2 = mockFile('other.md', 'other');

		const app = mockApp(
			{
				'journal.md': {
					headings: [mockHeading(5, 3), mockHeading(20, 3)],
					links: [mockLink(10, 'Rick')],
					sections: [{ position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 30, col: 0, offset: 0 } } }],
				} as unknown as CachedMetadata,
				'other.md': {
					headings: [mockHeading(5, 3)],
					sections: [{ position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 30, col: 0, offset: 0 } } }],
				} as unknown as CachedMetadata,
				'People/Rick.md': {},
			},
			[targetFile, momentFile1, momentFile2]
		);

		const moments = [
			createTestMoment({ filePath: 'journal.md', headingLine: 5, headingLevel: 3 }),
			createTestMoment({ filePath: 'other.md', headingLine: 5, headingLevel: 3 }),
		];

		const result = findRelatedMoments(app, moments, targetFile);
		expect(result).toHaveLength(1);
		expect(result[0]!.filePath).toBe('journal.md');
	});

	it('excludes moments from the target file itself', () => {
		const targetFile = mockFile('People/Rick.md', 'Rick');

		const app = mockApp(
			{
				'People/Rick.md': {
					headings: [mockHeading(5, 3)],
					links: [mockLink(10, 'Rick')],
					sections: [{ position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 30, col: 0, offset: 0 } } }],
				} as unknown as CachedMetadata,
			},
			[targetFile]
		);

		const moments = [
			createTestMoment({ filePath: 'People/Rick.md', headingLine: 5, headingLevel: 3 }),
		];

		const result = findRelatedMoments(app, moments, targetFile);
		expect(result).toHaveLength(0);
	});

	it('returns empty array when no moments are related', () => {
		const targetFile = mockFile('People/Rick.md', 'Rick');
		const momentFile = mockFile('other.md', 'other');

		const app = mockApp(
			{
				'other.md': {
					headings: [mockHeading(5, 3)],
					sections: [{ position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 30, col: 0, offset: 0 } } }],
				} as unknown as CachedMetadata,
				'People/Rick.md': {},
			},
			[targetFile, momentFile]
		);

		const moments = [
			createTestMoment({ filePath: 'other.md', headingLine: 5, headingLevel: 3 }),
		];

		const result = findRelatedMoments(app, moments, targetFile);
		expect(result).toHaveLength(0);
	});

	it('handles empty moments array', () => {
		const targetFile = mockFile('People/Rick.md', 'Rick');
		const app = mockApp({ 'People/Rick.md': {} }, [targetFile]);

		const result = findRelatedMoments(app, [], targetFile);
		expect(result).toHaveLength(0);
	});

	it('handles mixed standalone and inline moments', () => {
		const targetFile = mockFile('People/Rick.md', 'Rick');
		const inlineFile = mockFile('journal.md', 'journal');
		const standaloneFile = mockFile('2026-02-04 - Meeting.md', '2026-02-04 - Meeting');

		const app = mockApp(
			{
				'journal.md': {
					headings: [mockHeading(5, 3), mockHeading(20, 3)],
					links: [mockLink(10, 'Rick')],
					sections: [{ position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 30, col: 0, offset: 0 } } }],
				} as unknown as CachedMetadata,
				'2026-02-04 - Meeting.md': {
					tags: [mockTag(3, '#Rick')],
				} as unknown as CachedMetadata,
				'People/Rick.md': {},
			},
			[targetFile, inlineFile, standaloneFile]
		);

		const moments = [
			createTestMoment({ filePath: 'journal.md', headingLine: 5, headingLevel: 3 }),
			createTestMoment({
				type: 'standalone',
				filePath: '2026-02-04 - Meeting.md',
				headingLine: undefined,
				headingLevel: undefined,
			}),
		];

		const result = findRelatedMoments(app, moments, targetFile);
		expect(result).toHaveLength(2);
	});
});

describe('isFileRelatedByLinks', () => {
	it('detects forward link (file links to target)', () => {
		const app = mockApp({}, [], {
			'journal.md': { 'People/Rick.md': 1 },
		});

		expect(isFileRelatedByLinks(app, 'journal.md', 'People/Rick.md')).toBe(true);
	});

	it('detects backward link (target links to file)', () => {
		const app = mockApp({}, [], {
			'People/Rick.md': { 'journal.md': 2 },
		});

		expect(isFileRelatedByLinks(app, 'journal.md', 'People/Rick.md')).toBe(true);
	});

	it('returns false when no links exist between files', () => {
		const app = mockApp({}, [], {
			'journal.md': { 'other.md': 1 },
			'People/Rick.md': { 'other.md': 1 },
		});

		expect(isFileRelatedByLinks(app, 'journal.md', 'People/Rick.md')).toBe(false);
	});

	it('returns false when file has no resolved links', () => {
		const app = mockApp({}, [], {});

		expect(isFileRelatedByLinks(app, 'journal.md', 'People/Rick.md')).toBe(false);
	});

	it('detects bidirectional links', () => {
		const app = mockApp({}, [], {
			'journal.md': { 'People/Rick.md': 1 },
			'People/Rick.md': { 'journal.md': 1 },
		});

		expect(isFileRelatedByLinks(app, 'journal.md', 'People/Rick.md')).toBe(true);
	});
});
