import { ItemView, WorkspaceLeaf, TFile, MarkdownRenderer, Menu, MarkdownView } from 'obsidian';
import type MomentsPlugin from '../main';
import type { Moment, ImplicitMoment, TimelineFilter } from '../types';
import { TIMELINE_VIEW_TYPE } from '../constants';
import { formatDate } from '../core/date-parser';
import { extractContentUnderHeading } from '../core/content-extractor';

/**
 * Timeline view displaying moments grouped by day.
 */
export class TimelineView extends ItemView {
	plugin: MomentsPlugin;
	private timelineContentEl: HTMLElement;
	private filter: TimelineFilter = {
		startDate: null,
		endDate: null,
		searchText: null,
	};

	constructor(leaf: WorkspaceLeaf, plugin: MomentsPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return TIMELINE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Moments Timeline';
	}

	getIcon(): string {
		return 'calendar-clock';
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!container) return;

		container.empty();
		container.addClass('moments-timeline');

		// Create header
		const header = container.createEl('div', { cls: 'moments-timeline-header' });
		this.createHeader(header);

		// Create content container
		this.timelineContentEl = container.createEl('div', { cls: 'moments-timeline-content' });

		// Initial render
		await this.renderTimeline();
	}

	async onClose(): Promise<void> {
		// Cleanup
	}

	private createHeader(header: HTMLElement): void {
		// Navigation controls
		const nav = header.createEl('div', { cls: 'moments-timeline-nav' });

		// Today button
		const todayBtn = nav.createEl('button', {
			cls: 'moments-nav-btn',
			text: 'Today',
		});
		todayBtn.addEventListener('click', () => this.goToToday());

		// Previous day
		const prevBtn = nav.createEl('button', {
			cls: 'moments-nav-btn',
			attr: { 'aria-label': 'Previous day' },
		});
		prevBtn.innerHTML = '←';
		prevBtn.addEventListener('click', () => this.navigateDay(-1));

		// Next day
		const nextBtn = nav.createEl('button', {
			cls: 'moments-nav-btn',
			attr: { 'aria-label': 'Next day' },
		});
		nextBtn.innerHTML = '→';
		nextBtn.addEventListener('click', () => this.navigateDay(1));

		// Filter indicator
		const filterInfo = header.createEl('div', { cls: 'moments-filter-info' });
		this.updateFilterInfo(filterInfo);

		// Quick actions
		const actions = header.createEl('div', { cls: 'moments-timeline-actions' });

		// New moment button
		const newBtn = actions.createEl('button', {
			cls: 'moments-action-btn',
			attr: { 'aria-label': 'Create new moment' },
		});
		newBtn.innerHTML = '+';
		newBtn.addEventListener('click', () => {
			(this.app as any).commands.executeCommandById('moments:create-standalone');
		});

		// Search button
		const searchBtn = actions.createEl('button', {
			cls: 'moments-action-btn',
			attr: { 'aria-label': 'Search vault' },
		});
		searchBtn.innerHTML = '🔍';
		searchBtn.addEventListener('click', () => {
			(this.app as any).commands.executeCommandById('global-search:open');
		});
	}

	private updateFilterInfo(el: HTMLElement): void {
		el.empty();

		if (this.filter.startDate && this.filter.endDate) {
			if (this.filter.startDate === this.filter.endDate) {
				el.setText(`Showing ${this.formatDisplayDate(this.filter.startDate)}`);
			} else {
				el.setText(
					`Showing ${this.formatDisplayDate(this.filter.startDate)} to ${this.formatDisplayDate(this.filter.endDate)}`
				);
			}

			// Add clear filter button
			const clearBtn = el.createEl('button', {
				cls: 'moments-clear-filter',
				text: '×',
				attr: { 'aria-label': 'Clear filter' },
			});
			clearBtn.addEventListener('click', () => this.clearFilter());
		} else {
			el.setText('Showing all moments');
		}
	}

	private formatDisplayDate(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});
	}

	async renderTimeline(): Promise<void> {
		this.timelineContentEl.empty();

		// Get moments from cache
		const moments = this.plugin.getMomentsForDisplay(this.filter);

		if (moments.length === 0) {
			this.renderEmptyState();
			return;
		}

		// Group moments by date
		const groupedByDate = this.groupMomentsByDate(moments);

		// Get implicit moments if enabled
		let implicitByDate: Map<string, ImplicitMoment[]> = new Map();
		if (this.plugin.settings.showImplicitMoments) {
			implicitByDate = await this.plugin.getImplicitMomentsForDisplay(
				this.filter,
				groupedByDate
			);
		}

		// Get all dates and sort (newest first)
		const allDates = new Set([...groupedByDate.keys(), ...implicitByDate.keys()]);
		const sortedDates = Array.from(allDates).sort((a, b) => b.localeCompare(a));

		// Render each day section
		for (const date of sortedDates) {
			const dayMoments = groupedByDate.get(date) || [];
			const dayImplicit = implicitByDate.get(date) || [];

			await this.renderDaySection(date, dayMoments, dayImplicit);
		}
	}

	private groupMomentsByDate(moments: Moment[]): Map<string, Moment[]> {
		const grouped = new Map<string, Moment[]>();

		for (const moment of moments) {
			if (!grouped.has(moment.date)) {
				grouped.set(moment.date, []);
			}
			grouped.get(moment.date)!.push(moment);
		}

		// Sort moments within each day by firstSeen (newest first)
		for (const [date, dateMoments] of grouped) {
			dateMoments.sort((a, b) => b.firstSeen - a.firstSeen);
		}

		return grouped;
	}

	private async renderDaySection(
		date: string,
		moments: Moment[],
		implicitMoments: ImplicitMoment[]
	): Promise<void> {
		const section = this.timelineContentEl.createEl('div', { cls: 'moments-day-section' });

		// Day header
		const header = section.createEl('div', { cls: 'moments-day-header' });
		header.createEl('span', {
			cls: 'moments-day-date',
			text: this.formatDisplayDate(date),
		});

		// Collapse/expand toggle
		const toggle = header.createEl('span', { cls: 'moments-day-toggle' });
		toggle.innerHTML = '▼';

		// Day content container
		const content = section.createEl('div', { cls: 'moments-day-content' });

		// Toggle collapse
		let collapsed = false;
		header.addEventListener('click', () => {
			collapsed = !collapsed;
			content.toggleClass('collapsed', collapsed);
			toggle.innerHTML = collapsed ? '▶' : '▼';
		});

		// Click to filter to this day
		header.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			const menu = new Menu();
			menu.addItem((item) =>
				item
					.setTitle('Filter to this day')
					.setIcon('calendar')
					.onClick(() => this.setDateFilter(date, date))
			);
			menu.showAtMouseEvent(e);
		});

		// Render primary moments
		for (const moment of moments) {
			await this.renderMomentCard(content, moment);
		}

		// Render implicit moments
		for (const implicit of implicitMoments) {
			this.renderImplicitMoment(content, implicit);
		}
	}

	private async renderMomentCard(container: HTMLElement, moment: Moment): Promise<void> {
		const card = container.createEl('div', { cls: 'moments-card' });

		// Card header with title
		const cardHeader = card.createEl('div', { cls: 'moments-card-header' });

		if (moment.title) {
			cardHeader.createEl('span', {
				cls: 'moments-card-title',
				text: moment.title,
			});
		}

		// Source file indicator
		const sourceFile = this.app.vault.getAbstractFileByPath(moment.filePath);
		if (sourceFile instanceof TFile) {
			const fileName = sourceFile.basename;
			const source = cardHeader.createEl('span', {
				cls: 'moments-card-source',
				text: moment.type === 'standalone' ? '' : `in ${fileName}`,
			});

			// Click to open file
			source.addEventListener('click', (e) => {
				e.stopPropagation();
				this.openMoment(moment);
			});
		}

		// Card content
		const cardContent = card.createEl('div', { cls: 'moments-card-content' });

		// Load and render content
		try {
			const content = await this.getMomentContent(moment);
			if (content) {
				await MarkdownRenderer.render(
					this.app,
					content,
					cardContent,
					moment.filePath,
					this.plugin
				);
			} else {
				cardContent.createEl('em', {
					cls: 'moments-card-empty',
					text: 'No content',
				});
			}
		} catch (error) {
			console.error('Failed to render moment content:', error);
			cardContent.createEl('em', {
				cls: 'moments-card-error',
				text: 'Failed to load content',
			});
		}

		// Click card to open moment
		card.addEventListener('click', () => this.openMoment(moment));
	}

	private async getMomentContent(moment: Moment): Promise<string> {
		const file = this.app.vault.getAbstractFileByPath(moment.filePath);
		if (!(file instanceof TFile)) {
			return '';
		}

		const fileContent = await this.app.vault.read(file);

		if (moment.type === 'standalone') {
			// Return full file content
			return fileContent;
		}

		// Extract content under the heading
		if (moment.headingLine !== undefined && moment.headingLevel !== undefined) {
			return extractContentUnderHeading(
				fileContent,
				moment.headingLine,
				moment.headingLevel
			);
		}

		return '';
	}

	private renderImplicitMoment(container: HTMLElement, implicit: ImplicitMoment): void {
		const el = container.createEl('div', { cls: 'moments-implicit' });

		// File link
		const link = el.createEl('a', {
			cls: 'moments-implicit-link',
			text: implicit.fileName,
		});
		link.addEventListener('click', (e) => {
			e.preventDefault();
			const file = this.app.vault.getAbstractFileByPath(implicit.filePath);
			if (file instanceof TFile) {
				this.app.workspace.getLeaf().openFile(file);
			}
		});

		// Action text
		el.createEl('span', {
			cls: 'moments-implicit-action',
			text: ` ${implicit.action}`,
		});
	}

	private renderEmptyState(): void {
		const emptyState = this.timelineContentEl.createEl('div', { cls: 'moments-empty-state' });

		emptyState.createEl('h3', { text: 'No moments yet' });

		emptyState.createEl('p', {
			text: 'Moments are date-linked entries in your notes. They can be inline headings with dates or standalone dated note files.',
		});

		const createBtn = emptyState.createEl('button', {
			cls: 'mod-cta',
			text: 'Create your first moment',
		});
		createBtn.addEventListener('click', () => {
			(this.app as any).commands.executeCommandById('moments:create-standalone');
		});
	}

	private async openMoment(moment: Moment): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(moment.filePath);
		if (!(file instanceof TFile)) {
			return;
		}

		await this.app.workspace.getLeaf().openFile(file);

		// For inline moments, scroll to the heading
		if (moment.type === 'inline' && moment.headingLine !== undefined) {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (view) {
				const editor = (view as any).editor;
				if (editor) {
					editor.setCursor({ line: moment.headingLine, ch: 0 });
					editor.scrollIntoView(
						{ from: { line: moment.headingLine, ch: 0 }, to: { line: moment.headingLine, ch: 0 } },
						true
					);
				}
			}
		}
	}

	// Public methods for navigation and filtering

	goToToday(): void {
		const today = formatDate(new Date());
		this.setDateFilter(today, today);
	}

	navigateDay(delta: number): void {
		let currentDate: Date;

		if (this.filter.startDate) {
			currentDate = new Date(this.filter.startDate + 'T00:00:00');
		} else {
			currentDate = new Date();
		}

		currentDate.setDate(currentDate.getDate() + delta);
		const newDate = formatDate(currentDate);
		this.setDateFilter(newDate, newDate);
	}

	setDateFilter(startDate: string | null, endDate: string | null): void {
		this.filter.startDate = startDate;
		this.filter.endDate = endDate;

		// Update filter display
		const filterInfo = this.containerEl.querySelector('.moments-filter-info');
		if (filterInfo) {
			this.updateFilterInfo(filterInfo as HTMLElement);
		}

		this.renderTimeline();
	}

	clearFilter(): void {
		this.setDateFilter(null, null);
	}

	refresh(): void {
		this.renderTimeline();
	}
}
