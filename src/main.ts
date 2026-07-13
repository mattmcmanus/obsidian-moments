import { Plugin, TFile, WorkspaceLeaf, Menu, MenuItem, debounce } from 'obsidian';
import { MomentsSettings, DEFAULT_SETTINGS } from './settings/settings';
import { MomentsSettingTab } from './settings/settings-tab';
import { registerCommands } from './commands/index';
import { TimelineView } from './views/timeline-view';
import { RIBBON_ICON, TIMELINE_VIEW_TYPE, COMMANDS } from './constants';
import type { Moment, MomentCache, ImplicitMoment, TimelineFilter } from './types';
import {
	createMomentCache,
	replaceMomentsForFile,
	removeMomentsForFile,
	getMomentsForFile,
	getMomentsInDateRange,
	hasExplicitMoments,
	getAllDatesWithMoments,
} from './core/moment-cache';
import {
	scanFileForMoments,
	isStandaloneMoment,
	parseStandaloneFilename,
	createStandaloneMomentFromFile,
} from './core/moment-scanner';
import { parseHeadingForMoment } from './core/heading-parser';
import { formatDate } from './core/date-parser';
import {
	detectPeriodicNoteType,
	getDateRangeForPeriodicNote,
} from './core/periodic-detection';
import { findRelatedMoments, isFileRelatedByLinks } from './core/related-detection';
import { setDebugMode, debug, debugTimed, debugCacheStats } from './utils/debug';
import { getCommunityPlugin, getInternalPlugin } from './utils/obsidian-helpers';

/**
 * Moments plugin for Obsidian
 *
 * Unifies date-based note-taking with inline moments,
 * standalone dated notes, and a chronological timeline view.
 */
export default class MomentsPlugin extends Plugin {
	settings: MomentsSettings;
	private momentCache: MomentCache;
	private isScanning: boolean = false;
	private pendingFileChanges: Set<string> = new Set();
	private timelineRefreshPending: boolean = false;
	private implicitMomentsGeneration: number = 0;
	private implicitMomentsCache: {
		key: string;
		result: Map<string, ImplicitMoment[]>;
	} | null = null;

	// Debounced function to process pending file changes
	private processPendingChanges = debounce(
		() => {
			void this.processFileChangeBatch();
		},
		500,
		true
	);

	// Debounced timeline refresh
	private debouncedTimelineRefresh = debounce(
		() => {
			this.doTimelineRefresh();
		},
		300,
		true
	);

