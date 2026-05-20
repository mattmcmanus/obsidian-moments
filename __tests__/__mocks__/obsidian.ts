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
