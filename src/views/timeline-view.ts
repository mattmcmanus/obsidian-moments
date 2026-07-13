import { ItemView, WorkspaceLeaf, TFile, MarkdownRenderer, Menu, MarkdownView, SettingGroup, setIcon } from 'obsidian';
import type MomentsPlugin from '../main';
import type { Moment, ImplicitMoment, TimelineFilter } from '../types';
import { TIMELINE_VIEW_TYPE } from '../constants';
import { formatDate } from '../core/date-parser';
import { extractContentUnderHeading } from '../core/content-extractor';
import { debug, debugTimed } from '../utils/debug';
import { getPreviousMonth, groupMomentsByDate, formatActiveFileIndicator, findMonthWithDates, hasDatesBefore } from '../core/timeline-helpers';
import { timelineRenderDecision } from '../core/timeline-fingerprint';
import { GoToDateModal } from '../ui/go-to-date-modal';

/**
 * Timeline view displaying moments grouped by day.
 */
export class TimelineView extends ItemView {
	plugin: MomentsPlugin;
	private timelineContentEl: HTMLElement;
	private headerTitleEl: HTMLElement;
	private headerSubtitleEl: HTMLElement;
	private clearFilterBtn: HTMLButtonElement;
	private goToDateBtn: HTMLButtonElement;
	private goToDateInput: HTMLInputElement;
	private configPanelEl: HTMLElement;
	private configOpen: boolean = false;
	private pinned = false;
	private pinnedBtn: HTMLButtonElement;
	private loadMoreObserver: IntersectionObserver | null = null;
	private loadMoreSentinel: HTMLElement | null = null;
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
	private activeFileMomentsByDate = new Map<string, Moment[]>();

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
		this.destroyLoadMoreObserver();
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

		// Hidden native date input, opened directly by the button below so
		// picking a date is a single interaction (no intermediate modal).
		// Kept rendered (not display:none) so showPicker() is permitted.
		this.goToDateInput = controls.createEl('input', {
			cls: 'moments-date-input',
			attr: { type: 'date', 'aria-hidden': 'true', tabindex: '-1' },
		});
		this.goToDateInput.addEventListener('change', () => {
			if (this.goToDateInput.value) {
				this.goToDate(this.goToDateInput.value);
			}
		});

