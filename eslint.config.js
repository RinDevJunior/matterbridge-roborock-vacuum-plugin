// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';
import eslintPluginN from 'eslint-plugin-n';
import pluginVitest from '@vitest/eslint-plugin';

export default [
  {
    name: 'global ignores',
    ignores: ['dist/', 'build/', 'node_modules/', 'coverage/', 'frontend/', 'rock-s0/', 'webui/', 'exampleData/', '.shouldnotcommit/', 'web-for-testing/', 'pluginTemplate/'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  // ...tseslint.configs.strictTypeChecked,
  // ...tseslint.configs.stylisticTypeChecked,
  eslintPluginPrettier,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
    },
    rules: {
      'no-console': 'warn',
      'no-undef': 'off',
      'spaced-comment': ['error', 'always'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          'args': 'none',
        },
      ],
    },
  },
  {
    name: 'javascript',
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    name: 'typescript',
    files: ['**/*.ts'],
    ignores: ['**/__test__/*', '**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
  },
  {
    name: 'node',
    files: ['**/*.ts'],
    plugins: {
      n: eslintPluginN,
    },
    rules: {
      'n/prefer-node-protocol': 'error',
    },
  },
  {
    name: 'Vitest Test Files',
    files: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.jest.json', // Or your shared tsconfig
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
    plugins: {
      vitest: pluginVitest,
    },
    rules: {
      // Override/add rules specific to test files here
      'no-unused-vars': 'off', // Disable base rule for unused variables in test files
      '@typescript-eslint/no-unused-vars': 'off', // Disable TypeScript rule for unused variables in test files
      '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' type in test files
      '@typescript-eslint/no-empty-function': 'off', // Allow empty functions in test files
      'jsdoc/require-jsdoc': 'off', // Disable JSDoc rule in test files

      // Recommended Vitest rules
      ...pluginVitest.configs.recommended.rules,
    },
  },
];
