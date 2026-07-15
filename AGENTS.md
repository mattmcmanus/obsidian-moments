# Obsidian community plugin

## Project overview

- Target: Obsidian Community Plugin (TypeScript → bundled JavaScript).
- Entry point: `main.ts` compiled to `main.js` and loaded by Obsidian.
- Required release artifacts: `main.js`, `manifest.json`, and optional `styles.css`.

## This project (Moments)

### Commands

```
npm run lint          # ESLint (typescript-eslint + obsidianmd)
npm test              # Jest (238 tests, 93%+ coverage)
npm run build         # TypeScript check + esbuild bundle
npm run dev           # esbuild watch mode
npm run deploy        # Build + copy to ~/notes vault
```

Always run `npm run lint && npm test && npm run build` after changes.

### Architecture

- `src/core/` — Pure functions, no Obsidian imports (fully testable)
- `src/views/timeline-view.ts` — Main timeline view (~600 lines)
- `src/commands/` — Command registration and handlers
- `src/settings/` — Settings types, defaults, UI tab
- `src/ui/` — Modals (moment creation, template picker)
- `src/utils/debug.ts` — Conditional debug logging
- `__tests__/` — Jest tests (core/ unit, integration/ with mocks)

### Obsidian ESLint gotchas

- Never assign default hotkeys to commands
- Use `console.debug` not `console.log`
- Use `textContent` not `innerHTML`
- Use `new Setting().setHeading()` not `containerEl.createEl('h2')`
- Pass `this` (view) not `this.plugin` to `MarkdownRenderer.render()`

### TypeScript patterns

- Use typed interface augmentation for internal plugin APIs (avoid `any`)
- Use `void` operator for floating promises in event handlers
- Use sync callbacks with `void asyncThing()` for Obsidian UI callbacks
- Cast vault for `getConfig`: `this.app.vault as Vault & { getConfig: ... }`

### Key design decisions

- Debounced file handling: 500ms batch, 300ms timeline refresh
- Month-based timeline pagination with 12-month backwards search
- Template integration: core Templates + Templater via typed interface augmentation
- Auto-follow / pinned filter model: timeline follows active file by default; manual filter actions pin the filter
- Day indicators: implicit moments grouped into "X, Y, and N more modified" summaries; active file indicator shows "N moments in File" when related filter is active
- See `docs/plans/2026-02-16 - Initial Plan.md` for full architecture

## Environment & tooling

- Node.js: use current LTS (Node 18+ recommended).
- Package manager: npm.
- Bundler: esbuild (`esbuild.config.mjs`).
- Types: `obsidian` type definitions.
- Do not commit build artifacts (`node_modules/`, `main.js`, etc.).
- Keep the plugin small. Avoid large dependencies. Prefer browser-compatible packages.

## Manifest rules (`manifest.json`)

- Must include (non-exhaustive):  
  - `id` (plugin ID; for local dev it should match the folder name)  
  - `name`  
  - `version` (Semantic Versioning `x.y.z`)  
  - `minAppVersion`  
  - `description`  
  - `isDesktopOnly` (boolean)  
  - Optional: `author`, `authorUrl`, `fundingUrl` (string or map)
- Never change `id` after release. Treat it as stable API.
- Keep `minAppVersion` accurate when using newer APIs.
- Canonical requirements are coded here: https://github.com/obsidianmd/obsidian-releases/blob/master/.github/workflows/validate-plugin-entry.yml

## Testing

- Manual install for testing: copy `main.js`, `manifest.json`, `styles.css` (if any) to:
  ```
  <Vault>/.obsidian/plugins/<plugin-id>/
  ```
- Reload Obsidian and enable the plugin in **Settings → Community plugins**.

## Commands & settings

- Any user-facing commands should be added via `this.addCommand(...)`.
- If the plugin has configuration, provide a settings tab and sensible defaults.
- Persist settings using `this.loadData()` / `this.saveData()`.
- Use stable command IDs; avoid renaming once released.

## Versioning & releases

**Releases are produced by the `.github/workflows/release.yml` workflow, which triggers on any pushed tag.** The workflow builds the plugin, attests build provenance for `main.js`/`styles.css` (this is what earns the "verified GitHub artifact attestation" marks on the community scorecard), and runs `gh release create` with the `dist/` assets attached. **Never run `gh release create` yourself** — doing so makes the workflow's create step fail with "a release with the same tag name already exists" and risks publishing an asset the attestation does not cover.

Release a new version from `main` (example: `0.5.1`):

1. **Bump the version** — `npm version 0.5.1 --no-git-tag-version`. This updates `package.json` and runs the `version` script (`version-bump.mjs`), which sets `manifest.json`'s `version` and appends to `versions.json` **only when `minAppVersion` changed** (the script skips `versions.json` when the current `minAppVersion` is already a value in it — so consecutive releases at the same `minAppVersion` correctly add no entry; do not "fix" this by hand).
2. **Verify** — `npm run lint && npm test && npm run build`.
3. **Commit** the bump to `main` with the version as the message (e.g. `0.5.1`), matching the existing history, and push `main`.
4. **Tag and push** — the tag must exactly match `manifest.json`'s `version`, with **no leading `v`**: `git tag 0.5.1 && git push origin 0.5.1`. This is what triggers the release workflow.
5. **Watch the workflow** — `gh run watch` (or `gh run list --workflow=release.yml`). When it completes it has created the GitHub release with `main.js`, `manifest.json`, and `styles.css` attached.
6. **Add release notes** — the workflow creates the release with an empty body, so add notes afterward: `gh release edit 0.5.1 --notes "..."`. Obsidian's scorecard flags a release with no description.

