import { AbstractInputSuggest, App, TFile } from 'obsidian';
import { extractPartialLink, filterAndSortLinkSuggestions } from '../core/note-link-helpers';

/**
 * Provides [[note link]] suggestions in a text input.
 * Activates when the user types [[ and shows matching file names.
 */
export class NoteLinkSuggest extends AbstractInputSuggest<TFile> {
	private inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
	}

	getSuggestions(query: string): TFile[] {
		const partial = extractPartialLink(query);
		if (partial === null) return [];

		return filterAndSortLinkSuggestions(this.app.vault.getMarkdownFiles(), partial);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.createEl('span', { text: file.basename });
		if (file.parent && file.parent.path !== '/') {
			const pathEl = el.createEl('span', { cls: 'moments-suggest-path' });
			pathEl.textContent = ` — ${file.parent.path}`;
		}
	}

	selectSuggestion(file: TFile): void {
		const currentValue = this.inputEl.value;
		const lastOpen = currentValue.lastIndexOf('[[');
		if (lastOpen === -1) return;

		// Replace [[partial with [[filename]] — partial runs to end of string
		// since we only activate when there's no closing ]]
		const newValue = currentValue.slice(0, lastOpen) + `[[${file.basename}]]`;

		this.setValue(newValue);
		this.inputEl.dispatchEvent(new Event('input'));
	}
}
