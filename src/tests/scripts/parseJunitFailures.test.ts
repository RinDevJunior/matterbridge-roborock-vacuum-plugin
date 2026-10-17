import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const PARSER_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../../scripts/parse-junit-failures.mjs');
const REPORT_NAME = 'test-report.junit.xml';
const CRLF = '\r\n';

/** Join XML lines with CRLF to mimic a Windows checkout/report. */
function junit(...lines: string[]): string {
	return lines.join(CRLF) + CRLF;
}

function runParser(cwd: string) {
	return spawnSync(process.execPath, [PARSER_PATH], { cwd, encoding: 'utf8' });
}

describe('parse-junit-failures.mjs (CRLF-safe report parsing)', () => {
	let workDir: string;

	beforeEach(() => {
		workDir = mkdtempSync(join(tmpdir(), 'junit-parser-'));
	});

	afterEach(() => {
		rmSync(workDir, { recursive: true, force: true });
	});

	it('should print TESTS PASS and exit 0 when a CRLF report has no failures', () => {
		// Arrange
		writeFileSync(
			join(workDir, REPORT_NAME),
			junit(
				'<testsuites>',
				'<testsuite name="s">',
				'<testcase classname="suite" name="passes"/>',
				'</testsuite>',
				'</testsuites>',
			),
			'utf8',
		);
		// Act
		const result = runParser(workDir);
		// Assert
		expect(result.status).toBe(0);
		expect(result.stdout.trim()).toBe('TESTS PASS');
	});

	it('should report only the first line of a multi-line CRLF failure message', () => {
		// Arrange
		writeFileSync(
			join(workDir, REPORT_NAME),
			junit(
				'<testsuites>',
				'<testcase classname="suite" name="checks value">',
				'<failure message="Expected 1\r\n  at foo.test.ts:3" type="AssertionError"></failure>',
				'</testcase>',
				'</testsuites>',
			),
			'utf8',
		);
		// Act
		const result = runParser(workDir);
		// Assert
		const lines = result.stdout.split(/\r?\n/);
		expect(result.status).toBe(1);
		expect(lines).toContain('FAILED 1:');
		expect(lines).toContain('suite > checks value: Expected 1');
		expect(result.stdout).not.toContain('at foo.test.ts');
	});

	it('should decode XML entities in test names and failure messages', () => {
		// Arrange
		writeFileSync(
			join(workDir, REPORT_NAME),
			junit(
				'<testsuites>',
				'<testcase classname="suite" name="a &amp; b &lt;c&gt;">',
				'<failure message="x &quot;y&quot; &apos;z&apos;" type="AssertionError"></failure>',
				'</testcase>',
				'</testsuites>',
			),
			'utf8',
		);
		// Act
		const result = runParser(workDir);
		// Assert
		expect(result.stdout.split(/\r?\n/)).toContain(`suite > a & b <c>: x "y" 'z'`);
	});

	it('should exit 1 with a missing-report message when no report exists in the working directory', () => {
		// Act
		const result = runParser(workDir);
		// Assert
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('missing test-report.junit.xml');
	});
});