## Security, privacy, and compliance

Follow Obsidian's **Developer Policies** and **Plugin Guidelines**. In particular:

- Default to local/offline operation. Only make network requests when essential to the feature.
- No hidden telemetry. If you collect optional analytics or call third-party services, require explicit opt-in and document clearly in `README.md` and in settings.
- Never execute remote code, fetch and eval scripts, or auto-update plugin code outside of normal releases.
- Minimize scope: read/write only what's necessary inside the vault. Do not access files outside the vault.
- Clearly disclose any external services used, data sent, and risks.
- Respect user privacy. Do not collect vault contents, filenames, or personal information unless absolutely necessary and explicitly consented.
- Avoid deceptive patterns, ads, or spammy notifications.
- Register and clean up all DOM, app, and interval listeners using the provided `register*` helpers so the plugin unloads safely.

## UX & copy guidelines

- Use **bold** to indicate literal UI labels. Prefer "select" for interactions.
- Use arrow notation for navigation: **Settings → Community plugins**.
- Keep in-app strings short, consistent, and free of jargon.

## Coding conventions

- Keep `main.ts` minimal: lifecycle only, delegate to separate modules.
- Split large files: aim for single, well-defined responsibility per file.
- Bundle everything into `main.js` (no unbundled runtime deps).
- Avoid Node/Electron APIs if you want mobile compatibility; set `isDesktopOnly` accordingly.
- Keep startup light. Defer heavy work until needed; use lazy initialization.
- Write **evergreen** comments and PR/issue prose: describe what the code does now as timeless fact, not the journey to it. Cut temporal language ("previously", "no longer", "now we") and transient PR/sibling-change references; name the mechanism instead. A linked public GitHub issue (`#15`) is fine. Commit messages and `git log` are where chronology belongs. See `.claude/skills/evergreen-comments/SKILL.md`.

## Mobile

- Where feasible, test on iOS and Android.
- Don't assume desktop-only behavior unless `isDesktopOnly` is `true`.
- Avoid large in-memory structures; be mindful of memory and storage constraints.

## Agent do/don't

**Do**
- Add commands with stable IDs (don't rename once released).
- Provide defaults and validation in settings.
- Write idempotent code paths so reload/unload doesn't leak listeners or intervals.
- Use `this.register*` helpers for everything that needs cleanup.

**Don't**
- Introduce network calls without an obvious user-facing reason and documentation.
- Ship features that require cloud services without clear disclosure and explicit opt-in.
- Store or transmit vault contents unless essential and consented.

## Common tasks

### Organize code across multiple files

**main.ts** (minimal, lifecycle only):
```ts
import { Plugin } from "obsidian";
import { MySettings, DEFAULT_SETTINGS } from "./settings";
import { registerCommands } from "./commands";

export default class MyPlugin extends Plugin {
  settings: MySettings;

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    registerCommands(this);
  }
}
```

**settings.ts**:
```ts
export interface MySettings {
  enabled: boolean;
  apiKey: string;
}

export const DEFAULT_SETTINGS: MySettings = {
  enabled: true,
  apiKey: "",
};
```

**commands/index.ts**:
```ts
import { Plugin } from "obsidian";
import { doSomething } from "./my-command";

export function registerCommands(plugin: Plugin) {
  plugin.addCommand({
    id: "do-something",
    name: "Do something",
    callback: () => doSomething(plugin),
  });
}
```

### Add a command

```ts
this.addCommand({
  id: "your-command-id",
  name: "Do the thing",
  callback: () => this.doTheThing(),
});
```

### Persist settings

```ts
interface MySettings { enabled: boolean }
const DEFAULT_SETTINGS: MySettings = { enabled: true };

async onload() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  await this.saveData(this.settings);
}
```

### Register listeners safely

```ts
this.registerEvent(this.app.workspace.on("file-open", f => { /* ... */ }));
this.registerDomEvent(window, "resize", () => { /* ... */ });
this.registerInterval(window.setInterval(() => { /* ... */ }, 1000));
```

## Troubleshooting

- Plugin doesn't load after build: ensure `main.js` and `manifest.json` are at the top level of the plugin folder under `<Vault>/.obsidian/plugins/<plugin-id>/`. 
- Build issues: if `main.js` is missing, run `npm run build` or `npm run dev` to compile your TypeScript source code.
- Commands not appearing: verify `addCommand` runs after `onload` and IDs are unique.
- Settings not persisting: ensure `loadData`/`saveData` are awaited and you re-render the UI after changes.
- Mobile-only issues: confirm you're not using desktop-only APIs; check `isDesktopOnly` and adjust.

## References

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- API documentation: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Style guide: https://help.obsidian.md/style-guide
