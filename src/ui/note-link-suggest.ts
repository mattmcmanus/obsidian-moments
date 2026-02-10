import { AbstractInputSuggest, App, TFile } from 'obsidian';

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
		// Find the last unclosed [[ in the query
		const lastOpen = query.lastIndexOf('[[');
		if (lastOpen === -1) return [];

		// Check if there's a ]] after the [[
		const afterOpen = query.slice(lastOpen + 2);
		if (afterOpen.includes(']]')) return [];

		const partial = afterOpen.toLowerCase();
		const files = this.app.vault.getMarkdownFiles();

		return files
			.filter((file) => file.basename.toLowerCase().includes(partial))
			.sort((a, b) => {
				const aStartsWith = a.basename.toLowerCase().startsWith(partial);
				const bStartsWith = b.basename.toLowerCase().startsWith(partial);
				if (aStartsWith && !bStartsWith) return -1;
				if (!aStartsWith && bStartsWith) return 1;
				return a.basename.localeCompare(b.basename);
			});
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
