# Moments - Obsidian Plugin

## Commands

```
npm run lint          # ESLint (typescript-eslint + obsidianmd)
npm test              # Jest (144 tests, 93%+ coverage)
npm run build         # TypeScript check + esbuild bundle
npm run dev           # esbuild watch mode
npm run deploy        # Build + copy to ~/notes vault
```

Always run `npm run lint && npm test && npm run build` after changes.

## Architecture

- `src/core/` — Pure functions, no Obsidian imports (fully testable)
- `src/views/timeline-view.ts` — Main timeline view (~600 lines)
- `src/commands/` — Command registration and handlers
- `src/settings/` — Settings types, defaults, UI tab
- `src/ui/` — Modals (moment creation, template picker)
- `src/utils/debug.ts` — Conditional debug logging
- `__tests__/` — Jest tests (core/ unit, integration/ with mocks)

## Obsidian ESLint Rules

- Never assign default hotkeys to commands
- Use `console.debug` not `console.log`
- Use `textContent` not `innerHTML`
- Use `new Setting().setHeading()` not `containerEl.createEl('h2')`
- Pass `this` (view) not `this.plugin` to `MarkdownRenderer.render()`
- All UI text must be sentence case

## TypeScript Patterns

- Use typed interface augmentation for internal plugin APIs (avoid `any`)
- Use `void` operator for floating promises in event handlers
- Use sync callbacks with `void asyncThing()` for Obsidian UI callbacks
- Cast vault for `getConfig`: `this.app.vault as Vault & { getConfig: ... }`

## Key Design Decisions

- Debounced file handling: 500ms batch, 300ms timeline refresh
- Month-based timeline pagination with 12-month backwards search
- Template integration: core Templates + Templater via typed interface augmentation
- See `docs/plans/2026-02-16 - Initial Plan.md` for full architecture
