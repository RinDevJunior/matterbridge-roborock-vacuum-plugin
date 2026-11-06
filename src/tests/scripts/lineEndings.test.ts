import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SCRIPTS_DIR = join(REPO_ROOT, 'scripts');
const GITATTRIBUTES_PATH = join(REPO_ROOT, '.gitattributes');

// Matches .split('\n') or .split("\n"). Scripts must use .split(/\r?\n/) so CRLF checkouts parse correctly.
const BAD_SPLIT_PATTERN = /\.split\(\s*(['"])\\n\1\s*\)/;

function findBadSplits(source: string, label: string): string[] {
	return source
		.split(/\r?\n/)
		.map((line, index) => ({ line, lineNumber: index + 1 }))
		.filter(({ line }) => BAD_SPLIT_PATTERN.test(line))
		.map(({ lineNumber }) => `${label}:${lineNumber}`);
}

function listScriptModules(): string[] {
	return readdirSync(SCRIPTS_DIR)
		.filter((name) => name.endsWith('.mjs'))
		.map((name) => join(SCRIPTS_DIR, name));
}

describe('line endings guard', () => {
	describe('scripts/*.mjs split usage', () => {
		it('should not split on a bare \\n literal in any scripts/*.mjs file', () => {
			// Arrange
			const modules = listScriptModules();
			// Act
			const violations = modules.flatMap((file) =>
				findBadSplits(readFileSync(file, 'utf8'), relative(REPO_ROOT, file)),
			);
			// Assert
			expect(violations, `Use .split(/\\r?\\n/) instead of .split('\\n') in:\n${violations.join('\n')}`).toEqual([]);
		});

		it('should scan at least one script module so the guard is not vacuous', () => {
			expect(listScriptModules().length).toBeGreaterThan(0);
		});
	});

	describe('guard regex self-check', () => {
		it("should flag a single-quoted .split('\\n') sample", () => {
			expect(BAD_SPLIT_PATTERN.test(String.raw`const lines = text.split('\n');`)).toBe(true);
		});

		it('should flag a double-quoted .split("\\n") sample', () => {
			expect(BAD_SPLIT_PATTERN.test(String.raw`const lines = text.split("\n");`)).toBe(true);
		});

		it('should not flag the approved .split(/\\r?\\n/) form', () => {
			expect(BAD_SPLIT_PATTERN.test(String.raw`const lines = text.split(/\r?\n/);`)).toBe(false);
		});

		it('should report the exact file:line of each bad split in a sample source', () => {
			// Arrange
			const sample = [
				'const ok = text.split(/\\r?\\n/);',
				"const bad = text.split('\\n');",
				'const bad2 = text.split("\\n");',
			].join('\n');
			// Act
			const violations = findBadSplits(sample, 'sample.mjs');
			// Assert
			expect(violations).toEqual(['sample.mjs:2', 'sample.mjs:3']);
		});
	});

	describe('.gitattributes', () => {
		it('should exist at the repo root', () => {
			expect(existsSync(GITATTRIBUTES_PATH)).toBe(true);
		});

		it('should declare * text=auto eol=lf', () => {
			// Arrange
			const lines = readFileSync(GITATTRIBUTES_PATH, 'utf8')
				.split(/\r?\n/)
				.map((line) => line.trim());
			// Act / Assert
			expect(lines).toContain('* text=auto eol=lf');
		});
	});
});
