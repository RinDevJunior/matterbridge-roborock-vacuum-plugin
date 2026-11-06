import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../scripts');
const WRAPPER_PATH = join(SCRIPTS_DIR, 'run-type-check-summary.mjs');
const PARSER_SOURCE = join(SCRIPTS_DIR, 'parse-tsc-failures.mjs');

// Fake `npx` that replays canned tsc output so the real wrapper runs end-to-end without a real tsc.
const FAKE_NPX = [
	'#!/bin/sh',
	'printf "%b" "$FAKE_STDOUT"',
	'printf "%b" "$FAKE_STDERR" 1>&2',
	'exit "$FAKE_STATUS"',
	'',
].join('\n');

interface WrapperRun {
	status: number | null;
	stdout: string;
}

function runWrapper(cwd: string, env: NodeJS.ProcessEnv): WrapperRun {
	const result = spawnSync(process.execPath, [WRAPPER_PATH], { cwd, env, encoding: 'utf8' });
	return { status: result.status, stdout: result.stdout };
}

describe.skipIf(process.platform === 'win32')('run-type-check-summary.mjs failure paths (POSIX shell)', () => {
	let rootDir: string;
	let workDir: string;
	let fakeBinDir: string;
	let emptyBinDir: string;

	beforeEach(() => {
		rootDir = mkdtempSync(join(tmpdir(), 'tsc-wrapper-'));
		workDir = join(rootDir, 'work');
		fakeBinDir = join(rootDir, 'fake-bin');
		emptyBinDir = join(rootDir, 'empty-bin');
		mkdirSync(join(workDir, 'scripts'), { recursive: true });
		mkdirSync(fakeBinDir);
		mkdirSync(emptyBinDir);
		copyFileSync(PARSER_SOURCE, join(workDir, 'scripts', 'parse-tsc-failures.mjs'));
		writeFileSync(join(fakeBinDir, 'npx'), FAKE_NPX);
		chmodSync(join(fakeBinDir, 'npx'), 0o755);
	});

	afterEach(() => {
		rmSync(rootDir, { recursive: true, force: true });
	});

	function fakeTscEnv(status: number, stdout = '', stderr = ''): NodeJS.ProcessEnv {
		return {
			...process.env,
			PATH: [fakeBinDir, dirname(process.execPath), process.env['PATH'] ?? ''].join(delimiter),
			FAKE_STATUS: String(status),
			FAKE_STDOUT: stdout,
			FAKE_STDERR: stderr,
		};
	}

	it('should print TYPE-CHECK FAIL, skip the parser, and exit 1 when npx is not on PATH (exit 127)', () => {
		// Arrange
		const env = { PATH: emptyBinDir };

		// Act
		const run = runWrapper(workDir, env);

		// Assert
		expect(run.status).toBe(1);
		expect(run.stdout).toContain('TYPE-CHECK FAIL');
		expect(run.stdout).toContain('npx');
		expect(run.stdout).not.toContain('FAILED');
		expect(run.stdout).not.toContain('TYPE-CHECK PASS');
	});

	it('should print TYPE-CHECK FAIL with the tsc exit code when output has no structured errors', () => {
		// Arrange
		const env = fakeTscEnv(1, '', '');

		// Act
		const run = runWrapper(workDir, env);

		// Assert
		expect(run.status).toBe(1);
		expect(run.stdout).toContain('TYPE-CHECK FAIL');
		expect(run.stdout).toContain('tsc exited with 1');
	});

	it('should delegate to the parser and print structured FAILED output when tsc reports error TS lines', () => {
		// Arrange
		const env = fakeTscEnv(2, 'src/a.ts(3,1): error TS2322: nope\\nFound 1 error in src/a.ts:3\\n');

		// Act
		const run = runWrapper(workDir, env);

		// Assert
		expect(run.status).toBe(1);
		expect(run.stdout).toContain('FAILED 1:');
		expect(run.stdout).toContain('src/a.ts(3,1): error TS2322: nope');
	});

	it('should print TYPE-CHECK FAIL via the parser when only a Found N error summary is present', () => {
		// Arrange
		const env = fakeTscEnv(1, 'Found 2 errors in 1 file.\\n');

		// Act
		const run = runWrapper(workDir, env);

		// Assert
		expect(run.status).toBe(1);
		expect(run.stdout).toContain('TYPE-CHECK FAIL');
		expect(run.stdout).toContain('Found 2 errors');
	});

	it('should print TYPE-CHECK PASS and exit 0 when tsc exits 0 with no output', () => {
		// Arrange
		const env = fakeTscEnv(0);

		// Act
		const run = runWrapper(workDir, env);

		// Assert
		expect(run.status).toBe(0);
		expect(run.stdout.trim()).toBe('TYPE-CHECK PASS');
		expect(existsSync(join(workDir, 'type-check.log'))).toBe(true);
	});
});
