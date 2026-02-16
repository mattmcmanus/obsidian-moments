import { App, Notice, normalizePath } from 'obsidian';
import type { MomentsSettings } from '../settings/settings';
import { MomentModal } from '../ui/moment-modal';
import { buildFilename, renderTemplate } from '../core/template-engine';
import type { TemplateVariables } from '../core/template-engine';
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
	const newFileLocation = vault.getConfig('newFileLocation') as string | undefined;
	const newFileFolderPath = vault.getConfig('newFileFolderPath') as string | undefined;

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
				const fullPath = normalizePath(folderPath ? `${folderPath}/${filename}` : filename);

				// Check if file already exists
				const existingFile = app.vault.getFileByPath(fullPath);
				if (existingFile) {
					new Notice(`File already exists: ${filename}`);
					await app.workspace.getLeaf().openFile(existingFile);
					return;
				}

				// Build initial content from plugin settings (if no template will be applied)
				let content = '';
				if (settings.noteTemplate) {
					content = renderTemplate(settings.noteTemplate, templateVars);
				}

				// Create the file
				const file = await app.vault.create(fullPath, content);

				// Open the new file
				await app.workspace.getLeaf().openFile(file);

				// If templates are available, offer to apply one
				if (hasTemplatesAvailable(app)) {
					new TemplateSuggesterModal(app, (templateFile) => {
						if (templateFile) {
							void applyTemplate(app, file, templateFile)
								.then(() => {
									new Notice('Moment note created with template');
								})
								.catch((error: unknown) => {
									console.error('Moments: Failed to apply template:', error);
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
