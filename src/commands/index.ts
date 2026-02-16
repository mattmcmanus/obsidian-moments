import type MomentsPlugin from '../main';
import { addInlineMoment } from './add-inline';
import { createStandaloneMoment } from './create-standalone';
import { COMMANDS } from '../constants';

/**
 * Register all plugin commands.
 */
export function registerCommands(plugin: MomentsPlugin): void {
	plugin.addCommand({
		id: COMMANDS.ADD_INLINE,
		name: 'Insert inline moment in current file',
		icon: 'plus',
		callback: () => {
			void addInlineMoment(plugin.app, plugin.settings);
		},
	});

	plugin.addCommand({
		id: COMMANDS.CREATE_STANDALONE,
		name: 'Create new standalone moment',
		icon: 'file-plus',
		callback: () => {
			void createStandaloneMoment(plugin.app, plugin.settings);
		},
	});
}
