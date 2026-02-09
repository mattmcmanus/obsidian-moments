import { App, MarkdownView, TFile, Notice } from 'obsidian';
import type { MomentsSettings } from '../settings/settings';
import { MomentModal } from '../ui/moment-modal';
import { FileSuggesterModal } from '../ui/file-suggester';
import { buildHeadingString } from '../core/template-engine';
import type { TemplateVariables } from '../core/template-engine';
import {
	findSectionLine,
	insertAfterSection,
	insertAtSectionEnd,
	appendSection,
} from '../core/section-helpers';

/**
 * Execute the add inline moment command.
 */
export async function addInlineMoment(
	app: App,
	settings: MomentsSettings
): Promise<void> {
	// Get active file or prompt for one
	let file: TFile | null = app.workspace.getActiveFile();

	if (!file) {
		// No active file - prompt user to select one
		return new Promise((resolve) => {
			new FileSuggesterModal(app, (selectedFile) => {
				void addMomentToFile(app, settings, selectedFile).then(resolve);
			}).open();
		});
	}

	await addMomentToFile(app, settings, file);
}

/**
 * Add a moment to a specific file.
 */
async function addMomentToFile(
	app: App,
	settings: MomentsSettings,
	file: TFile
): Promise<void> {
	// Open the moment modal
	new MomentModal(app, {
		title: 'Insert moment',
		dateFormat: settings.dateFormat,
		onSubmit: async (result) => {
			try {
				// Read file content
				let content = await app.vault.read(file);

				// Build the heading
				const templateVars: TemplateVariables = {
					date: result.date,
					title: result.title || null,
				};

				const heading = buildHeadingString(
					templateVars,
					settings.headingLevel,
					settings.headingTemplate,
					settings.dateLinkStyle === 'wikilink'
				);

				// Determine where to insert
				if (settings.targetSectionMode === 'specified') {
					let sectionLine = findSectionLine(content, settings.targetSection);

					// Create section if it doesn't exist
					if (sectionLine === -1) {
						content = appendSection(content, settings.targetSection);
						sectionLine = content.split('\n').length - 2; // Account for the newline
					}

					// Insert based on position preference
					if (settings.insertPosition === 'prepend') {
						content = insertAfterSection(content, sectionLine, heading);
					} else {
						content = insertAtSectionEnd(content, sectionLine, heading);
					}
				} else {
					// No target section - append to end of file
					const trimmed = content.trimEnd();
					content = `${trimmed}\n\n${heading}\n`;
				}

				// Write the file
				await app.vault.modify(file, content);

				// Open the file and position cursor
				const leaf = app.workspace.getLeaf();
				await leaf.openFile(file);

				// Find the line number of the new heading
				const lines = content.split('\n');
				const headingLine = lines.findIndex((line) => line === heading);

				// Position cursor after the new heading with a small delay
				// to ensure the editor has updated
				if (headingLine !== -1) {
					setTimeout(() => {
						const view = app.workspace.getActiveViewOfType(MarkdownView);
						if (view?.editor) {
							const cursorLine = headingLine + 1;
							view.editor.setCursor({ line: cursorLine, ch: 0 });
							view.editor.scrollIntoView(
								{
									from: { line: cursorLine, ch: 0 },
									to: { line: cursorLine, ch: 0 },
								},
								true
							);
							// Focus the editor
							view.editor.focus();
						}
					}, 50);
				}

				new Notice('Moment created');
			} catch (error) {
				console.error('Failed to create moment:', error);
				new Notice('Failed to create moment');
			}
		},
	}).open();
}
