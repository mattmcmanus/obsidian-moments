import { App, Modal, Setting, Notice } from 'obsidian';
import { formatDate, parseDate, DEFAULT_DATE_FORMAT } from '../core/date-parser';
import { NoteLinkSuggest } from './note-link-suggest';
import { MODAL_FOCUS_DELAY_MS } from '../constants';

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
	private onSubmit: (result: MomentModalResult) => void | Promise<void>;
	private dateFormat: string;
	private titleText: string = '';
	private dateText: string;
	private modalTitle: string;

	constructor(
		app: App,
		options: {
			title: string;
			dateFormat: string;
			onSubmit: (result: MomentModalResult) => void | Promise<void>;
		}
	) {
		super(app);
		this.modalTitle = options.title;
		this.dateFormat = options.dateFormat;
		this.onSubmit = options.onSubmit;
		this.dateText = formatDate(new Date(), this.dateFormat);
	}

	onOpen() {
		const { contentEl } = this;

		this.titleEl.setText(this.modalTitle);
		this.modalEl.addClass('moments-modal');

		// Title input first — it's the primary input, date is pre-filled
		const titleSetting = new Setting(contentEl)
			.setName('Title')
			.setDesc('What is this moment about?')
			.addText((text) => {
				text
					.setPlaceholder('Call with lawyer')
					.setValue(this.titleText)
					.onChange((value) => {
						this.titleText = value;
					});
				new NoteLinkSuggest(this.app, text.inputEl);
				setTimeout(() => text.inputEl.focus(), MODAL_FOCUS_DELAY_MS);
			});
		titleSetting.settingEl.addClass('moments-modal-title-setting');

		// Date input — native date picker
		new Setting(contentEl)
			.setName('Date')
			.addText((text) => {
				text.inputEl.type = 'date';
				text.inputEl.value = formatDate(new Date(), DEFAULT_DATE_FORMAT);
				text.inputEl.addEventListener('change', () => {
					const isoValue = text.inputEl.value;
					const parsed = parseDate(isoValue, DEFAULT_DATE_FORMAT);
					if (parsed) {
						this.dateText = formatDate(parsed, this.dateFormat);
					}
				});
			});

		// Buttons — Cancel on the left, primary Create action on the right
		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText('Cancel').onClick(() => {
					this.close();
				})
			)
			.addButton((btn) =>
				btn
					.setButtonText('Create')
					.setCta()
					.onClick(() => {
						this.submit();
					})
			);

		// Handle Enter key — Modal.scope is auto-managed (pushed on open, popped on close)
		this.scope.register([], 'Enter', (e) => {
			e.preventDefault();
			this.submit();
		});
	}

	private submit(): void {
		// Validate date
		if (!parseDate(this.dateText, this.dateFormat)) {
			new Notice(`Invalid date format. Expected: ${this.dateFormat}`);
			return;
		}

		this.result = {
			title: this.titleText.trim(),
			date: this.dateText,
		};

		this.close();
		void Promise.resolve(this.onSubmit(this.result));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
