// Obsidian bundles Moment.js and exposes it as `window.moment` at runtime.
// The plugin accesses it through this wrapper rather than
// `import { moment } from 'obsidian'`: Obsidian types that export as a
// namespace import, which TypeScript only treats as callable when
// `esModuleInterop` is false, so the direct import breaks editors and tooling
// that use the default (`true`). Reading `window.moment` is always callable and
// needs no `moment` dependency (which Obsidian's plugin guidelines discourage).
// See https://liamca.in/Obsidian/API+FAQ/third-party/use+momentjs

/** The subset of a Moment.js instance this plugin uses. */
interface MomentInstance {
	format(format: string): string;
	isValid(): boolean;
	toDate(): Date;
}

/** The subset of the Moment.js factory this plugin uses. */
interface MomentFactory {
	(input: Date | string, format?: string, strict?: boolean): MomentInstance;
}

/**
 * Obsidian's bundled Moment.js factory.
 *
 * @param input  A `Date`, or a date string to parse against `format`.
 * @param format Moment.js format tokens to parse a string `input` with.
 * @param strict Require the string `input` to match `format` exactly.
 */
export function moment(input: Date | string, format?: string, strict?: boolean): MomentInstance {
	return (window as unknown as { moment: MomentFactory }).moment(input, format, strict);
}
