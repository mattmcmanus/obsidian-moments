import { Plugin } from 'obsidian';
import { MomentsSettings, DEFAULT_SETTINGS } from './settings/settings';
import { MomentsSettingTab } from './settings/settings-tab';
import { registerCommands } from './commands/index';
import { RIBBON_ICON } from './constants';

/**
 * Moments plugin for Obsidian
 *
 * Unifies date-based note-taking with inline moments,
 * standalone dated notes, and a chronological timeline view.
 */
export default class MomentsPlugin extends Plugin {
	settings: MomentsSettings;

	async onload() {
		await this.loadSettings();

		// Register commands
		registerCommands(this);

		// Add ribbon icon with menu
		this.addRibbonIcon(RIBBON_ICON, 'Moments', (evt: MouseEvent) => {
			// Show a menu with options
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

			menu.showAtMouseEvent(evt);
		});

		// Add settings tab
		this.addSettingTab(new MomentsSettingTab(this.app, this));

		// TODO: Register timeline view
		// this.registerView(
		// 	TIMELINE_VIEW_TYPE,
		// 	(leaf) => new TimelineView(leaf, this)
		// );

		// TODO: Open timeline on startup if enabled
		// if (this.settings.openOnStartup) {
		// 	this.app.workspace.onLayoutReady(() => {
		// 		this.openTimeline();
		// 	});
		// }
	}

	onunload() {
		// Cleanup will be added as features are implemented
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
