// Test mock for the `obsidian` module.
//
// The plugin imports `moment` from `obsidian` (Obsidian bundles Moment.js).
// Under Jest there is no real `obsidian` module, so re-export the standalone
// `moment` package instead — it is the same library Obsidian provides.
import moment from 'moment';

export { moment };
