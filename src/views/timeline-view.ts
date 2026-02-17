import { ItemView, WorkspaceLeaf, TFile, MarkdownRenderer, Menu, MarkdownView, Setting, setIcon } from 'obsidian';
import type MomentsPlugin from '../main';
import type { Moment, ImplicitMoment, TimelineFilter } from '../types';
import { TIMELINE_VIEW_TYPE } from '../constants';
import { formatDate } from '../core/date-parser';
import { extractContentUnderHeading } from '../core/content-extractor';
import { debug, debugTimed } from '../utils/debug';
import { getPreviousMonth, getDatesForMonth, groupMomentsByDate } from '../core/timeline-helpers';

/**
 * Timeline view displaying moments grouped by day.
 */
export class TimelineView extends ItemView {
	plugin: MomentsPlugin;
	private timelineContentEl: HTMLElement;
	private headerTitleEl: HTMLElement;
	private headerSubtitleEl: HTMLElement;
	private clearFilterBtn: HTMLButtonElement;
	private configPanelEl: HTMLElement;
	private configOpen: boolean = false;
	private pinned = false;
	private pinnedBtn: HTMLButtonElement;
	private scrollHandler: (() => void) | null = null;
	private filter: TimelineFilter = {
		startDate: null,
		endDate: null,
		searchText: null,
		relatedToFile: null,
	};

	// Pagination state
	private loadedMonths: Set<string> = new Set();
	private oldestLoadedMonth: string | null = null;
	private isLoadingMore: boolean = false;
	private hasMoreMonths: boolean = true;
	private allMoments: Moment[] = [];
	private groupedByDate: Map<string, Moment[]> = new Map();
	private allImplicitByDate: Map<string, ImplicitMoment[]> = new Map();

	// Content cache: avoids re-reading files on every render
	private contentCache: Map<string, string> = new Map();

	// Data fingerprint to skip redundant re-renders
	private lastRenderFingerprint: string = '';

	// Lazy rendering: defer MarkdownRenderer until cards are visible
	private cardObserver: IntersectionObserver | null = null;
	private pendingCardRenders: Map<HTMLElement, Moment> = new Map();

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

	onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!container) return Promise.resolve();

		container.empty();
		container.addClass('moments-timeline');

		// Create header
		const header = container.createEl('div', { cls: 'moments-timeline-header' });
		this.createHeader(header);

		// Create content container
		this.timelineContentEl = container.createEl('div', { cls: 'moments-timeline-content' });

		// Initial render
		this.renderTimeline();
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.removeScrollListener();
		this.destroyCardObserver();
		this.contentCache.clear();
		return Promise.resolve();
	}

	private createHeader(header: HTMLElement): void {
		const bar = header.createEl('div', { cls: 'moments-header-bar' });

		const titleGroup = bar.createEl('div', { cls: 'moments-header-title-group' });
		this.headerSubtitleEl = titleGroup.createEl('span', { cls: 'moments-header-subtitle moments-hidden' });
		this.headerTitleEl = titleGroup.createEl('span', { cls: 'moments-header-title' });

		const controls = bar.createEl('div', { cls: 'moments-header-controls' });

		// Clear filter button (hidden by default)
		this.clearFilterBtn = controls.createEl('button', {
			cls: 'clickable-icon',
			attr: { 'aria-label': 'Clear filter' },
		});
		setIcon(this.clearFilterBtn, 'x');
		this.clearFilterBtn.addClass('moments-hidden');
		this.clearFilterBtn.addEventListener('click', () => this.clearFilter());

		// Pin indicator (hidden by default, shown when filter is pinned)
		this.pinnedBtn = controls.createEl('button', {
			cls: 'clickable-icon',
			attr: { 'aria-label': 'Unpin filter (resume auto-follow)' },
		});
		setIcon(this.pinnedBtn, 'pin');
		this.pinnedBtn.addClass('moments-hidden');
		this.pinnedBtn.addEventListener('click', () => this.clearFilter());

		// Config toggle button
		const configBtn = controls.createEl('button', {
			cls: 'clickable-icon',
			attr: { 'aria-label': 'Timeline settings' },
		});
		setIcon(configBtn, 'settings');
		configBtn.addEventListener('click', () => this.toggleConfigPanel());

		// Config panel (hidden by default)
		this.configPanelEl = header.createEl('div', { cls: 'moments-config-panel' });
		this.buildConfigPanel();
		this.updateHeader();
	}

	private updateHeader(): void {
		const hasDateFilter = this.filter.startDate && this.filter.endDate;
		const hasRelatedFilter = this.filter.relatedToFile;
		const hasFilter = hasDateFilter || hasRelatedFilter;

		if (hasRelatedFilter) {
			const file = this.app.vault.getAbstractFileByPath(this.filter.relatedToFile!);
			const basename = file instanceof TFile ? file.basename : this.filter.relatedToFile!.replace(/\.md$/, '');
			this.headerTitleEl.textContent = basename;
		} else if (hasDateFilter) {
			if (this.filter.startDate === this.filter.endDate) {
				this.headerTitleEl.textContent = this.formatDisplayDate(this.filter.startDate!);
			} else {
				this.headerTitleEl.textContent = `${this.formatDisplayDate(this.filter.startDate!)} – ${this.formatDisplayDate(this.filter.endDate!)}`;
			}
		} else {
			this.headerTitleEl.textContent = 'Recent moments';
		}

		this.headerSubtitleEl.textContent = 'Filtering moments for';
		this.headerSubtitleEl.toggleClass('moments-hidden', !hasFilter);
		this.clearFilterBtn.toggleClass('moments-hidden', !hasFilter);
		this.pinnedBtn.toggleClass('moments-hidden', !this.pinned);
	}

	private toggleConfigPanel(): void {
		this.configOpen = !this.configOpen;
		this.configPanelEl.toggleClass('is-open', this.configOpen);
	}

	private buildConfigPanel(): void {
		new Setting(this.configPanelEl)
			.setName('Implicit moments')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showImplicitMoments).onChange((value) => {
					this.plugin.settings.showImplicitMoments = value;
					void this.plugin.saveSettings();
					void this.renderTimeline();
				})
			);

		new Setting(this.configPanelEl)
			.setName('Auto-follow periodic notes')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoFilterOnPeriodicNote).onChange((value) => {
					this.plugin.settings.autoFilterOnPeriodicNote = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(this.configPanelEl)
			.setName('Auto-follow active file')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoFilterRelatedMoments).onChange((value) => {
					this.plugin.settings.autoFilterRelatedMoments = value;
					void this.plugin.saveSettings();
				})
			);
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

	renderTimeline(force: boolean = false): void {
		if (!this.timelineContentEl) return;

		const done = debugTimed('Timeline render');
		debug('Rendering timeline', { filter: this.filter });

		// Fetch data before DOM changes to allow fingerprint comparison
		const moments = this.plugin.getMomentsForDisplay(this.filter);

		let implicitByDate = new Map<string, ImplicitMoment[]>();
		if (this.plugin.settings.showImplicitMoments) {
			implicitByDate = this.plugin.getImplicitMomentsForDisplay(
				this.filter
			);
		}

		// Build a fingerprint from moment data to detect changes
		const fingerprint = this.computeFingerprint(moments, implicitByDate);
		if (!force && fingerprint === this.lastRenderFingerprint) {
			debug('Timeline render skipped - data unchanged');
			done();
			return;
		}
		this.lastRenderFingerprint = fingerprint;

		// Tear down previous render state
		this.destroyCardObserver();
		this.timelineContentEl.empty();

		// Reset pagination state
		this.loadedMonths.clear();
		this.oldestLoadedMonth = null;
		this.hasMoreMonths = true;
		this.isLoadingMore = false;

		// Store data on instance for use during pagination
		this.allMoments = moments;
		this.groupedByDate = groupMomentsByDate(this.allMoments);
		this.allImplicitByDate = implicitByDate;

		// Get all dates
		const allDates = new Set([...this.groupedByDate.keys(), ...this.allImplicitByDate.keys()]);

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

		// Set up lazy rendering observer
		this.setupCardObserver();

		// Determine which month to start with
		const startMonth = this.getStartMonth();

		// Load initial month
		this.loadMonth(startMonth);

		// Add scroll listener for infinite loading
		this.setupScrollListener();

		// Add "load more" button as fallback
		this.addLoadMoreButton();

		done();
	}

	private computeFingerprint(
		moments: Moment[],
		implicitByDate: Map<string, ImplicitMoment[]>
	): string {
		// Moments fingerprint: count + key fields of each moment
		const parts: string[] = [
			String(moments.length),
			this.plugin.settings.showImplicitMoments ? '1' : '0',
			this.filter.startDate ?? '',
			this.filter.endDate ?? '',
			this.filter.relatedToFile ?? '',
		];
		for (const m of moments) {
			parts.push(`${m.filePath}:${m.date}:${m.headingLine ?? 's'}`);
		}
		// Implicit fingerprint: count per date
		for (const [date, items] of implicitByDate) {
			parts.push(`i:${date}:${items.length}`);
		}
		return parts.join('|');
	}

	private getStartMonth(): string {
		// If filter is set, use filter start date's month
		if (this.filter.startDate) {
			return this.filter.startDate.substring(0, 7); // YYYY-MM
		}

		// Otherwise, use current month
		return formatDate(new Date()).substring(0, 7);
	}

	private loadMonth(
		month: string,
		searchDepth: number = 0
	): void {
		if (this.loadedMonths.has(month)) {
			return;
		}

		this.loadedMonths.add(month);

		// Track oldest loaded month
		if (!this.oldestLoadedMonth || month < this.oldestLoadedMonth) {
			this.oldestLoadedMonth = month;
		}

		// Get all dates for this month
		const monthDates = getDatesForMonth(month, this.groupedByDate.keys(), this.allImplicitByDate.keys());

		if (monthDates.length === 0) {
			// No dates in this month, try older months (up to 12 months back on initial load)
			if (searchDepth < 12) {
				const prevMonth = getPreviousMonth(month);
				this.loadMonth(prevMonth, searchDepth + 1);
			}
			return;
		}

		// Render days in this month (sorted newest first)
		monthDates.sort((a, b) => b.localeCompare(a));

		for (const date of monthDates) {
			const dayMoments = this.groupedByDate.get(date) || [];
			const dayImplicit = this.allImplicitByDate.get(date) || [];

			this.renderDaySection(date, dayMoments, dayImplicit);
		}
	}

	private loadOlderMonth(): void {
		if (this.isLoadingMore || !this.hasMoreMonths || !this.oldestLoadedMonth) {
			return;
		}

		this.isLoadingMore = true;

		// Calculate previous month
		const prevMonthStr = getPreviousMonth(this.oldestLoadedMonth);

		// Check if there are any dates older than our oldest loaded month
		const allDates = new Set([...this.groupedByDate.keys(), ...this.allImplicitByDate.keys()]);
		const hasOlderDates = Array.from(allDates).some((date) => date < this.oldestLoadedMonth!);

		if (!hasOlderDates) {
			this.hasMoreMonths = false;
			this.removeLoadMoreButton();
			this.isLoadingMore = false;
			return;
		}

		// Load the previous month (which may recursively load more if empty)
		this.loadMonth(prevMonthStr, 0);

		this.isLoadingMore = false;

		// Update load more button visibility
		this.updateLoadMoreButton();
	}

	private setupScrollListener(): void {
		this.removeScrollListener();

		let rafPending = false;
		this.scrollHandler = () => {
			if (rafPending || this.isLoadingMore || !this.hasMoreMonths) {
				return;
			}
			rafPending = true;
			requestAnimationFrame(() => {
				rafPending = false;
				const { scrollTop, scrollHeight, clientHeight } = this.timelineContentEl;
				const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 100;
				if (scrolledToBottom) {
					this.loadOlderMonth();
				}
			});
		};

		this.timelineContentEl.addEventListener('scroll', this.scrollHandler, { passive: true });
	}

	private removeScrollListener(): void {
		if (this.scrollHandler) {
			this.timelineContentEl?.removeEventListener('scroll', this.scrollHandler);
			this.scrollHandler = null;
		}
	}

	private setupCardObserver(): void {
		this.pendingCardRenders.clear();
		this.cardObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					const card = entry.target as HTMLElement;
					const moment = this.pendingCardRenders.get(card);
					if (moment) {
						this.pendingCardRenders.delete(card);
						this.cardObserver?.unobserve(card);
						void this.renderCardContent(card, moment);
					}
				}
			},
			{ root: this.timelineContentEl, rootMargin: '200px 0px' }
		);
	}

	private destroyCardObserver(): void {
		if (this.cardObserver) {
			this.cardObserver.disconnect();
			this.cardObserver = null;
		}
		this.pendingCardRenders.clear();
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
			this.loadOlderMonth();
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

	private renderDaySection(
		date: string,
		moments: Moment[],
		implicitMoments: ImplicitMoment[]
	): void {
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
					.onClick(() => {
						debug('Pinning date filter', { date });
						this.applyFilter({ startDate: date, endDate: date, relatedToFile: null }, true);
					})
			);
			menu.showAtMouseEvent(e);
		});

		// Create card shells (content rendered lazily via IntersectionObserver)
		for (const moment of moments) {
			this.createMomentCardShell(content, moment);
		}

		// Render implicit moments
		for (const implicit of implicitMoments) {
			this.renderImplicitMoment(content, implicit);
		}
	}

	/**
	 * Create the DOM shell for a moment card. Markdown content is deferred
	 * until the card scrolls into view (via IntersectionObserver).
	 */
	private createMomentCardShell(container: HTMLElement, moment: Moment): void {
		const card = container.createEl('div', { cls: 'moments-card' });

		// Card header with title (plain text initially)
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

		// Placeholder content area (filled when visible)
		card.createEl('div', { cls: 'moments-card-content' });

		// Click card to open moment
		card.addEventListener('click', () => {
			void this.openMoment(moment);
		});

		// Register for lazy rendering
		this.pendingCardRenders.set(card, moment);
		this.cardObserver?.observe(card);
	}

	/**
	 * Render the full markdown content for a card that has scrolled into view.
	 */
	private async renderCardContent(card: HTMLElement, moment: Moment): Promise<void> {
		// Render title as markdown (replacing the plain text)
		const titleEl = card.querySelector('.moments-card-title');
		if (titleEl && moment.title) {
			titleEl.textContent = '';
			await MarkdownRenderer.render(
				this.app,
				moment.title,
				titleEl as HTMLElement,
				moment.filePath,
				this
			);
		}

		// Render body content
		const cardContent = card.querySelector('.moments-card-content');
		if (!cardContent) return;

		try {
			const content = await this.getMomentContent(moment);
			if (content) {
				await MarkdownRenderer.render(
					this.app,
					content,
					cardContent as HTMLElement,
					moment.filePath,
					this
				);
			} else {
				(cardContent as HTMLElement).createEl('em', {
					cls: 'moments-card-empty',
					text: 'No content',
				});
			}
		} catch (error) {
			debug('Failed to render moment content', { filePath: moment.filePath, error });
			(cardContent as HTMLElement).createEl('em', {
				cls: 'moments-card-error',
				text: 'Failed to load content',
			});
		}
	}

	private contentCacheKey(moment: Moment): string {
		return moment.type === 'standalone'
			? `${moment.filePath}:standalone`
			: `${moment.filePath}:${moment.headingLine}`;
	}

	private async getMomentContent(moment: Moment): Promise<string> {
		const cacheKey = this.contentCacheKey(moment);
		const cached = this.contentCache.get(cacheKey);
		if (cached !== undefined) {
			return cached;
		}

		const file = this.app.vault.getAbstractFileByPath(moment.filePath);
		if (!(file instanceof TFile)) {
			return '';
		}

		const fileContent = await this.app.vault.cachedRead(file);
		let content = '';

		if (moment.type === 'standalone') {
			content = fileContent;
		} else if (moment.headingLine !== undefined && moment.headingLevel !== undefined) {
			content = extractContentUnderHeading(
				fileContent,
				moment.headingLine,
				moment.headingLevel
			);
		}

		this.contentCache.set(cacheKey, content);
		return content;
	}

	invalidateContentCache(filePath: string): void {
		for (const key of this.contentCache.keys()) {
			if (key.startsWith(filePath + ':')) {
				this.contentCache.delete(key);
			}
		}
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
				this.pinned = true;
				this.updateHeader();
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

		emptyState.createEl('div', { cls: 'moments-empty-state-title', text: 'No moments yet' });

		emptyState.createEl('p', {
			text: 'Moments are date-linked entries in your notes. They can be inline headings with dates or standalone dated note files.',
		});

		const createBtn = emptyState.createEl('button', {
			cls: 'mod-cta',
			text: 'Create your first moment',
		});
		createBtn.addEventListener('click', () => {
			const app = this.app as typeof this.app & {
				commands: { executeCommandById: (id: string) => void };
			};
			app.commands.executeCommandById('moments:create-standalone');
		});
	}

	private async openMoment(moment: Moment): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(moment.filePath);
		if (!(file instanceof TFile)) {
			return;
		}

		this.pinned = true;
		this.updateHeader();
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

	// Public methods for filtering

	private applyFilter(updates: Partial<TimelineFilter>, pin = false): void {
		if (pin) {
			this.pinned = true;
		}
		Object.assign(this.filter, updates);
		this.updateHeader();
		void this.renderTimeline();
	}

	setDateFilter(startDate: string | null, endDate: string | null): void {
		if (this.pinned) {
			debug('Auto-follow skipped (filter pinned)');
			return;
		}
		debug('Setting date filter', { startDate, endDate });
		this.applyFilter({ startDate, endDate, relatedToFile: null });
	}

	setRelatedFilter(filePath: string): void {
		if (this.pinned) {
			debug('Auto-follow skipped (filter pinned)');
			return;
		}
		debug('Setting related filter', { filePath });
		this.applyFilter({ relatedToFile: filePath, startDate: null, endDate: null });
	}

	clearFilter(): void {
		debug('Clearing filter and unpinning');
		this.pinned = false;
		this.applyFilter({ startDate: null, endDate: null, relatedToFile: null });
	}

	refresh(): void {
		void this.renderTimeline();
	}
}
