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
export function addInlineMoment(
	app: App,
	settings: MomentsSettings
): void {
	// Get active file or prompt for one
	const file: TFile | null = app.workspace.getActiveFile();

	if (!file) {
		// No active file - prompt user to select one
		new FileSuggesterModal(app, (selectedFile) => {
			addMomentToFile(app, settings, selectedFile);
		}).open();
		return;
	}

	addMomentToFile(app, settings, file);
}

/**
 * Compute the new file content with the heading inserted.
 */
function insertHeading(content: string, settings: MomentsSettings, heading: string): string {
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

	return content;
}

/**
 * Add a moment to a specific file.
 */
function addMomentToFile(
	app: App,
	settings: MomentsSettings,
	file: TFile
): void {
	// Open the moment modal
	new MomentModal(app, {
		title: 'Insert moment',
		dateFormat: settings.dateFormat,
		onSubmit: async (result) => {
			try {
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

				// Open the file to ensure we have an editor
				const leaf = app.workspace.getLeaf();
				await leaf.openFile(file);

				const view = app.workspace.getActiveViewOfType(MarkdownView);
				const editor = view?.editor;

				// Read content via editor (preserves undo history) or vault as fallback
				let content: string;
				if (editor) {
					content = editor.getValue();
				} else {
					content = await app.vault.read(file);
				}

				content = insertHeading(content, settings, heading);

				// Write via editor when available to preserve undo history
				if (editor) {
					editor.setValue(content);
				} else {
					await app.vault.modify(file, content);
				}

				// Position cursor after the new heading
				const lines = content.split('\n');
				const headingLine = lines.findIndex((line) => line === heading);

				if (headingLine !== -1) {
					setTimeout(() => {
						const activeView = app.workspace.getActiveViewOfType(MarkdownView);
						if (activeView?.editor) {
							const cursorLine = headingLine + 1;
							activeView.editor.setCursor({ line: cursorLine, ch: 0 });
							activeView.editor.scrollIntoView(
								{
									from: { line: cursorLine, ch: 0 },
									to: { line: cursorLine, ch: 0 },
								},
								true
							);
							activeView.editor.focus();
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
