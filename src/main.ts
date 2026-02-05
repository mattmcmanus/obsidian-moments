import { Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { MomentsSettings, DEFAULT_SETTINGS } from './settings/settings';
import { MomentsSettingTab } from './settings/settings-tab';
import { registerCommands } from './commands/index';
import { TimelineView } from './views/timeline-view';
import { RIBBON_ICON, TIMELINE_VIEW_TYPE, COMMANDS } from './constants';
import type { Moment, MomentCache, ImplicitMoment, TimelineFilter } from './types';
import {
	createMomentCache,
	addMomentToCache,
	removeMomentsForFile,
	getMomentsInDateRange,
	hasExplicitMoments,
	getAllDatesWithMoments,
} from './core/moment-cache';
import {
	scanFileForMoments,
	isStandaloneMoment,
	createStandaloneMomentFromFile,
} from './core/moment-scanner';
import { formatDate } from './core/date-parser';
import {
	detectPeriodicNoteType,
	getDateRangeForPeriodicNote,
} from './core/periodic-detection';

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

	async onload() {
		await this.loadSettings();

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
			callback: () => this.openTimeline('sidebar'),
		});

		this.addCommand({
			id: COMMANDS.OPEN_TIMELINE_TAB,
			name: 'Open timeline in new tab',
			callback: () => this.openTimeline('tab'),
		});

		this.addCommand({
			id: COMMANDS.GO_TO_TODAY,
			name: 'Go to today',
			callback: () => this.goToToday(),
		});

		// Add ribbon icon with menu
		this.addRibbonIcon(RIBBON_ICON, 'Moments', (evt: MouseEvent) => {
			const menu = new (require('obsidian').Menu)();

			menu.addItem((item: any) =>
				item
					.setTitle('Insert moment in current file')
					.setIcon('plus')
					.onClick(() => {
						(this.app as any).commands.executeCommandById('moments:add-inline');
					})
			);

			menu.addItem((item: any) =>
				item
					.setTitle('Create new moment note')
					.setIcon('file-plus')
					.onClick(() => {
						(this.app as any).commands.executeCommandById('moments:create-standalone');
					})
			);

			menu.addSeparator();

			menu.addItem((item: any) =>
				item
					.setTitle('Open timeline')
					.setIcon('calendar-clock')
					.onClick(() => this.openTimeline('sidebar'))
			);

			menu.showAtMouseEvent(evt);
		});

		// Add settings tab
		this.addSettingTab(new MomentsSettingTab(this.app, this));

		// Set up file event listeners for cache updates
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					this.handleFileChange(file);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					this.handleFileChange(file);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					removeMomentsForFile(this.momentCache, file.path);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (file instanceof TFile && file.extension === 'md') {
					removeMomentsForFile(this.momentCache, oldPath);
					this.handleFileChange(file);
				}
			})
		);

		// Auto-filter timeline when opening periodic notes
		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				if (
					file instanceof TFile &&
					file.extension === 'md' &&
					this.settings.autoFilterOnPeriodicNote
				) {
					this.handlePeriodicNoteOpen(file);
				}
			})
		);

		// Initial scan on layout ready
		this.app.workspace.onLayoutReady(async () => {
			await this.scanVault();

			// Open timeline on startup if enabled
			if (this.settings.openOnStartup) {
				this.openTimeline(this.settings.defaultViewMode);
			}
		});
	}

	onunload() {
		// View is automatically cleaned up
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Scan the entire vault for moments.
	 */
	async scanVault(): Promise<void> {
		if (this.isScanning) return;
		this.isScanning = true;

		try {
			const files = this.app.vault.getMarkdownFiles();

			for (const file of files) {
				await this.scanFile(file);
			}

			this.momentCache.lastScan = Date.now();
		} finally {
			this.isScanning = false;
		}
	}

	/**
	 * Scan a single file for moments.
	 */
	private async scanFile(file: TFile): Promise<void> {
		// Check if it's a standalone moment
		if (isStandaloneMoment(file.name)) {
			const moment = createStandaloneMomentFromFile(
				file.path,
				file.name,
				file.stat.ctime
			);
			if (moment) {
				addMomentToCache(this.momentCache, moment);
			}
		}

		// Scan file content for inline moments
		try {
			const content = await this.app.vault.read(file);
			const moments = scanFileForMoments(content, file.path);
			for (const moment of moments) {
				addMomentToCache(this.momentCache, moment);
			}
		} catch (error) {
			console.error(`Failed to scan file ${file.path}:`, error);
		}
	}

	/**
	 * Handle file changes by re-scanning the file.
	 */
	private async handleFileChange(file: TFile): Promise<void> {
		// Remove existing moments for this file
		removeMomentsForFile(this.momentCache, file.path);

		// Re-scan the file
		await this.scanFile(file);

		// Refresh timeline view if open
		this.refreshTimelineView();
	}

	/**
	 * Refresh the timeline view if it's open.
	 */
	private refreshTimelineView(): void {
		const leaves = this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
		for (const leaf of leaves) {
			const view = leaf.view as TimelineView;
			view.refresh();
		}
	}

	/**
	 * Get moments for display in the timeline.
	 */
	getMomentsForDisplay(filter: TimelineFilter): Moment[] {
		if (filter.startDate && filter.endDate) {
			return getMomentsInDateRange(
				this.momentCache,
				filter.startDate,
				filter.endDate
			);
		}

		// Return all moments
		const allDates = getAllDatesWithMoments(this.momentCache);
		const moments: Moment[] = [];

		for (const date of allDates) {
			const dateMoments = this.momentCache.byDate.get(date);
			if (dateMoments) {
				moments.push(...dateMoments);
			}
		}

		return moments;
	}

	/**
	 * Get implicit moments (files created/modified without explicit moments).
	 */
	async getImplicitMomentsForDisplay(
		filter: TimelineFilter,
		explicitMomentsByDate: Map<string, Moment[]>
	): Promise<Map<string, ImplicitMoment[]>> {
		const result = new Map<string, ImplicitMoment[]>();
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			// Skip files with explicit moments
			if (hasExplicitMoments(this.momentCache, file.path)) {
				continue;
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
		for (const [date, implicit] of result) {
			implicit.sort((a, b) => b.timestamp - a.timestamp);
		}

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
			workspace.revealLeaf(existingLeaves[0]!);
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

		workspace.revealLeaf(leaf);
	}

	/**
	 * Jump timeline to today.
	 */
	goToToday(): void {
		const leaves = this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
		if (leaves.length > 0) {
			const view = leaves[0]!.view as TimelineView;
			view.goToToday();
		} else {
			// Open timeline first, then go to today
			this.openTimeline().then(() => {
				const newLeaves = this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
				if (newLeaves.length > 0) {
					const view = newLeaves[0]!.view as TimelineView;
					view.goToToday();
				}
			});
		}
	}

	/**
	 * Handle opening a periodic note - auto-filter timeline if enabled.
	 */
	private handlePeriodicNoteOpen(file: TFile): void {
		// Detect if this is a periodic note
		const periodicInfo = detectPeriodicNoteType(
			file.path,
			this.getPeriodicNotesFolder('daily'),
			this.settings.dateFormat
		);

		if (!periodicInfo) {
			return;
		}

		// Get date range for this periodic note
		const range = getDateRangeForPeriodicNote(periodicInfo.type, periodicInfo.date);

		// Update timeline filter
		const leaves = this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
		for (const leaf of leaves) {
			const view = leaf.view as TimelineView;
			view.setDateFilter(range.startDate, range.endDate);
		}
	}

	/**
	 * Get the folder for a specific periodic note type.
	 * Attempts to detect from Daily Notes or Periodic Notes plugins.
	 */
	private getPeriodicNotesFolder(type: 'daily' | 'weekly' | 'monthly'): string {
		// Try to get from Periodic Notes plugin
		const periodicNotes = (this.app as any).plugins?.getPlugin?.('periodic-notes');
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
		const dailyNotes = (this.app as any).internalPlugins?.getPluginById?.('daily-notes');
		if (dailyNotes?.instance?.options && type === 'daily') {
			return dailyNotes.instance.options.folder || '';
		}

		return '';
	}
}
