import type { App } from 'obsidian';

/**
 * Typed augmentations for Obsidian's internal APIs.
 * Centralizes all internal API casts to avoid scattering them across the codebase.
 */

/** App with internal commands API. */
interface AppWithCommands extends App {
	commands: { executeCommandById: (id: string) => void };
}

/** App with community plugins API. */
export interface AppWithPlugins extends App {
	plugins?: {
		getPlugin?: (id: string) => Record<string, unknown> | undefined;
	};
}

/** App with internal plugins API. */
export interface AppWithInternalPlugins extends App {
	internalPlugins?: {
		getPluginById?: (id: string) => {
			enabled?: boolean;
			instance?: { options?: Record<string, unknown> };
		} | undefined;
	};
}

/**
 * Execute an Obsidian command by its ID.
 */
export function executeCommand(app: App, commandId: string): void {
	(app as AppWithCommands).commands.executeCommandById(commandId);
}

/**
 * Get a community plugin by ID, typed with the expected settings shape.
 */
export function getCommunityPlugin<T>(app: App, pluginId: string): T | undefined {
	const appWithPlugins = app as AppWithPlugins;
	return appWithPlugins.plugins?.getPlugin?.(pluginId) as T | undefined;
}

/**
 * Get an internal plugin by ID.
 */
export function getInternalPlugin(app: App, pluginId: string): {
	enabled?: boolean;
	instance?: { options?: Record<string, unknown> };
} | undefined {
	const appWithInternal = app as AppWithInternalPlugins;
	return appWithInternal.internalPlugins?.getPluginById?.(pluginId);
}
