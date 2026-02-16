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
		},
	},
);
