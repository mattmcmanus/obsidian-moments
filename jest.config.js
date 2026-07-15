/** @type {import('jest').Config} */
export default {
	preset: 'ts-jest/presets/default-esm',
	testEnvironment: 'node',
	setupFiles: ['<rootDir>/__tests__/setup.ts'],
	roots: ['<rootDir>/src', '<rootDir>/__tests__'],
	testMatch: ['**/*.test.ts'],
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1',
		'^obsidian$': '<rootDir>/__tests__/__mocks__/obsidian.ts',
	},
	transform: {
		'^.+\\.tsx?$': [
			'ts-jest',
			{
				useESM: true,
			},
		],
	},
	extensionsToTreatAsEsm: ['.ts'],
	collectCoverageFrom: [
		'src/**/*.ts',
		'!src/main.ts',
		'!src/**/*.d.ts',
	],
	coverageDirectory: 'coverage',
	coverageReporters: ['text', 'lcov', 'html'],
};
