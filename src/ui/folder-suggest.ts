import { AbstractInputSuggest, App, TFolder } from 'obsidian';
import { filterFolderSuggestions } from '../core/folder-helpers';

/**
 * Provides vault folder autocomplete for a text input.
 */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
	}

	getSuggestions(query: string): TFolder[] {
		const folders = this.app.vault
			.getAllLoadedFiles()
			.filter((file): file is TFolder => file instanceof TFolder);
		return filterFolderSuggestions(folders, query);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.isRoot() ? '/ (vault root)' : folder.path);
	}

	selectSuggestion(folder: TFolder): void {
		const value = folder.isRoot() ? '' : folder.path;
		this.setValue(value);
		this.inputEl.value = value;
		this.inputEl.dispatchEvent(new Event('input'));
		this.close();
	}
}
