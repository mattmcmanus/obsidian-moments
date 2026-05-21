import { App, Notice } from 'obsidian';
import type { MomentsSettings } from '../settings/settings';
import { MomentModal } from '../ui/moment-modal';
import { createStandaloneNote } from './standalone-note';
import {
	hasTemplatesAvailable,
	TemplateSuggesterModal,
	applyTemplate,
} from '../ui/template-suggester';

/**
 * Get the folder path for new notes based on Obsidian's settings.
 */
function getNewNoteFolderPath(app: App): string {
	// Access Obsidian's internal config for new file location
	const vault = app.vault as App['vault'] & {
		getConfig(key: string): unknown;
	};
	const newFileLocation = vault.getConfig('newFileLocation') as
		| string
		| undefined;
	const newFileFolderPath = vault.getConfig('newFileFolderPath') as
		| string
		| undefined;

	if (newFileLocation === 'folder' && newFileFolderPath) {
		return newFileFolderPath;
	}

	if (newFileLocation === 'current') {
		const activeFile = app.workspace.getActiveFile();
		if (activeFile) {
			return activeFile.parent?.path || '';
		}
	}

	// Default: vault root
	return '';
}

/**
 * Execute the create standalone moment command.
 */
export function createStandaloneMoment(
	app: App,
	settings: MomentsSettings
): void {
	const defaultFolder =
		settings.standaloneFolder || getNewNoteFolderPath(app);

	new MomentModal(app, {
		title: 'Create new moment note',
		dateFormat: settings.dateFormat,
		folderField: { defaultValue: defaultFolder },
		onSubmit: async (result) => {
			try {
				const { file, existed } = await createStandaloneNote(
					app,
					settings,
					{
						title: result.title,
						date: result.date,
						folder: result.folder || defaultFolder,
					}
				);

				await app.workspace.getLeaf().openFile(file);

				if (existed) {
					new Notice(`File already exists: ${file.name}`);
					return;
				}

				if (hasTemplatesAvailable(app)) {
					new TemplateSuggesterModal(app, (templateFile) => {
						if (templateFile) {
							void applyTemplate(app, file, templateFile)
								.then(() => {
									new Notice('Moment note created with template');
								})
								.catch((error: unknown) => {
									console.error(
										'Moments: Failed to apply template:',
										error
									);
									new Notice('Failed to apply template');
								});
						} else {
							new Notice('Moment note created');
						}
					}).open();
				} else {
					new Notice('Moment note created');
				}
			} catch (error) {
				console.error('Moments: Failed to create moment note:', error);
				new Notice('Failed to create moment note');
			}
		},
	}).open();
}