		// Go to date button (only shown when no filter is active)
		this.goToDateBtn = controls.createEl('button', {
			cls: 'clickable-icon',
			attr: { 'aria-label': 'Go to date' },
		});
		setIcon(this.goToDateBtn, 'calendar-search');
		this.goToDateBtn.addEventListener('click', () => this.openGoToDate());

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
		// "Go to date" is a starting point from the unfiltered view; hide it
		// while a filter is active (clear the filter to bring it back).
		this.goToDateBtn.toggleClass('moments-hidden', !!hasFilter);
	}

	private toggleConfigPanel(): void {
		this.configOpen = !this.configOpen;
		this.configPanelEl.toggleClass('is-open', this.configOpen);
	}

	private buildConfigPanel(): void {
		// Render all options inside a single SettingGroup so they appear as one
		// cohesive group rather than separate items.
		const group = new SettingGroup(this.configPanelEl);

		group.addSetting((setting) => {
			setting.setName('Implicit moments').addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showImplicitMoments).onChange((value) => {
					this.plugin.settings.showImplicitMoments = value;
					void this.plugin.saveSettings();
					this.rebuildConfigPanel();
					void this.renderTimeline();
				})
			);
		});

		if (this.plugin.settings.showImplicitMoments) {
			group.addSetting((setting) => {
				setting.setName('Style').addDropdown((dropdown) =>
					dropdown
						.addOption('verbose', 'Verbose')
						.addOption('summary', 'Summary')
						.setValue(this.plugin.settings.implicitMomentsStyle)
						.onChange((value) => {
							this.plugin.settings.implicitMomentsStyle = value as 'verbose' | 'summary';
							void this.plugin.saveSettings();
							void this.renderTimeline();
						})
				);
			});
		}

		group.addSetting((setting) => {
			setting.setName('Auto-follow periodic notes').addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoFilterOnPeriodicNote).onChange((value) => {
					this.plugin.settings.autoFilterOnPeriodicNote = value;
					void this.plugin.saveSettings();
				})
			);
		});

		group.addSetting((setting) => {
			setting.setName('Auto-follow active file').addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoFilterRelatedMoments).onChange((value) => {
					this.plugin.settings.autoFilterRelatedMoments = value;
					void this.plugin.saveSettings();
				})
			);
		});
	}

	private rebuildConfigPanel(): void {
		this.configPanelEl.empty();
		this.buildConfigPanel();
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

		// Group active file's own moments by day (for indicator when related filter is active)
		this.activeFileMomentsByDate = new Map<string, Moment[]>();
		if (this.filter.relatedToFile) {
			const activeFileMoments = this.plugin.getMomentsForActiveFile(this.filter.relatedToFile);
			for (const m of activeFileMoments) {
				const existing = this.activeFileMomentsByDate.get(m.date) ?? [];
				existing.push(m);
				this.activeFileMomentsByDate.set(m.date, existing);
			}
		}

		// Skip the rebuild when nothing that affects the output changed.
		const decision = timelineRenderDecision(
			this.lastRenderFingerprint,
			{
				moments,
				implicitByDate,
				activeFileMomentsByDate: this.activeFileMomentsByDate,
				filter: this.filter,
				settings: {
					showImplicitMoments: this.plugin.settings.showImplicitMoments,
					implicitMomentsStyle: this.plugin.settings.implicitMomentsStyle,
				},
			},
			force
		);
		if (!decision.shouldRender) {
			debug('Timeline render skipped - data unchanged');
			done();
			return;
		}
		this.lastRenderFingerprint = decision.fingerprint;

		// Tear down previous render state
		this.destroyCardObserver();
		this.destroyLoadMoreObserver();
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
		const allDates = new Set([...this.groupedByDate.keys(), ...this.allImplicitByDate.keys(), ...this.activeFileMomentsByDate.keys()]);

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

		// Set up the observer that auto-loads older months
		this.setupLoadMoreObserver();

		// Determine which month to start with
		const startMonth = this.getStartMonth();

		// Load initial month
		this.loadMonth(startMonth);

		// Add the sentinel that triggers loading older months when scrolled near
		this.addLoadMoreSentinel();

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

	private loadMonth(month: string): void {
		if (this.loadedMonths.has(month)) {
			return;
		}

		// Search backward (up to 12 months) for a month that has dates.
		const result = findMonthWithDates(
			month,
			this.groupedByDate.keys(),
			this.allImplicitByDate.keys()
		);

		// Mark every inspected month as loaded so empty months aren't re-scanned.
		for (const visited of result.visitedMonths) {
			this.loadedMonths.add(visited);
			if (!this.oldestLoadedMonth || visited < this.oldestLoadedMonth) {
				this.oldestLoadedMonth = visited;
			}
		}

		// Render the days of the month that contained dates (newest first).
		for (const date of result.dates) {
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
		const allDates = new Set([...this.groupedByDate.keys(), ...this.allImplicitByDate.keys(), ...this.activeFileMomentsByDate.keys()]);
		const hasOlderDates = hasDatesBefore(allDates, this.oldestLoadedMonth);

		if (!hasOlderDates) {
			this.hasMoreMonths = false;
			this.removeLoadMoreSentinel();
			this.isLoadingMore = false;
			return;
		}

		// Load the previous month (skips back over empty months to find dates)
		this.loadMonth(prevMonthStr);

		this.isLoadingMore = false;

		// Keep the sentinel at the end so the observer can fire again if it
		// is still visible (e.g. the loaded month was short).
		this.repositionLoadMoreSentinel();
	}

	private setupLoadMoreObserver(): void {
		this.loadMoreObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						this.loadOlderMonth();
					}
				}
			},
			{ root: this.timelineContentEl, rootMargin: '300px 0px' }
		);
	}

	private destroyLoadMoreObserver(): void {
		if (this.loadMoreObserver) {
			this.loadMoreObserver.disconnect();
			this.loadMoreObserver = null;
		}
		this.loadMoreSentinel = null;
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

	private addLoadMoreSentinel(): void {
		this.removeLoadMoreSentinel();

		if (!this.hasMoreMonths) {
			return;
		}

		this.loadMoreSentinel = this.timelineContentEl.createEl('div', {
			cls: 'moments-load-sentinel',
		});
		this.loadMoreObserver?.observe(this.loadMoreSentinel);
	}

	/** Move the sentinel back to the end after older months are appended. */
	private repositionLoadMoreSentinel(): void {
		if (this.loadMoreSentinel && this.hasMoreMonths) {
			this.timelineContentEl.appendChild(this.loadMoreSentinel);
		}
	}

	private removeLoadMoreSentinel(): void {
		if (this.loadMoreSentinel) {
			this.loadMoreObserver?.unobserve(this.loadMoreSentinel);
			this.loadMoreSentinel.remove();
			this.loadMoreSentinel = null;
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

		// Active file moments indicator (when related filter is active)
		this.renderActiveFileIndicator(content, date);

		// Implicit moments (verbose or summary based on setting)
		if (this.plugin.settings.implicitMomentsStyle === 'verbose') {
			for (const implicit of implicitMoments) {
				this.renderImplicitMoment(content, implicit);
			}
		} else {
			this.renderImplicitSummary(content, implicitMoments);
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

	private renderImplicitSummary(container: HTMLElement, implicitMoments: ImplicitMoment[]): void {
		if (implicitMoments.length === 0) return;

		const el = container.createEl('div', { cls: 'moments-day-indicator' });

		// Deduplicate file names (guard against edge cases)
		const seen = new Set<string>();
		const deduplicated: ImplicitMoment[] = [];
		for (const implicit of implicitMoments) {
			if (!seen.has(implicit.filePath)) {
				seen.add(implicit.filePath);
				deduplicated.push(implicit);
			}
		}

		const fileNames = deduplicated.map((m) => m.fileName);

		if (fileNames.length <= 3) {
			// Show all names as clickable links
			for (const [i, imp] of deduplicated.entries()) {
				if (i > 0) {
					el.appendText(', ');
				}
				this.createImplicitFileLink(el, imp);
			}
			el.appendText(' modified');
		} else {
			// Show first 2 as links + "and X more modified"
			const first = deduplicated[0];
			const second = deduplicated[1];
			if (first) {
				this.createImplicitFileLink(el, first);
			}
			if (second) {
				el.appendText(', ');
				this.createImplicitFileLink(el, second);
			}
			el.appendText(`, and ${fileNames.length - 2} more modified`);
		}
	}

	private renderActiveFileIndicator(container: HTMLElement, date: string): void {
		const moments = this.activeFileMomentsByDate.get(date);
		if (!moments?.length || !this.filter.relatedToFile) return;

		const file = this.app.vault.getAbstractFileByPath(this.filter.relatedToFile);
		if (!(file instanceof TFile)) return;

		const text = formatActiveFileIndicator(moments.length, file.basename);
		const el = container.createEl('div', { cls: 'moments-day-indicator' });
		const link = el.createEl('a', {
			cls: 'moments-implicit-link',
			text,
		});
		const firstMoment = moments[0];
		if (!firstMoment) return;
		link.addEventListener('click', (e) => {
			e.preventDefault();
			// Open the file and scroll to the first moment for this day
			void this.openMoment(firstMoment);
		});
	}

	private createImplicitFileLink(container: HTMLElement, implicit: ImplicitMoment): void {
		const link = container.createEl('a', {
			cls: 'moments-implicit-link',
			text: implicit.fileName,
		});
		link.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			const file = this.app.vault.getAbstractFileByPath(implicit.filePath);
			if (file instanceof TFile) {
				this.pinned = true;
				this.updateHeader();
				void this.app.workspace.getLeaf().openFile(file);
			}
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

	/**
	 * Open the "Go to date" picker. Prefers the native OS date picker for a
	 * single-click experience, opened at the current date filter (if any).
	 * Falls back to a modal where showPicker() isn't available (e.g. mobile).
	 */
	openGoToDate(): void {
		const input = this.goToDateInput;
		if (input && typeof input.showPicker === 'function') {
			input.value = this.filter.startDate ?? formatDate(new Date());
			try {
				input.showPicker();
				return;
			} catch {
				// showPicker() can throw when not permitted/unsupported — fall
				// through to the modal below.
			}
		}
		this.openGoToDateModal();
	}

	private openGoToDateModal(): void {
		new GoToDateModal(this.app, {
			initialDate: this.filter.startDate ?? undefined,
			onSubmit: (isoDate) => this.goToDate(isoDate),
		}).open();
	}

	/**
	 * Jump the timeline to a specific day and pin the filter so it sticks
	 * (auto-follow won't override an explicit navigation).
	 */
	goToDate(isoDate: string): void {
		debug('Go to date', { isoDate });
		this.applyFilter({ startDate: isoDate, endDate: isoDate, relatedToFile: null }, true);
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
