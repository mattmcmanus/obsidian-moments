import { App, Notice, TFile } from 'obsidian';
import type { MomentsSettings } from '../settings/settings';
import { MomentModal } from '../ui/moment-modal';
import { buildFilename, renderTemplate } from '../core/template-engine';
import type { TemplateVariables } from '../core/template-engine';

/**
 * Get the folder path for new notes based on Obsidian's settings.
 */
function getNewNoteFolderPath(app: App): string {
	// Access Obsidian's internal config for new file location
	// @ts-expect-error - accessing internal API
	const newFileLocation = app.vault.getConfig('newFileLocation');
	// @ts-expect-error - accessing internal API
	const newFileFolderPath = app.vault.getConfig('newFileFolderPath');

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
export async function createStandaloneMoment(
	app: App,
	settings: MomentsSettings
): Promise<void> {
	// Open the moment modal
	new MomentModal(app, {
		title: 'Create new moment note',
		dateFormat: settings.dateFormat,
		onSubmit: async (result) => {
			try {
				// Build template variables
				const templateVars: TemplateVariables = {
					date: result.date,
					title: result.title || null,
				};

				// Build filename
				const filename = buildFilename(templateVars, settings.filenameTemplate);

				// Get folder path
				const folderPath = getNewNoteFolderPath(app);
				const fullPath = folderPath ? `${folderPath}/${filename}` : filename;

				// Check if file already exists
				const existingFile = app.vault.getAbstractFileByPath(fullPath);
				if (existingFile) {
					new Notice(`File already exists: ${filename}`);
					// Open the existing file
					if (existingFile instanceof TFile) {
						await app.workspace.getLeaf().openFile(existingFile);
					}
					return;
				}

				// Build initial content
				let content = '';
				if (settings.noteTemplate) {
					content = renderTemplate(settings.noteTemplate, templateVars);
				}

				// Create the file
				const file = await app.vault.create(fullPath, content);

				// Open the new file
				await app.workspace.getLeaf().openFile(file);

				new Notice('Moment note created');
			} catch (error) {
				console.error('Failed to create moment note:', error);
				new Notice('Failed to create moment note');
			}
		},
	}).open();
}
