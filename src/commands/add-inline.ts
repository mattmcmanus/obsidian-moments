import { App, MarkdownView, TFile, Notice } from 'obsidian';
import type { MomentsSettings } from '../settings/settings';
import { MomentModal } from '../ui/moment-modal';
import { FileSuggesterModal } from '../ui/file-suggester';
import { buildHeadingString } from '../core/template-engine';
import type { TemplateVariables } from '../core/template-engine';

/**
 * Find a section heading in file content and return its line number.
 * Returns -1 if not found.
 */
function findSectionLine(content: string, sectionHeading: string): number {
	const lines = content.split('\n');
	const normalizedSection = sectionHeading.trim().toLowerCase();

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line !== undefined && line.trim().toLowerCase() === normalizedSection) {
			return i;
		}
	}
	return -1;
}

/**
 * Find the end of a section (line before next same-or-higher level heading).
 * Returns the line number to insert at for append, or -1 if section goes to end.
 */
function findSectionEnd(lines: string[], sectionLine: number): number {
	// Get section level
	const sectionLineContent = lines[sectionLine];
	if (!sectionLineContent) return -1;
	const sectionMatch = sectionLineContent.match(/^(#+)/);
	if (!sectionMatch || !sectionMatch[1]) return -1;
	const sectionLevel = sectionMatch[1].length;

	for (let i = sectionLine + 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;
		const match = line.match(/^(#+)\s/);
		if (match && match[1] && match[1].length <= sectionLevel) {
			return i;
		}
	}
	return -1; // Section goes to end of file
}

/**
 * Insert content after a section heading (for prepend behavior).
 */
function insertAfterSection(
	content: string,
	sectionLine: number,
	newContent: string
): string {
	const lines = content.split('\n');

	// Insert after the section heading, with blank line before
	lines.splice(sectionLine + 1, 0, '', newContent);

	return lines.join('\n');
}

/**
 * Insert content at the end of a section (for append behavior).
 */
function insertAtSectionEnd(
	content: string,
	sectionLine: number,
	newContent: string
): string {
	const lines = content.split('\n');
	const endLine = findSectionEnd(lines, sectionLine);

	if (endLine === -1) {
		// Section goes to end of file
		lines.push('', newContent);
	} else {
		// Insert before the next section
		lines.splice(endLine, 0, newContent, '');
	}

	return lines.join('\n');
}

/**
 * Add the target section to the end of the file.
 */
function appendSection(content: string, sectionHeading: string): string {
	// Add section at end with proper spacing
	const trimmed = content.trimEnd();
	return `${trimmed}\n\n${sectionHeading}\n`;
}

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
			new FileSuggesterModal(app, async (selectedFile) => {
				await addMomentToFile(app, settings, selectedFile);
				resolve();
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

				// Position cursor after the new heading
				const view = app.workspace.getActiveViewOfType(MarkdownView);
				if (view) {
					const lines = content.split('\n');
					const headingLine = lines.findIndex((line) => line === heading);
					if (headingLine !== -1) {
						view.editor.setCursor({ line: headingLine + 1, ch: 0 });
					}
				}

				new Notice('Moment created');
			} catch (error) {
				console.error('Failed to create moment:', error);
				new Notice('Failed to create moment');
			}
		},
	}).open();
}
