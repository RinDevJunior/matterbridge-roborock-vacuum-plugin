import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { asType } from '../helpers/testUtils.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const CI_SCRIPT_PATTERN = /^node scripts\/[\w.-]+\.mjs( .*)?$/;
const SCRIPT_FILE_PATTERN = /scripts\/([\w.-]+\.mjs)/;
const FORBIDDEN_SHELL_TOKENS = ['>', '<', '|', ';', '&&', '||', 'sh -c', '$(', '`'];
const ENV_PREFIX_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*=/;

function loadPackageScripts(): Record<string, string> {
	const raw = readFileSync(join(REPO_ROOT, 'package.json'), 'utf8');
	return asType<{ scripts: Record<string, string> }>(JSON.parse(raw)).scripts;
}

function loadCiScriptEntries(): [string, string][] {
	return Object.entries(loadPackageScripts()).filter(([name]) => name.endsWith(':ci'));
}

describe('*:ci package.json scripts (Windows cmd.exe safety guard)', () => {
	it('should find at least one *:ci script when package.json is loaded', () => {
		// Arrange
		const entries = loadCiScriptEntries();

		// Act
		const count = entries.length;

		// Assert
		expect(count).toBeGreaterThan(0);
	});

	it('should use a single node scripts/<name>.mjs call for every *:ci script', () => {
		// Arrange
		const entries = loadCiScriptEntries();

		// Act
		const offenders = entries.filter(([, value]) => !CI_SCRIPT_PATTERN.test(value)).map(([name]) => name);

		// Assert
		expect(offenders).toEqual([]);
	});

	it('should contain no POSIX shell-only syntax in any *:ci script', () => {
		// Arrange
		const entries = loadCiScriptEntries();

		// Act
		const violations = entries.flatMap(([name, value]) => [
			...FORBIDDEN_SHELL_TOKENS.filter((token) => value.includes(token)).map((token) => `${name}: "${token}"`),
			...(ENV_PREFIX_PATTERN.test(value) ? [`${name}: env-var prefix`] : []),
		]);

		// Assert
		expect(violations).toEqual([]);
	});

	it('should reference only script files that exist on disk for every *:ci script', () => {
		// Arrange
		const entries = loadCiScriptEntries();

		// Act
		const missing = entries.flatMap(([name, value]) => {
			const match = value.match(SCRIPT_FILE_PATTERN);
			if (!match) {
				return [`${name}: no scripts/<file>.mjs reference`];
			}
			return existsSync(join(REPO_ROOT, 'scripts', match[1])) ? [] : [`${name}: scripts/${match[1]}`];
		});

		// Assert
		expect(missing).toEqual([]);
	});

	it('should map type-check:ci to the summary wrapper when package.json is loaded', () => {
		// Arrange
		const scripts = loadPackageScripts();

		// Act
		const value = scripts['type-check:ci'];

		// Assert
		expect(value).toBe('node scripts/run-type-check-summary.mjs');
	});
});
