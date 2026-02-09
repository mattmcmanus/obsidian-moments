import type { App } from 'obsidian';

/**
 * Obsidian app with internal commands API.
 */
interface AppWithCommands extends App {
	commands: { executeCommandById: (id: string) => void };
}

/**
 * Execute an Obsidian command by its ID.
 */
export function executeCommand(app: App, commandId: string): void {
	(app as AppWithCommands).commands.executeCommandById(commandId);
}
