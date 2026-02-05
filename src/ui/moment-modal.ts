import { App, Modal, Setting, TextComponent, Notice } from 'obsidian';
import { getTodayString, isValidDateString } from '../core/date-parser';

/**
 * Result from the moment modal
 */
export interface MomentModalResult {
	title: string;
	date: string;
}

/**
 * Modal for creating a new moment (inline or standalone)
 */
export class MomentModal extends Modal {
	private result: MomentModalResult | null = null;
	private onSubmit: (result: MomentModalResult) => void;
	private dateFormat: string;
	private titleText: string = '';
	private dateText: string;
	private modalTitle: string;

	constructor(
		app: App,
		options: {
			title: string;
			dateFormat: string;
			onSubmit: (result: MomentModalResult) => void;
		}
	) {
		super(app);
		this.modalTitle = options.title;
		this.dateFormat = options.dateFormat;
		this.onSubmit = options.onSubmit;
		this.dateText = getTodayString(this.dateFormat);
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl('h2', { text: this.modalTitle });

		// Title input
		let titleInput: TextComponent;
		new Setting(contentEl)
			.setName('Title')
			.setDesc('What is this moment about?')
			.addText((text) => {
				titleInput = text;
				text
					.setPlaceholder('Call with Lawyer')
					.setValue(this.titleText)
					.onChange((value) => {
						this.titleText = value;
					});
				// Focus the title input
				setTimeout(() => text.inputEl.focus(), 10);
			});

		// Date input
		new Setting(contentEl)
			.setName('Date')
			.setDesc(`Format: ${this.dateFormat}`)
			.addText((text) =>
				text
					.setPlaceholder(this.dateFormat)
					.setValue(this.dateText)
					.onChange((value) => {
						this.dateText = value;
					})
			);

		// Buttons
		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText('Create')
					.setCta()
					.onClick(() => {
						this.submit();
					})
			)
			.addButton((btn) =>
				btn.setButtonText('Cancel').onClick(() => {
					this.close();
				})
			);

		// Handle Enter key in title input
		contentEl.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				this.submit();
			}
		});
	}

	private submit() {
		// Validate date
		if (!isValidDateString(this.dateText, this.dateFormat)) {
			new Notice(`Invalid date format. Expected: ${this.dateFormat}`);
			return;
		}

		this.result = {
			title: this.titleText.trim(),
			date: this.dateText,
		};

		this.close();
		this.onSubmit(this.result);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
