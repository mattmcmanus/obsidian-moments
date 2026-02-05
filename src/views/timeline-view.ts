import { ItemView, WorkspaceLeaf, TFile, MarkdownRenderer, Menu, MarkdownView } from 'obsidian';
import type MomentsPlugin from '../main';
import type { Moment, ImplicitMoment, TimelineFilter } from '../types';
import { TIMELINE_VIEW_TYPE } from '../constants';
import { formatDate } from '../core/date-parser';
import { extractContentUnderHeading } from '../core/content-extractor';
import { debug, debugTimed } from '../utils/debug';

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

	// Pagination state
	private loadedMonths: Set<string> = new Set();
	private oldestLoadedMonth: string | null = null;
	private isLoadingMore: boolean = false;
	private hasMoreMonths: boolean = true;
	private allMoments: Moment[] = [];
	private allImplicitByDate: Map<string, ImplicitMoment[]> = new Map();

	constructor(leaf: WorkspaceLeaf, plugin: MomentsPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return TIMELINE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Moments timeline';
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
			cls: 'clickable-icon nav-action-button',
			text: 'Today',
			attr: { 'aria-label': 'Go to today' },
		});
		todayBtn.addEventListener('click', () => this.goToToday());

		// Previous day
		const prevBtn = nav.createEl('button', {
			cls: 'clickable-icon nav-action-button',
			attr: { 'aria-label': 'Previous day' },
		});
		prevBtn.textContent = '←';
		prevBtn.addEventListener('click', () => {
			this.navigateDay(-1);
		});

		// Next day
		const nextBtn = nav.createEl('button', {
			cls: 'clickable-icon nav-action-button',
			attr: { 'aria-label': 'Next day' },
		});
		nextBtn.textContent = '→';
		nextBtn.addEventListener('click', () => {
			this.navigateDay(1);
		});

		// Filter indicator
		const filterInfo = header.createEl('div', { cls: 'moments-filter-info' });
		this.updateFilterInfo(filterInfo);

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
			el.setText('Recent moments');
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
		const done = debugTimed('Timeline render');
		debug('Rendering timeline', { filter: this.filter });

		this.timelineContentEl.empty();

		// Reset pagination state
		this.loadedMonths.clear();
		this.oldestLoadedMonth = null;
		this.hasMoreMonths = true;
		this.isLoadingMore = false;

		// Get moments from cache
		this.allMoments = this.plugin.getMomentsForDisplay(this.filter);

		// Group moments by date
		const groupedByDate = this.groupMomentsByDate(this.allMoments);

		// Get implicit moments if enabled
		this.allImplicitByDate = new Map();
		if (this.plugin.settings.showImplicitMoments) {
			this.allImplicitByDate = await this.plugin.getImplicitMomentsForDisplay(
				this.filter,
				groupedByDate
			);
		}

		// Get all dates
		const allDates = new Set([...groupedByDate.keys(), ...this.allImplicitByDate.keys()]);

		debug('Timeline data loaded', {
			explicitMoments: this.allMoments.length,
			implicitDates: this.allImplicitByDate.size,
			totalDates: allDates.size,
		});

		if (allDates.size === 0) {
			this.renderEmptyState();
			done();
			return;
		}

		// Determine which month to start with
		const startMonth = this.getStartMonth();

		// Load initial month
		await this.loadMonth(startMonth, groupedByDate);

		// Add scroll listener for infinite loading
		this.setupScrollListener();

		// Add "load more" button as fallback
		this.addLoadMoreButton();

		done();
	}

	private getStartMonth(): string {
		// If filter is set, use filter start date's month
		if (this.filter.startDate) {
			return this.filter.startDate.substring(0, 7); // YYYY-MM
		}

		// Otherwise, use current month
		return formatDate(new Date()).substring(0, 7);
	}

	private async loadMonth(
		month: string,
		groupedByDate?: Map<string, Moment[]>,
		searchDepth: number = 0
	): Promise<void> {
		if (this.loadedMonths.has(month)) {
			return;
		}

		this.loadedMonths.add(month);

		// Group by date if not provided
		if (!groupedByDate) {
			groupedByDate = this.groupMomentsByDate(this.allMoments);
		}

		// Track oldest loaded month
		if (!this.oldestLoadedMonth || month < this.oldestLoadedMonth) {
			this.oldestLoadedMonth = month;
		}

		// Get all dates for this month
		const monthDates = this.getDatesForMonth(month, groupedByDate);

		if (monthDates.length === 0) {
			// No dates in this month, try older months (up to 12 months back on initial load)
			if (searchDepth < 12) {
				const prevMonth = this.getPreviousMonth(month);
				await this.loadMonth(prevMonth, groupedByDate, searchDepth + 1);
			}
			return;
		}

		// Render days in this month (sorted newest first)
		monthDates.sort((a, b) => b.localeCompare(a));

		for (const date of monthDates) {
			const dayMoments = groupedByDate.get(date) || [];
			const dayImplicit = this.allImplicitByDate.get(date) || [];

			await this.renderDaySection(date, dayMoments, dayImplicit);
		}
	}

	private getPreviousMonth(month: string): string {
		const parts = month.split('-').map(Number);
		const year = parts[0] || 2000;
		const monthNum = parts[1] || 1;
		let prevYear = year;
		let prevMonth = monthNum - 1;

		if (prevMonth < 1) {
			prevMonth = 12;
			prevYear--;
		}

		return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
	}

	private getDatesForMonth(
		month: string,
		groupedByDate: Map<string, Moment[]>
	): string[] {
		const allDates = new Set([...groupedByDate.keys(), ...this.allImplicitByDate.keys()]);
		return Array.from(allDates).filter((date) => date.startsWith(month));
	}

	private async loadOlderMonth(groupedByDate?: Map<string, Moment[]>): Promise<void> {
		if (this.isLoadingMore || !this.hasMoreMonths || !this.oldestLoadedMonth) {
			return;
		}

		this.isLoadingMore = true;

		// Calculate previous month
		const prevMonthStr = this.getPreviousMonth(this.oldestLoadedMonth);

		// Check if there are any dates older than our oldest loaded month
		if (!groupedByDate) {
			groupedByDate = this.groupMomentsByDate(this.allMoments);
		}

		const allDates = new Set([...groupedByDate.keys(), ...this.allImplicitByDate.keys()]);
		const hasOlderDates = Array.from(allDates).some((date) => date < this.oldestLoadedMonth!);

		if (!hasOlderDates) {
			this.hasMoreMonths = false;
			this.removeLoadMoreButton();
			this.isLoadingMore = false;
			return;
		}

		// Load the previous month (which may recursively load more if empty)
		await this.loadMonth(prevMonthStr, groupedByDate, 0);

		this.isLoadingMore = false;

		// Update load more button visibility
		this.updateLoadMoreButton();
	}

	private setupScrollListener(): void {
		const scrollContainer = this.timelineContentEl;

		scrollContainer.addEventListener('scroll', () => {
			if (this.isLoadingMore || !this.hasMoreMonths) {
				return;
			}

			const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
			const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 100;

			if (scrolledToBottom) {
				void this.loadOlderMonth();
			}
		});
	}

	private addLoadMoreButton(): void {
		const existingBtn = this.timelineContentEl.querySelector('.moments-load-more');
		if (existingBtn) {
			existingBtn.remove();
		}

		if (!this.hasMoreMonths) {
			return;
		}

		const loadMoreBtn = this.timelineContentEl.createEl('button', {
			cls: 'moments-load-more',
			text: 'Load more...',
		});

		loadMoreBtn.addEventListener('click', () => {
			void this.loadOlderMonth();
		});
	}

	private updateLoadMoreButton(): void {
		const btn = this.timelineContentEl.querySelector('.moments-load-more');
		if (btn && !this.hasMoreMonths) {
			btn.remove();
		}
	}

	private removeLoadMoreButton(): void {
		const btn = this.timelineContentEl.querySelector('.moments-load-more');
		if (btn) {
			btn.remove();
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
		for (const [, dateMoments] of grouped) {
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
		toggle.textContent = '▼';

		// Day content container
		const content = section.createEl('div', { cls: 'moments-day-content' });

		// Toggle collapse
		let collapsed = false;
		header.addEventListener('click', () => {
			collapsed = !collapsed;
			content.toggleClass('collapsed', collapsed);
			toggle.textContent = collapsed ? '▶' : '▼';
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
				void this.openMoment(moment);
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
					this
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
		card.addEventListener('click', () => {
			void this.openMoment(moment);
		});
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
				void this.app.workspace.getLeaf().openFile(file);
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
			this.executeCommand('moments:create-standalone');
		});
	}

	/**
	 * Execute a command by ID.
	 */
	private executeCommand(commandId: string): void {
		const app = this.app as typeof this.app & {
			commands: { executeCommandById: (id: string) => void };
		};
		app.commands.executeCommandById(commandId);
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
			if (view?.editor) {
				view.editor.setCursor({ line: moment.headingLine, ch: 0 });
				view.editor.scrollIntoView(
					{ from: { line: moment.headingLine, ch: 0 }, to: { line: moment.headingLine, ch: 0 } },
					true
				);
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
		debug('Setting date filter', { startDate, endDate });
		this.filter.startDate = startDate;
		this.filter.endDate = endDate;

		// Update filter display
		const filterInfo = this.containerEl.querySelector('.moments-filter-info');
		if (filterInfo) {
			this.updateFilterInfo(filterInfo as HTMLElement);
		}

		void this.renderTimeline();
	}

	clearFilter(): void {
		debug('Clearing filter');
		this.setDateFilter(null, null);
	}

	refresh(): void {
		void this.renderTimeline();
	}
}
