import { App, TFile, normalizePath } from 'obsidian';
import type { MomentsSettings } from '../settings/settings';
import { buildFilename, renderTemplate } from '../core/template-engine';
import type { TemplateVariables } from '../core/template-engine';

/**
 * Inputs for creating a standalone moment note.
 */
export interface StandaloneNoteResult {
	title: string;
	date: string;
	/** Target folder path ('' = vault root). */
	folder: string;
}

/**
 * Create a standalone moment note in the requested folder.
 *
 * Returns the created file, or an existing file (with `existed: true`) when a
 * note already lives at the target path. Auto-creates the target folder when
 * it is missing. Contains no UI — callers handle notices and opening the file.
 */
export async function createStandaloneNote(
	app: App,
	settings: MomentsSettings,
	result: StandaloneNoteResult
): Promise<{ file: TFile; existed: boolean }> {
	const templateVars: TemplateVariables = {
		date: result.date,
		title: result.title || null,
	};

	const filename = buildFilename(templateVars, settings.filenameTemplate);
	const trimmedFolder = result.folder.trim();
	// Normalize so folder lookups match Obsidian's internal index (e.g. a
	// trailing slash on 'Journal/' would otherwise miss the existing folder).
	const folder = trimmedFolder ? normalizePath(trimmedFolder) : '';
	const fullPath = normalizePath(folder ? `${folder}/${filename}` : filename);

	const existing = app.vault.getFileByPath(fullPath);
	if (existing) {
		return { file: existing, existed: true };
	}

	if (folder && !app.vault.getFolderByPath(folder)) {
		try {
			await app.vault.createFolder(folder);
		} catch (error) {
			// Tolerate a concurrent creation race; rethrow anything else.
			if (!String(error).includes('already exists')) {
				throw error;
			}
		}
	}

	const content = settings.noteTemplate
		? renderTemplate(settings.noteTemplate, templateVars)
		: '';

	const file = await app.vault.create(fullPath, content);
	return { file, existed: false };
}
