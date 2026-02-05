import { App, FuzzySuggestModal, TFile, TFolder } from 'obsidian';

/**
 * Get the templates folder path from core Templates plugin or Templater.
 */
export function getTemplatesFolder(app: App): string | null {
	// Try core Templates plugin
	const coreTemplates = app as App & {
		internalPlugins?: {
			getPluginById?: (id: string) => {
				enabled?: boolean;
				instance?: { options?: { folder?: string } };
			} | undefined;
		};
	};

	const templatesPlugin = coreTemplates.internalPlugins?.getPluginById?.('templates');
	if (templatesPlugin?.enabled && templatesPlugin.instance?.options?.folder) {
		return templatesPlugin.instance.options.folder;
	}

	// Try Templater community plugin
	const communityPlugins = app as App & {
		plugins?: {
			getPlugin?: (id: string) => {
				settings?: { templates_folder?: string };
			} | undefined;
		};
	};

	const templater = communityPlugins.plugins?.getPlugin?.('templater-obsidian');
	if (templater?.settings?.templates_folder) {
		return templater.settings.templates_folder;
	}

	return null;
}

/**
 * Get all template files from the templates folder.
 */
export function getTemplateFiles(app: App): TFile[] {
	const templatesFolder = getTemplatesFolder(app);
	if (!templatesFolder) {
		return [];
	}

	const folder = app.vault.getAbstractFileByPath(templatesFolder);
	if (!(folder instanceof TFolder)) {
		return [];
	}

	const templates: TFile[] = [];
	collectTemplateFiles(folder, templates);
	return templates;
}

function collectTemplateFiles(folder: TFolder, templates: TFile[]): void {
	for (const child of folder.children) {
		if (child instanceof TFile && child.extension === 'md') {
			templates.push(child);
		} else if (child instanceof TFolder) {
			collectTemplateFiles(child, templates);
		}
	}
}

/**
 * Check if Templater plugin is available.
 */
export function isTemplaterAvailable(app: App): boolean {
	const communityPlugins = app as App & {
		plugins?: {
			getPlugin?: (id: string) => unknown;
		};
	};

	return !!communityPlugins.plugins?.getPlugin?.('templater-obsidian');
}

/**
 * Apply a template using Templater if available, otherwise use core insert.
 */
export async function applyTemplate(app: App, file: TFile, templateFile: TFile): Promise<void> {
	// Try Templater first for dynamic templates
	if (isTemplaterAvailable(app)) {
		const communityPlugins = app as App & {
			plugins?: {
				getPlugin?: (id: string) => {
					templater?: {
						append_template_to_active_file?: (template: TFile) => Promise<void>;
						write_template_to_file?: (template: TFile, file: TFile) => Promise<void>;
					};
				};
			};
		};

		const templater = communityPlugins.plugins?.getPlugin?.('templater-obsidian');
		if (templater?.templater?.write_template_to_file) {
			await templater.templater.write_template_to_file(templateFile, file);
			return;
		}
	}

	// Fallback: read template content and write to file
	const templateContent = await app.vault.read(templateFile);
	await app.vault.modify(file, templateContent);
}

/**
 * Modal for selecting a template file.
 */
export class TemplateSuggesterModal extends FuzzySuggestModal<TFile | null> {
	private templates: TFile[];
	private onChoose: (template: TFile | null) => void;

	constructor(app: App, onChoose: (template: TFile | null) => void) {
		super(app);
		this.templates = getTemplateFiles(app);
		this.onChoose = onChoose;
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- technical instruction
		this.setPlaceholder('Choose a template (press Esc to skip)');
		this.setInstructions([
			{ command: '↑↓', purpose: 'to navigate' },
			{ command: '↵', purpose: 'to select' },
			{ command: 'esc', purpose: 'to skip' },
		]);
	}

	getItems(): (TFile | null)[] {
		return [null, ...this.templates];
	}

	getItemText(item: TFile | null): string {
		if (item === null) {
			return 'None';
		}
		// Show relative path from templates folder
		const templatesFolder = getTemplatesFolder(this.app);
		if (templatesFolder && item.path.startsWith(templatesFolder)) {
			return item.path.slice(templatesFolder.length + 1).replace(/\.md$/, '');
		}
		return item.basename;
	}

	onChooseItem(item: TFile | null): void {
		this.onChoose(item);
	}

	onClose(): void {
		// If closed without selection, treat as "no template"
		// The FuzzySuggestModal calls onChooseItem before onClose when an item is selected
	}
}

/**
 * Check if templates are available (either from core plugin or Templater).
 */
export function hasTemplatesAvailable(app: App): boolean {
	return getTemplateFiles(app).length > 0;
}
