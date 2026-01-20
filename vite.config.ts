// eslint-disable
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
// vite.config.ts

// This Vitest configuration is designed for a TypeScript project.

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['dist', 'node_modules', 'src/pluginTemplate/**'],
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
      ],
      thresholds: {
        statements: 75,
        branches: 75,
        functions: 75,
        lines: 75,
      },
    },
  },
});
