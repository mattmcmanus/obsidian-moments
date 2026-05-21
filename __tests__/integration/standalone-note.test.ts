import { createStandaloneNote } from '../../src/commands/standalone-note';
import { createFakeApp } from '../helpers/fake-app';
import { DEFAULT_SETTINGS } from '../../src/settings/settings';
import type { MomentsSettings } from '../../src/settings/settings';

function settings(overrides: Partial<MomentsSettings> = {}): MomentsSettings {
	return { ...DEFAULT_SETTINGS, ...overrides };
}

const result = { title: 'Test', date: '2026-05-21', folder: 'Journal' };

describe('createStandaloneNote', () => {
	it('creates the note inside the given folder', async () => {
		const { app, createdFiles } = createFakeApp({
			existingFolders: ['Journal'],
		});

		const out = await createStandaloneNote(app, settings(), result);

		expect(out.existed).toBe(false);
		expect(createdFiles.map((f) => f.path)).toEqual([
			'Journal/2026-05-21 - Test.md',
		]);
	});

	it('creates the note at the vault root when folder is empty', async () => {
		const { app, createdFiles } = createFakeApp();

		await createStandaloneNote(app, settings(), { ...result, folder: '' });

		expect(createdFiles.map((f) => f.path)).toEqual(['2026-05-21 - Test.md']);
	});

	it('auto-creates the folder when it does not exist', async () => {
		const { app, createdFolders } = createFakeApp();

		await createStandaloneNote(app, settings(), {
			...result,
			folder: 'New/Sub',
		});

		expect(createdFolders).toContain('New/Sub');
	});

	it('does not create a folder that already exists', async () => {
		const { app, createdFolders } = createFakeApp({
			existingFolders: ['Journal'],
		});

		await createStandaloneNote(app, settings(), result);

		expect(createdFolders).toEqual([]);
	});

	it('returns the existing file without creating a duplicate', async () => {
		const { app, createdFiles } = createFakeApp({
			existingFiles: ['Journal/2026-05-21 - Test.md'],
			existingFolders: ['Journal'],
		});

		const out = await createStandaloneNote(app, settings(), result);

		expect(out.existed).toBe(true);
		expect(out.file.path).toBe('Journal/2026-05-21 - Test.md');
		expect(createdFiles).toEqual([]);
	});

	it('renders note content from the noteTemplate setting', async () => {
		const { app, createdFiles } = createFakeApp({
			existingFolders: ['Journal'],
		});

		await createStandaloneNote(
			app,
			settings({ noteTemplate: 'Logged on {{date}}' }),
			result
		);

		expect(createdFiles.map((f) => f.content)).toEqual([
			'Logged on 2026-05-21',
		]);
	});

	it('creates an empty note when noteTemplate is blank', async () => {
		const { app, createdFiles } = createFakeApp({
			existingFolders: ['Journal'],
		});

		await createStandaloneNote(app, settings(), result);

		expect(createdFiles.map((f) => f.content)).toEqual(['']);
	});
});
