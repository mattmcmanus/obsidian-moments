import { filterFolderSuggestions } from '../../src/core/folder-helpers';

const folders = [
	{ path: '/' },
	{ path: 'Journal' },
	{ path: 'Journal/2026' },
	{ path: 'Work/Notes' },
	{ path: 'Archive' },
];

describe('filterFolderSuggestions', () => {
	it('returns all folders for an empty query', () => {
		expect(filterFolderSuggestions(folders, '')).toHaveLength(folders.length);
	});

	it('matches folders by case-insensitive substring', () => {
		const result = filterFolderSuggestions(folders, 'note');
		expect(result.map((f) => f.path)).toEqual(['Work/Notes']);
	});

	it('is case-insensitive on the folder path', () => {
		const result = filterFolderSuggestions(folders, 'WORK');
		expect(result.map((f) => f.path)).toEqual(['Work/Notes']);
	});

	it('orders prefix matches before other substring matches', () => {
		const result = filterFolderSuggestions(
			[{ path: 'Work/Journal' }, { path: 'Journal' }],
			'jour'
		);
		expect(result.map((f) => f.path)).toEqual(['Journal', 'Work/Journal']);
	});

	it('orders shorter paths first among equal-rank matches', () => {
		const result = filterFolderSuggestions(folders, 'journal');
		expect(result.map((f) => f.path)).toEqual(['Journal', 'Journal/2026']);
	});

	it('returns an empty array when nothing matches', () => {
		expect(filterFolderSuggestions(folders, 'zzz')).toEqual([]);
	});
});