	async onload() {
		await this.loadSettings();

		// Initialize debug mode from settings
		setDebugMode(this.settings.debugMode);
		debug('Plugin loading');

		// Initialize cache
		this.momentCache = createMomentCache();

		// Register the timeline view
		this.registerView(TIMELINE_VIEW_TYPE, (leaf) => new TimelineView(leaf, this));

		// Register commands
		registerCommands(this);

		// Register timeline commands
		this.addCommand({
			id: COMMANDS.OPEN_TIMELINE,
			name: 'Open timeline',
			icon: RIBBON_ICON,
			callback: () => {
				void this.openTimeline('sidebar');
			},
		});

		this.addCommand({
			id: COMMANDS.OPEN_TIMELINE_TAB,
			name: 'Open timeline in new tab',
			icon: RIBBON_ICON,
			callback: () => {
				void this.openTimeline('tab');
			},
		});

		this.addCommand({
			id: COMMANDS.GO_TO_DATE,
			name: 'Go to date',
			icon: 'calendar-search',
			callback: () => {
				void this.openGoToDate();
			},
		});

		// Add ribbon icon with menu
		this.addRibbonIcon(RIBBON_ICON, 'Moments', (evt: MouseEvent) => {
			const menu = new Menu();

			menu.addItem((item: MenuItem) =>
				item
					.setTitle('Insert inline moment in current file')
					.setIcon('plus')
					.onClick(() => {
						this.executeCommand('moments:add-inline');
					})
			);

			menu.addItem((item: MenuItem) =>
				item
					.setTitle('Create new standalone moment')
					.setIcon('file-plus')
					.onClick(() => {
						this.executeCommand('moments:create-standalone');
					})
			);

			menu.addSeparator();

			menu.addItem((item: MenuItem) =>
				item
					.setTitle('Open timeline')
					.setIcon('calendar-clock')
					.onClick(() => {
						void this.openTimeline('sidebar');
					})
			);

			menu.showAtMouseEvent(evt);
		});

		// Add settings tab
		this.addSettingTab(new MomentsSettingTab(this.app, this));

		// Set up file event listeners for cache updates (debounced)
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					this.queueFileChange(file.path);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					this.queueFileChange(file.path);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					debug('File deleted', { path: file.path });
					removeMomentsForFile(this.momentCache, file.path);
					this.invalidateTimelineContentCache(file.path);
					this.implicitMomentsGeneration++;
					this.scheduleTimelineRefresh();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (file instanceof TFile && file.extension === 'md') {
					debug('File renamed', { from: oldPath, to: file.path });
					removeMomentsForFile(this.momentCache, oldPath);
					this.queueFileChange(file.path);
				}
			})
		);

		// Auto-filter timeline when opening notes
		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					this.handleFileOpen(file);
				}
			})
		);

		// Initial scan on layout ready
		this.app.workspace.onLayoutReady(() => {
			void this.scanVault().then(() => {
				// Open timeline on startup if enabled
				if (this.settings.openOnStartup) {
					void this.openTimeline(this.settings.defaultViewMode);
				}
			});
		});
	}

	private executeCommand(commandId: string): void {
		const app = this.app as typeof this.app & {
			commands: { executeCommandById: (id: string) => void };
		};
		app.commands.executeCommandById(commandId);
	}

	onunload() {
		// View is automatically cleaned up
	}

	async loadSettings(): Promise<void> {
		const loaded = (await this.loadData()) as Partial<MomentsSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded ?? {});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		// Update debug mode when settings change
		setDebugMode(this.settings.debugMode);
		debug('Settings saved');
	}

	/**
	 * Queue a file change for debounced processing.
	 */
	private queueFileChange(filePath: string): void {
		this.pendingFileChanges.add(filePath);
		this.processPendingChanges();
	}

	/**
	 * Process all pending file changes in a batch.
	 */
	private async processFileChangeBatch(): Promise<void> {
		if (this.pendingFileChanges.size === 0) return;

		const files = Array.from(this.pendingFileChanges);
		this.pendingFileChanges.clear();

		debug('Processing file change batch', { count: files.length });
		const done = debugTimed(`Processing ${files.length} file(s)`);

		for (const filePath of files) {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (file instanceof TFile) {
				// scanFile clears the file's prior moments before re-adding.
				await this.scanFile(file);
			}
			// Invalidate content cache for changed files
			this.invalidateTimelineContentCache(filePath);
		}

		done();
		this.logCacheStats();
		this.implicitMomentsGeneration++;

		// Schedule a single timeline refresh after batch processing
		this.scheduleTimelineRefresh();
	}

	/**
	 * Schedule a debounced timeline refresh.
	 */
	private scheduleTimelineRefresh(): void {
		this.timelineRefreshPending = true;
		this.debouncedTimelineRefresh();
	}

	/**
	 * Actually perform the timeline refresh.
	 */
	private doTimelineRefresh(): void {
		if (!this.timelineRefreshPending) return;
		this.timelineRefreshPending = false;

		const leaves = this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
		if (leaves.length === 0) {
			debug('Timeline refresh skipped - no views open');
			return;
		}

		debug('Refreshing timeline views', { count: leaves.length });
		for (const leaf of leaves) {
			if (leaf.view instanceof TimelineView) {
				leaf.view.refresh();
			}
		}
	}

	/**
	 * Invalidate timeline content cache for a specific file.
	 */
	private invalidateTimelineContentCache(filePath: string): void {
		const leaves = this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
		for (const leaf of leaves) {
			if (leaf.view instanceof TimelineView) {
				leaf.view.invalidateContentCache(filePath);
			}
		}
	}

	/**
	 * Log cache statistics for debugging.
	 */
	private logCacheStats(): void {
		debugCacheStats({
			totalMoments: Array.from(this.momentCache.byDate.values()).reduce(
				(sum, arr) => sum + arr.length,
				0
			),
			totalDates: this.momentCache.byDate.size,
			totalFiles: this.momentCache.byFile.size,
		});
	}

	/**
	 * Scan the entire vault for moments.
	 */
	async scanVault(): Promise<void> {
		if (this.isScanning) return;
		this.isScanning = true;

		const done = debugTimed('Full vault scan');

		try {
			const files = this.app.vault.getMarkdownFiles();
			debug('Scanning vault', { fileCount: files.length });

			for (const file of files) {
				await this.scanFile(file);
			}

			this.momentCache.lastScan = Date.now();
			done();
			this.logCacheStats();
		} finally {
			this.isScanning = false;
		}
	}

	/**
	 * Scan a single file for moments.
	 */
	private async scanFile(file: TFile): Promise<void> {
		// Collect this file's moments, then commit them through a single
		// replace so scanning is idempotent. Without replace semantics the
		// startup vault scan and the file-event batch can each add the same
		// moment, duplicating it in the timeline.
		const moments: Moment[] = [];

		// Check if it's a standalone moment
		if (isStandaloneMoment(file.name)) {
			const moment = createStandaloneMomentFromFile(
				file.path,
				file.name,
				file.stat.ctime
			);
			if (moment) {
				moments.push(moment);
			}
		}

		// Scan for inline moments using metadataCache (avoids file reads)
		try {
			const fileCache = this.app.metadataCache.getFileCache(file);
			if (fileCache?.headings) {
				const now = Date.now();
				const links = fileCache.links ?? [];
				for (const heading of fileCache.headings) {
					if (heading.level < 2) continue;
					const headingLine = '#'.repeat(heading.level) + ' ' + heading.heading;
					let parsed = parseHeadingForMoment(headingLine);

					// metadataCache strips wikilink brackets from heading text.
					// If standard parsing fails, check for date-formatted links on this line.
					if (!parsed) {
						const dateLink = links.find(
							(link) =>
								link.position.start.line === heading.position.start.line &&
								/^\d{4}-\d{2}-\d{2}$/.test(link.link)
						);
						if (dateLink) {
							const title = heading.heading
								.replace(dateLink.link, '')
								.replace(/\s+/g, ' ')
								.trim();
							parsed = {
								date: dateLink.link,
								title: title || null,
								level: heading.level,
							};
						}
					}

					if (parsed) {
						moments.push({
							type: 'inline',
							date: parsed.date,
							title: parsed.title,
							filePath: file.path,
							headingLevel: parsed.level,
							headingLine: heading.position.start.line,
							firstSeen: now,
						});
					}
				}
			} else {
				// Fallback: read file content if metadataCache not available
				const content = await this.app.vault.cachedRead(file);
				moments.push(...scanFileForMoments(content, file.path));
			}
		} catch (error) {
			debug(`Failed to scan file ${file.path}`, error);
		}

		replaceMomentsForFile(this.momentCache, file.path, moments);
		const momentsFound = moments.length;

		if (momentsFound > 0) {
			debug('Scanned file', { path: file.path, momentsFound });
		}
	}

	/**
	 * Get all moments belonging to a specific file (for active file indicator).
	 */
	getMomentsForActiveFile(filePath: string): Moment[] {
		return getMomentsForFile(this.momentCache, filePath);
	}

	/**
	 * Get moments for display in the timeline.
	 */
	getMomentsForDisplay(filter: TimelineFilter): Moment[] {
		debug('getMomentsForDisplay', { filter });

		let moments: Moment[];

		if (filter.startDate && filter.endDate) {
			moments = getMomentsInDateRange(
				this.momentCache,
				filter.startDate,
				filter.endDate
			);
			debug('Filtered moments retrieved', { count: moments.length });
		} else {
			// Return all moments
			const allDates = getAllDatesWithMoments(this.momentCache);
			moments = [];

			for (const date of allDates) {
				const dateMoments = this.momentCache.byDate.get(date);
				if (dateMoments) {
					moments.push(...dateMoments);
				}
			}

			debug('All moments retrieved', { count: moments.length });
		}

		// Apply related file filter
		if (filter.relatedToFile) {
			const targetFile = this.app.vault.getAbstractFileByPath(filter.relatedToFile);
			if (targetFile instanceof TFile) {
				moments = findRelatedMoments(this.app, moments, targetFile);
				debug('Related moments filtered', { count: moments.length });
			}
		}

		return moments;
	}

	/**
	 * Get implicit moments (files modified without explicit moments).
	 * Results are cached and invalidated when files change.
	 */
	getImplicitMomentsForDisplay(
		filter: TimelineFilter
	): Map<string, ImplicitMoment[]> {
		const cacheKey = [
			this.implicitMomentsGeneration,
			filter.startDate ?? '',
			filter.endDate ?? '',
			filter.relatedToFile ?? '',
		].join('|');

		if (this.implicitMomentsCache && this.implicitMomentsCache.key === cacheKey) {
			return this.implicitMomentsCache.result;
		}

		const result = new Map<string, ImplicitMoment[]>();
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			// Skip files with explicit moments
			if (hasExplicitMoments(this.momentCache, file.path)) {
				continue;
			}

			// When filtering by related file, only include files linked to/from the target
			if (filter.relatedToFile) {
				if (file.path === filter.relatedToFile) continue;
				if (!isFileRelatedByLinks(this.app, file.path, filter.relatedToFile)) continue;
			}

			const createdDate = formatDate(new Date(file.stat.ctime));
			const modifiedDate = formatDate(new Date(file.stat.mtime));

			// Check if within filter range
			const isInRange = (date: string) => {
				if (!filter.startDate || !filter.endDate) return true;
				return date >= filter.startDate && date <= filter.endDate;
			};

			// Add created entry
			if (isInRange(createdDate)) {
				if (!result.has(createdDate)) {
					result.set(createdDate, []);
				}
				result.get(createdDate)!.push({
					filePath: file.path,
					fileName: file.basename,
					action: 'created',
					date: createdDate,
					timestamp: file.stat.ctime,
				});
			}

			// Add modified entry if different from created
			if (modifiedDate !== createdDate && isInRange(modifiedDate)) {
				if (!result.has(modifiedDate)) {
					result.set(modifiedDate, []);
				}
				result.get(modifiedDate)!.push({
					filePath: file.path,
					fileName: file.basename,
					action: 'updated',
					date: modifiedDate,
					timestamp: file.stat.mtime,
				});
			}
		}

		// Sort within each day by timestamp (newest first)
		for (const [, implicit] of result) {
			implicit.sort((a, b) => b.timestamp - a.timestamp);
		}

		this.implicitMomentsCache = { key: cacheKey, result };
		return result;
	}

	/**
	 * Open the timeline view.
	 */
	async openTimeline(mode: 'sidebar' | 'tab' = 'sidebar'): Promise<void> {
		const { workspace } = this.app;

		// Check if already open
		const existingLeaves = workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
		if (existingLeaves.length > 0) {
			// Focus the existing view
			void workspace.revealLeaf(existingLeaves[0]!);
			return;
		}

		// Open new view
		let leaf: WorkspaceLeaf;

		if (mode === 'sidebar') {
			leaf = workspace.getRightLeaf(false)!;
		} else {
			leaf = workspace.getLeaf('tab')!;
		}

		await leaf.setViewState({
			type: TIMELINE_VIEW_TYPE,
			active: true,
		});

		void workspace.revealLeaf(leaf);
	}

	/**
	 * Open the timeline (if needed) and prompt for a date to jump to.
	 */
	async openGoToDate(): Promise<void> {
		await this.openTimeline(this.settings.defaultViewMode);

		const view = this.app.workspace
			.getLeavesOfType(TIMELINE_VIEW_TYPE)
			.map((leaf) => leaf.view)
			.find((v): v is TimelineView => v instanceof TimelineView);

		if (!view) {
			debug('Go to date: no timeline view found');
			return;
		}

		view.promptForDate();
	}

	/**
	 * Handle a file being opened - dispatch to periodic or related filter.
	 */
	private handleFileOpen(file: TFile): void {
		// Periodic note filter takes priority
		if (this.settings.autoFilterOnPeriodicNote) {
			const periodicHandled = this.handlePeriodicNoteOpen(file);
			if (periodicHandled) return;
		}

		// Standalone moment: filter to that day
		if (this.settings.autoFilterRelatedMoments) {
			const standaloneHandled = this.handleStandaloneMomentOpen(file);
			if (standaloneHandled) return;
		}

		// Regular notes: related moments filter
		if (this.settings.autoFilterRelatedMoments) {
			this.handleRelatedMomentsOpen(file);
		}
	}

	/**
	 * Handle opening a periodic note - auto-filter timeline if enabled.
	 * Returns true if a periodic note was detected and handled.
	 */
	private handlePeriodicNoteOpen(file: TFile): boolean {
		// Detect if this is a periodic note
		const periodicInfo = detectPeriodicNoteType(
			file.path,
			this.getPeriodicNotesFolder('daily'),
			this.settings.dateFormat
		);

		if (!periodicInfo) {
			return false;
		}

		// Get date range for this periodic note
		const range = getDateRangeForPeriodicNote(periodicInfo.type, periodicInfo.date);

		// Update timeline filter
		const leaves = this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
		for (const leaf of leaves) {
			if (leaf.view instanceof TimelineView) {
				leaf.view.setDateFilter(range.startDate, range.endDate);
			}
		}

		return true;
	}

	/**
	 * Handle opening a standalone moment file - auto-filter timeline to that day.
	 * Returns true if this was a standalone moment and was handled.
	 */
	private handleStandaloneMomentOpen(file: TFile): boolean {
		if (!isStandaloneMoment(file.name)) {
			return false;
		}

		const parsed = parseStandaloneFilename(file.name);
		if (!parsed) {
			return false;
		}

		debug('Auto-follow: standalone moment', { date: parsed.date });

		const leaves = this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
		for (const leaf of leaves) {
			if (leaf.view instanceof TimelineView) {
				leaf.view.setDateFilter(parsed.date, parsed.date);
			}
		}

		return true;
	}

	/**
	 * Handle opening a non-periodic note - auto-filter to related moments.
	 */
	private handleRelatedMomentsOpen(file: TFile): void {
		debug('Setting related filter', { file: file.path });

		// Always apply the related filter — if no moments match,
		// the timeline will show an empty state for this note
		const leaves = this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
		for (const leaf of leaves) {
			if (leaf.view instanceof TimelineView) {
				leaf.view.setRelatedFilter(file.path);
			}
		}
	}

	/**
	 * Get the folder for a specific periodic note type.
	 * Attempts to detect from Daily Notes or Periodic Notes plugins.
	 */
	private getPeriodicNotesFolder(type: 'daily' | 'weekly' | 'monthly'): string {
		interface PeriodicNotesSettings {
			daily?: { folder?: string };
			weekly?: { folder?: string };
			monthly?: { folder?: string };
		}

		// Try to get from Periodic Notes plugin
		const periodicNotes = getCommunityPlugin<{ settings?: PeriodicNotesSettings }>(this.app, 'periodic-notes');
		if (periodicNotes?.settings) {
			const settings = periodicNotes.settings;
			switch (type) {
				case 'daily':
					return settings.daily?.folder || '';
				case 'weekly':
					return settings.weekly?.folder || '';
				case 'monthly':
					return settings.monthly?.folder || '';
			}
		}

		// Try to get from core Daily Notes plugin
		const dailyNotes = getInternalPlugin(this.app, 'daily-notes');
		if (dailyNotes?.instance?.options && type === 'daily') {
			return (dailyNotes.instance.options['folder'] as string) || '';
		}

		return '';
	}
}
