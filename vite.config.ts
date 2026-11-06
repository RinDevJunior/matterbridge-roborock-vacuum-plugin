// eslint-disable
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
// vite.config.ts

// This Vitest configuration is designed for a TypeScript project.

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	resolve: { tsconfigPaths: true },
	test: {
		include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'scripts/**/*.test.mjs'],
		exclude: ['dist', 'node_modules', 'src/pluginTemplate/**', 'src/cli/**', 'src/cli.ts'],
		globals: true,
		clearMocks: true,
		restoreMocks: true,
		environment: 'node',
		maxWorkers: 100,
		coverage: {
			provider: 'v8', // default, but explicit
			reporter: ['text', 'lcov'],
			include: ['src/**/*.{ts,tsx,js,jsx}'],
			exclude: [
				// Exclude test files that may live under src
				'src/**/*.test.{ts,tsx,js,jsx}',
				'src/**/*.spec.{ts,tsx,js,jsx}',
				// Exclude helper file(s) not meant for coverage
				'src/tests/**/*.ts',
				// Exclude type declaration files
				'src/**/*.d.ts',
				// CLI entry points are excluded from coverage (matches codecov.yml ignore)
				'src/cli/**',
			],
			thresholds: {
				statements: 99,
				branches: 97,
				functions: 99,
				lines: 99,
			},
		},
	},
});
