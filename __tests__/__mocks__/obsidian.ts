// Test mock for the `obsidian` module.
//
// The plugin imports `moment` from `obsidian` (Obsidian bundles Moment.js).
// Under Jest there is no real `obsidian` module, so re-export the standalone
// `moment` package instead — it is the same library Obsidian provides.
//
// `moment` is a CommonJS module. Depending on Jest's module mode the import
// is either the callable itself or a namespace whose `default` is callable,
// so resolve it defensively.
import * as momentImport from 'moment';

const resolved = momentImport as unknown as { default?: unknown };
export const moment = (
	typeof resolved.default === 'function' ? resolved.default : momentImport
) as typeof import('moment');

/**
 * Minimal `Notice` stand-in — records the message, performs no UI.
 */
export class Notice {
	message: string | DocumentFragment;
	constructor(message: string | DocumentFragment) {
		this.message = message;
	}
	setMessage(message: string | DocumentFragment): this {
		this.message = message;
		return this;
	}
	hide(): void {
		/* no-op in tests */
	}
}

/**
 * Test stand-in for Obsidian's `normalizePath`: collapse duplicate slashes
 * and strip leading/trailing slashes.
 */
export function normalizePath(path: string): string {
	return path
		.replace(/[\\/]+/g, '/')
		.replace(/^\/+|\/+$/g, '')
		.trim();
}
