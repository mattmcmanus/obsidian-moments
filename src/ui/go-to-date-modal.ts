import { App, Modal, Setting, Notice } from 'obsidian';
import { formatDate } from '../core/date-parser';
import { MODAL_FOCUS_DELAY_MS } from '../constants';

/**
 * Modal for jumping the timeline to a specific date.
 *
 * Returns an ISO date string (YYYY-MM-DD) — the format the timeline filter
 * uses internally — so the caller can apply it directly as a date filter.
 */
export class GoToDateModal extends Modal {
	private dateValue: string;
	private onSubmit: (isoDate: string) => void;

	constructor(
		app: App,
		options: {
			/** Initial ISO date (YYYY-MM-DD). Defaults to today. */
			initialDate?: string;
			onSubmit: (isoDate: string) => void;
		}
	) {
		super(app);
		this.dateValue = options.initialDate ?? formatDate(new Date());
		this.onSubmit = options.onSubmit;
	}

	onOpen() {
		const { contentEl } = this;

		this.titleEl.setText('Go to date');
		this.modalEl.addClass('moments-modal');

		new Setting(contentEl)
			.setName('Date')
			.setDesc('Jump the timeline to this date')
			.addText((text) => {
				text.inputEl.type = 'date';
				text.inputEl.value = this.dateValue;
				text.inputEl.addEventListener('change', () => {
					this.dateValue = text.inputEl.value;
				});
				setTimeout(() => text.inputEl.focus(), MODAL_FOCUS_DELAY_MS);
			});

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText('Cancel').onClick(() => {
					this.close();
				})
			)
			.addButton((btn) =>
				btn
					.setButtonText('Go')
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
		if (!this.dateValue) {
			new Notice('Please choose a date');
			return;
		}

		this.close();
		this.onSubmit(this.dateValue);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
