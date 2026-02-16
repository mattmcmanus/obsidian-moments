import { App, PluginSettingTab, Setting } from 'obsidian';
import type MomentsPlugin from '../main';

/**
 * Settings tab for the Moments plugin
 */
export class MomentsSettingTab extends PluginSettingTab {
	plugin: MomentsPlugin;

	constructor(app: App, plugin: MomentsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Date settings section
		new Setting(containerEl).setName('Dates').setHeading();

		new Setting(containerEl)
			.setName('Date format')
			.setDesc('Format for dates in headings and filenames. Auto-detected from daily notes if installed.')
			.addText((text) =>
				text
					.setValue(this.plugin.settings.dateFormat)
					.onChange(async (value) => {
						this.plugin.settings.dateFormat = value || 'YYYY-MM-DD';
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Date link style')
			.setDesc('How dates appear in headings')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('wikilink', 'Wiki-link [[2026-02-04]]')
					.addOption('plain', 'Plain text 2026-02-04')
					.setValue(this.plugin.settings.dateLinkStyle)
					.onChange(async (value) => {
						this.plugin.settings.dateLinkStyle = value as 'wikilink' | 'plain';
						await this.plugin.saveSettings();
					})
			);

		// Inline moment settings section
		new Setting(containerEl).setName('Inline entries').setHeading();

		new Setting(containerEl)
			.setName('Target section mode')
			.setDesc('Where to insert inline moments')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('specified', 'Under a specific section')
					.addOption('none', 'At cursor position')
					.setValue(this.plugin.settings.targetSectionMode)
					.onChange(async (value) => {
						this.plugin.settings.targetSectionMode = value as 'specified' | 'none';
						await this.plugin.saveSettings();
						this.display(); // Refresh to show/hide target section setting
					})
			);

		if (this.plugin.settings.targetSectionMode === 'specified') {
			new Setting(containerEl)
				.setName('Target section')
				.setDesc('The heading to insert moments under. Will be created if it does not exist.')
				.addText((text) =>
					text
						.setValue(this.plugin.settings.targetSection)
						.onChange(async (value) => {
							this.plugin.settings.targetSection = value || '## Notes';
							await this.plugin.saveSettings();
						})
				);
		}

		new Setting(containerEl)
			.setName('Insert position')
			.setDesc('Where to add new moments within the target section')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('prepend', 'At the beginning (newest first)')
					.addOption('append', 'At the end (oldest first)')
					.setValue(this.plugin.settings.insertPosition)
					.onChange(async (value) => {
						this.plugin.settings.insertPosition = value as 'prepend' | 'append';
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Heading level')
			.setDesc('The heading level for inline moments')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('2', 'H2 (##)')
					.addOption('3', 'H3 (###)')
					.addOption('4', 'H4 (####)')
					.addOption('5', 'H5 (#####)')
					.addOption('6', 'H6 (######)')
					.setValue(this.plugin.settings.headingLevel.toString())
					.onChange(async (value) => {
						this.plugin.settings.headingLevel = parseInt(value, 10);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Heading template')
			.setDesc('Template for the heading text. Variables: {{date}}, {{title}}, {{time}}')
			.addText((text) =>
				text
					.setPlaceholder('{{date}} {{title}}')
					.setValue(this.plugin.settings.headingTemplate)
					.onChange(async (value) => {
						this.plugin.settings.headingTemplate = value || '{{date}} {{title}}';
						await this.plugin.saveSettings();
					})
			);

		// Standalone moment settings section
		new Setting(containerEl).setName('Standalone notes').setHeading();

		new Setting(containerEl)
			.setName('Filename template')
			.setDesc('Template for note filenames. Variables: {{date}}, {{title}}')
			.addText((text) =>
				text
					.setPlaceholder('{{date}} - {{title}}')
					.setValue(this.plugin.settings.filenameTemplate)
					.onChange(async (value) => {
						this.plugin.settings.filenameTemplate = value || '{{date}} - {{title}}';
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Note template')
			.setDesc('Initial content for new standalone moment notes')
			.addTextArea((text) =>
				text
					.setPlaceholder('Leave empty for blank notes')
					.setValue(this.plugin.settings.noteTemplate)
					.onChange(async (value) => {
						this.plugin.settings.noteTemplate = value;
						await this.plugin.saveSettings();
					})
			);

		// Timeline settings section
		new Setting(containerEl).setName('Timeline').setHeading();

		new Setting(containerEl)
			.setName('Auto-filter on periodic notes')
			.setDesc('Automatically filter the timeline when viewing a daily, weekly, or monthly note')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoFilterOnPeriodicNote)
					.onChange(async (value) => {
						this.plugin.settings.autoFilterOnPeriodicNote = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Auto-filter on related notes')
			.setDesc('Automatically filter the timeline to show moments that reference the current note')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoFilterRelatedMoments)
					.onChange(async (value) => {
						this.plugin.settings.autoFilterRelatedMoments = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Show implicit moments')
			.setDesc('Show files created or modified on each day as secondary entries')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showImplicitMoments)
					.onChange(async (value) => {
						this.plugin.settings.showImplicitMoments = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Open on startup')
			.setDesc('Open the timeline view when Obsidian starts')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.openOnStartup)
					.onChange(async (value) => {
						this.plugin.settings.openOnStartup = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Default view mode')
			.setDesc('How to open the timeline by default')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('sidebar', 'Sidebar')
					.addOption('tab', 'New tab')
					.setValue(this.plugin.settings.defaultViewMode)
					.onChange(async (value) => {
						this.plugin.settings.defaultViewMode = value as 'sidebar' | 'tab';
						await this.plugin.saveSettings();
					})
			);

		// Advanced settings section
		new Setting(containerEl).setName('Advanced').setHeading();

		new Setting(containerEl)
			.setName('Debug mode')
			.setDesc('Log plugin activity to the developer console for troubleshooting')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.debugMode)
					.onChange(async (value) => {
						this.plugin.settings.debugMode = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
