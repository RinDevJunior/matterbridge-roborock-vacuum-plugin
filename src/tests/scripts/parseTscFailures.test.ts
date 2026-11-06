import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const PARSER_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../../scripts/parse-tsc-failures.mjs');
const LOG_NAME = 'type-check.log';
const SINGLE_ERROR = 'src/a.ts(10,5): error TS2322: Type x is not assignable';
const SECOND_ERROR = 'src/b.ts(2,1): error TS2345: Argument is not assignable';

interface ParserRun {
	status: number | null;
	stdout: string;
	stderr: string;
}

function runParser(cwd: string): ParserRun {
	const result = spawnSync(process.execPath, [PARSER_PATH], { cwd, encoding: 'utf8' });
	return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function outputLines(stdout: string): string[] {
	return stdout.trimEnd().split(/\r?\n/);
}

describe('parse-tsc-failures.mjs', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), 'tsc-log-'));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it('should exit 1 with missing type-check.log message when no log exists', () => {
		// Arrange
		// (no type-check.log written in tempDir)

		// Act
		const run = runParser(tempDir);

		// Assert
		expect(run.status).toBe(1);
		expect(run.stderr).toContain('missing type-check.log');
	});

	it('should print TYPE-CHECK PASS and exit 0 when the log is empty', () => {
		// Arrange
		writeFileSync(join(tempDir, LOG_NAME), '');

		// Act
		const run = runParser(tempDir);

		// Assert
		expect(run.status).toBe(0);
		expect(run.stdout.trim()).toBe('TYPE-CHECK PASS');
	});

	it('should report FAILED 1 with the error line and exit 1 when the log has one LF-terminated error', () => {
		// Arrange
		writeFileSync(join(tempDir, LOG_NAME), `${SINGLE_ERROR}\nFound 1 error in src/a.ts:10\n`);

		// Act
		const run = runParser(tempDir);

		// Assert
		expect(run.status).toBe(1);
		expect(run.stdout.startsWith('FAILED 1:')).toBe(true);
		expect(run.stdout).toContain(SINGLE_ERROR);
	});

	it('should produce identical stdout and exit code when the log uses CRLF line endings', () => {
		// Arrange
		const lfContent = `${SINGLE_ERROR}\nFound 1 error in src/a.ts:10\n`;
		const crlfContent = lfContent.replace(/\n/g, '\r\n');
		writeFileSync(join(tempDir, LOG_NAME), lfContent);
		const lfRun = runParser(tempDir);

		// Act
		writeFileSync(join(tempDir, LOG_NAME), crlfContent);
		const crlfRun = runParser(tempDir);

		// Assert
		expect(crlfRun.status).toBe(lfRun.status);
		expect(crlfRun.stdout).toBe(lfRun.stdout);
		expect(crlfRun.stdout.startsWith('FAILED 1:')).toBe(true);
	});

	it('should count a bare error TS line without a file location as a failure and exit 1', () => {
		// Arrange
		writeFileSync(join(tempDir, LOG_NAME), 'error TS5112: tsconfig.json is not valid\n');

		// Act
		const run = runParser(tempDir);

		// Assert
		expect(run.status).toBe(1);
		expect(run.stdout).toContain('FAILED 1:');
		expect(run.stdout).toContain('error TS5112: tsconfig.json is not valid');
	});

	it('should list every error with the correct FAILED count when the log has multiple errors', () => {
		// Arrange
		writeFileSync(join(tempDir, LOG_NAME), `${SINGLE_ERROR}\n${SECOND_ERROR}\n`);

		// Act
		const run = runParser(tempDir);

		// Assert
		expect(run.status).toBe(1);
		expect(outputLines(run.stdout)).toEqual(['FAILED 2:', SINGLE_ERROR, SECOND_ERROR]);
	});

	it('should cap listed errors at 25 lines while keeping the full count in the header when there are 30 errors', () => {
		// Arrange
		const errors = Array.from({ length: 30 }, (_, index) => `src/f${index}.ts(1,1): error TS2322: boom ${index}`);
		writeFileSync(join(tempDir, LOG_NAME), `${errors.join('\n')}\n`);

		// Act
		const run = runParser(tempDir);

		// Assert
		const lines = outputLines(run.stdout);
		expect(run.status).toBe(1);
		expect(lines[0]).toBe('FAILED 30:');
		expect(lines.length - 1).toBe(25);
		expect(lines[25]).toBe(errors[24]);
	});

	it('should truncate each error message to 120 characters when the message is longer', () => {
		// Arrange
		const longMessage = `error TS2322: ${'x'.repeat(200)}`;
		writeFileSync(join(tempDir, LOG_NAME), `src/a.ts(1,1): ${longMessage}\n`);
		const expectedLine = `src/a.ts(1,1): ${longMessage.slice(0, 120)}`;

		// Act
		const run = runParser(tempDir);

		// Assert
		expect(outputLines(run.stdout)).toEqual(['FAILED 1:', expectedLine]);
		expect(expectedLine.length).toBe('src/a.ts(1,1): '.length + 120);
	});

	it('should print TYPE-CHECK FAIL and exit 1 when the log has a summary line but no parsable error lines', () => {
		// Arrange
		writeFileSync(join(tempDir, LOG_NAME), 'Found 2 errors in 1 file.\n');

		// Act
		const run = runParser(tempDir);

		// Assert
		expect(run.status).toBe(1);
		expect(run.stdout).toContain('TYPE-CHECK FAIL');
		expect(run.stdout).toContain('Found 2 errors');
	});
});
