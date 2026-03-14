import path from 'node:path';
import url from 'node:url';

import js from '@eslint/js';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import vitest from '@vitest/eslint-plugin';
import { defineConfig } from 'eslint/config';
import n from 'eslint-plugin-n';
import prettier from 'eslint-plugin-prettier/recommended';
import pluginSimpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

const sourceFiles = ['**/*.{js,mjs,cjs,ts,mts,cts}'];
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export default defineConfig([
	{
		name: 'Global Ignores',
		ignores: [
			'dist/',
			'build/',
			'node_modules/',
			'coverage/',
			'exampleData/',
			'web-for-testing/',
			'vite.config.ts',
			'report/',
			'.claude/',
			'misc/',
		],
	},
	{ ...js.configs.recommended, files: sourceFiles },
	// ...tseslint.configs.strict.map((config) => ({ ...config, files: sourceFiles })),
	...tseslint.configs.stylistic.map((config) => ({ ...config, files: sourceFiles })),
	// ...tseslint.configs.strictTypeChecked,
	...tseslint.configs.strictTypeChecked.map((config) => ({ ...config, files: sourceFiles })),
	{ ...n.configs['flat/recommended-script'], files: sourceFiles },
	prettier,
	{
		name: 'JavaScript & TypeScript Source Files',
		files: sourceFiles,
		languageOptions: {
			sourceType: 'module',
			ecmaVersion: 'latest',
		},
		linterOptions: {
			reportUnusedDisableDirectives: 'error', // Report unused eslint-disable directives
			reportUnusedInlineConfigs: 'error', // Report unused eslint-disable-line directives
		},
		plugins: {
			js,
			n,
			'simple-import-sort': pluginSimpleImportSort,
		},
		extends: ['js/recommended'],
		rules: {
			'no-console': 'warn', // Warn on console usage
			'no-undef': 'off',
			'spaced-comment': ['error', 'always'], // Require space after comment markers. Deprecated, but we still want to enforce it cause it's not handled by Prettier
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					'args': 'none',
					'varsIgnorePattern': '^_',
				},
			],
			'no-unused-vars': 'warn', // Use the base rule for unused variables
			'simple-import-sort/imports': ['warn'],
			'simple-import-sort/exports': ['warn'],
			'n/prefer-node-protocol': 'error', // Prefer using 'node:' protocol for built-in modules
			'n/no-unsupported-features/node-builtins': ['error', { ignores: ['fetch'] }],
			'n/no-extraneous-import': 'off', // Allow imports from node_modules
			'n/no-unpublished-import': 'off', // Allow imports from unpublished packages
			'n/no-missing-import': 'off', // Allow subpath imports from peer dependencies
			'prettier/prettier': 'warn', // Use Prettier for formatting
			'@typescript-eslint/no-unnecessary-condition': 'off',
			'@typescript-eslint/restrict-template-expressions': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/unbound-method': 'off',
			'@typescript-eslint/no-floating-promises': 'off',
			'@typescript-eslint/require-await': 'off',
			'@typescript-eslint/no-misused-promises': 'off',
			'@typescript-eslint/no-unsafe-enum-comparison': 'off',
			'@typescript-eslint/no-useless-default-assignment': 'off',
			'@typescript-eslint/no-misused-spread': 'off',
			'@typescript-eslint/no-confusing-void-expression': 'off',
		},
	},
	{
		name: 'JavaScript Source Files',
		files: ['**/*.{js,mjs,cjs}'],
		extends: [tseslint.configs.disableTypeChecked],
	},
	{
		name: 'TypeScript Source Files',
		files: ['**/*.ts'],
		ignores: ['**/tests/**/*.ts'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			parser: tseslint.parser,
			parserOptions: {
				tsconfigRootDir: __dirname,
				project: './tsconfig.json',
			},
		},
		rules: {
			'no-redeclare': 'off', // Disable no-redeclare for TypeScript files since TypeScript already checks for redeclarations
			'no-undef': 'off', // Disable no-undef for TypeScript files since TypeScript already checks for undefined variables
			'no-unused-vars': 'off', // Disable base rule for unused variables and use the TypeScript-specific rule instead
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					vars: 'all',
					args: 'none',
					ignoreRestSiblings: true,
					varsIgnorePattern: '^_', // Ignore unused variables starting with _
					caughtErrorsIgnorePattern: '^_', // Ignore unused caught errors starting with _
				},
			],
			// Eventually we want to enable these rules, but they may cause many errors
			// '@typescript-eslint/no-floating-promises': 'error',
			// '@typescript-eslint/no-misused-promises': 'error',
			// '@typescript-eslint/require-await': 'warn',
		},
	},
	{
		name: 'Vitest Test Files',
		files: ['**/tests/**/*.ts'],
		languageOptions: {
			sourceType: 'module',
			ecmaVersion: 'latest',
			parser: tseslint.parser,
			parserOptions: {
				tsconfigRootDir: __dirname,
				project: './tsconfig.vitest.json',
			},
		},
		plugins: { vitest },
		rules: {
			'no-unused-vars': 'off', // Disable base rule for unused variables in test files
			'@typescript-eslint/no-unused-vars': 'off', // Disable TypeScript rule for unused variables in test files
			'@typescript-eslint/no-explicit-any': 'off', // Allow 'any' type in test files
			'@typescript-eslint/no-empty-function': 'off', // Allow empty functions in test files
			'@typescript-eslint/no-floating-promises': 'off', // Allow floating promises in tests
			'@typescript-eslint/require-await': 'off', // Allow async without await in tests
			'@typescript-eslint/no-deprecated': 'off', // Allow testing deprecated methods

			'@typescript-eslint/no-confusing-void-expression': 'off',
			'@typescript-eslint/no-unnecessary-type-assertion': 'off',
			'@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
			'@typescript-eslint/no-misused-spread': 'off',
			'@typescript-eslint/no-unnecessary-type-parameters': 'off',

			...vitest.configs.recommended.rules,
		},
	},
	{
		name: 'CLI file',
		files: ['src/cli.ts'],
		rules: {
			'no-console': 'off',
			'n/no-process-exit': 'off',
		},
	},
	{
		name: 'JSON Files',
		files: ['**/*.json'],
		ignores: ['**/devcontainer.json'], // Ignore devcontainer.json files
		plugins: { json },
		language: 'json/json',
		rules: {
			'json/no-duplicate-keys': 'error',
		},
	},
	{
		name: 'JSONC files',
		files: ['**/devcontainer.json', '**/*.jsonc'],
		plugins: { json },
		language: 'json/jsonc',
	},
	{
		name: 'Markdown Files',
		files: ['**/*.md'],
		plugins: { markdown },
		language: 'markdown/commonmark',
		rules: {
			'markdown/no-html': 'off', // Allow HTML in Markdown files
		},
	},
]);
