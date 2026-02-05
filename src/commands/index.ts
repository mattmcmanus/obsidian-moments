import type MomentsPlugin from '../main';
import { addInlineMoment } from './add-inline';
import { createStandaloneMoment } from './create-standalone';
import { COMMANDS, HOTKEYS } from '../constants';

/**
 * Register all plugin commands.
 */
export function registerCommands(plugin: MomentsPlugin): void {
	// Add inline moment command
	plugin.addCommand({
		id: COMMANDS.ADD_INLINE,
		name: 'Insert moment in current file',
		hotkeys: HOTKEYS.ADD_INLINE as any,
		callback: () => {
			addInlineMoment(plugin.app, plugin.settings);
		},
	});

	// Create standalone moment command
	plugin.addCommand({
		id: COMMANDS.CREATE_STANDALONE,
		name: 'Create new moment note',
		callback: () => {
			createStandaloneMoment(plugin.app, plugin.settings);
		},
	});

	// Timeline commands will be added when timeline view is implemented
	// plugin.addCommand({
	// 	id: COMMANDS.OPEN_TIMELINE,
	// 	name: 'Open timeline',
	// 	callback: () => {
	// 		// TODO: Open timeline in sidebar
	// 	},
	// });

	// plugin.addCommand({
	// 	id: COMMANDS.OPEN_TIMELINE_TAB,
	// 	name: 'Open timeline in new tab',
	// 	callback: () => {
	// 		// TODO: Open timeline in tab
	// 	},
	// });

	// plugin.addCommand({
	// 	id: COMMANDS.GO_TO_TODAY,
	// 	name: 'Go to today',
	// 	callback: () => {
	// 		// TODO: Jump timeline to today
	// 	},
	// });
}
