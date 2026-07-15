// Obsidian injects Moment.js as `window.moment` at runtime. The node test
// environment has no `window`, so provide it here using the same Moment.js
// build the obsidian mock exposes to the code under test.
import { moment } from './__mocks__/obsidian';

const globalWithWindow = globalThis as typeof globalThis & {
	window?: { moment: unknown };
};
globalWithWindow.window = globalWithWindow.window ?? { moment };
globalWithWindow.window.moment = moment;
