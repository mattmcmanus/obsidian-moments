import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.js',
						'eslint.config.mts',
						'manifest.json',
						'jest.config.js',
						'esbuild.config.mjs',
						'version-bump.mjs',
					]
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	...obsidianmd.configs.recommended,
	// Type-checked rules mirror Obsidian's automated plugin scorecard, which
	// runs typescript-eslint's type-aware checks (no-unsafe-*, no-unsafe-return).
	{
		files: ["src/**/*.ts", "__tests__/**/*.ts"],
		extends: [tseslint.configs.recommendedTypeChecked],
	},
	{
		files: ["src/**/*.ts"],
		linterOptions: {
			noInlineConfig: true,
		},
		plugins: {
			"@typescript-eslint": tseslint.plugin,
		},
		rules: {
			"@typescript-eslint/require-await": "error",
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"coverage",
		"main.js",
		"version-bump.mjs",
	]),
	// Relaxed rules for test files
	{
		files: ["__tests__/**/*.ts"],
		languageOptions: {
			globals: {
				describe: "readonly",
				it: "readonly",
				expect: "readonly",
				beforeEach: "readonly",
				afterEach: "readonly",
				beforeAll: "readonly",
				afterAll: "readonly",
				jest: "readonly",
			},
		},
		rules: {
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			// The obsidian mock must import the real `moment` package: it
			// cannot import from `obsidian` (it is the obsidian mock), and
			// `moment` is intentionally not a declared dependency — Obsidian
			// provides it at runtime. These rules police plugin source, not
			// test code.
			"no-restricted-imports": "off",
			"import/no-extraneous-dependencies": "off",
		},
	},
);
