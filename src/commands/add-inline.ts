import { App, MarkdownView, TFile, Notice } from 'obsidian';
import type { MomentsSettings } from '../settings/settings';
import { MomentModal } from '../ui/moment-modal';
import { FileSuggesterModal } from '../ui/file-suggester';
import { buildHeadingString } from '../core/template-engine';
import type { TemplateVariables } from '../core/template-engine';
import { insertHeading } from '../core/section-helpers';
import { CURSOR_REPOSITION_DELAY_MS } from '../constants';

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
 * Position the cursor on the line after the given heading and scroll into view.
 */
function positionCursorAfterHeading(app: App, content: string, heading: string): void {
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
		}, CURSOR_REPOSITION_DELAY_MS);
	}
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

				// Write via editor when available to preserve undo history,
				// or use vault.process() as an atomic read-modify-write fallback
				let content: string;
				if (editor) {
					content = insertHeading(editor.getValue(), settings, heading);
					editor.setValue(content);
				} else {
					await app.vault.process(file, (data) =>
						insertHeading(data, settings, heading)
					);
					content = await app.vault.read(file);
				}

				positionCursorAfterHeading(app, content, heading);

				new Notice('Moment created');
			} catch (error) {
				console.error('Moments: Failed to create inline moment:', error);
				new Notice('Failed to create moment');
			}
		},
	}).open();
}
