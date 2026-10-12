import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// The module is exercised through child processes (not a static import) so that its untyped .mjs
// source is never pulled into the TypeScript program. Mirrors the pattern in parseTscFailures.test.ts.
const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(TESTS_DIR, '../../../scripts/run-affected-tests.mjs');
const SCRIPT_URL = pathToFileURL(SCRIPT_PATH).href;
const PACKAGE_JSON_PATH = resolve(TESTS_DIR, '../../../package.json');
const NO_AFFECTED = 'No affected tests (run npm run codegraph:init if .codegraph/ is missing)';
const CRLF = '\r\n';
const IS_WINDOWS = process.platform === 'win32';

/** Call an exported helper inside a child Node process and return its JSON-serialised result. */
function callHelper(fn: string, args: unknown[], env: NodeJS.ProcessEnv = process.env): unknown {
	const source = [
		`import * as m from ${JSON.stringify(SCRIPT_URL)};`,
		'const [name, callArgs] = JSON.parse(process.env.HARNESS_CALL);',
		'console.log(JSON.stringify(m[name](...callArgs)));',
	].join('\n');
	const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
		cwd: tmpdir(),
		env: { ...env, HARNESS_CALL: JSON.stringify([fn, args]) },
		encoding: 'utf8',
	});
	if (result.status !== 0) {
		throw new Error(`harness call ${fn} failed: ${result.stderr}`);
	}
	return JSON.parse(result.stdout.trim()) as unknown;
}

function runScript(cwd: string, env: NodeJS.ProcessEnv) {
	return spawnSync(process.execPath, [SCRIPT_PATH], { cwd, env, encoding: 'utf8' });
}

interface FakeSpec {
	stdout?: string;
	stderr?: string;
	status?: number;
}

interface FakeEnv {
	root: string;
	env: NodeJS.ProcessEnv;
	calls: () => string[];
	stdinFile: string;
}

/** Fake shell binary: logs argv as [a][b] lines, optionally captures stdin, replays canned output. */
function fakeScript(name: string, captureStdin: boolean): string {
	const upper = name.toUpperCase();
	return [
		'#!/bin/sh',
		`printf '%s' '${name}' >> "$FAKE_CALL_LOG"`,
		'for a in "$@"; do printf "[%s]" "$a" >> "$FAKE_CALL_LOG"; done',
		'printf "\\n" >> "$FAKE_CALL_LOG"',
		...(captureStdin ? ['cat > "$FAKE_STDIN_FILE"'] : []),
		`printf "%b" "$FAKE_${upper}_STDOUT"`,
		`printf "%b" "$FAKE_${upper}_STDERR" 1>&2`,
		`exit "$FAKE_${upper}_STATUS"`,
		'',
	].join('\n');
}

/**
 * Build a PATH containing only the requested fake binaries. `cat` is symlinked in so fakes can read stdin;
 * any command without a fake is a genuine ENOENT for the script under test.
 */
function setupFakes(root: string, specs: Partial<Record<'git' | 'codegraph' | 'npx', FakeSpec>>): FakeEnv {
	const binDir = join(root, 'bin');
	mkdirSync(binDir);
	symlinkSync('/bin/cat', join(binDir, 'cat'));
	const logFile = join(root, 'calls.log');
	const stdinFile = join(root, 'stdin.txt');
	const env: NodeJS.ProcessEnv = { PATH: binDir, FAKE_CALL_LOG: logFile, FAKE_STDIN_FILE: stdinFile };
	for (const name of ['git', 'codegraph', 'npx'] as const) {
		const spec = specs[name];
		if (!spec) {
			continue;
		}
		const file = join(binDir, name);
		writeFileSync(file, fakeScript(name, name === 'codegraph'), { mode: 0o755 });
		const upper = name.toUpperCase();
		env[`FAKE_${upper}_STDOUT`] = spec.stdout ?? '';
		env[`FAKE_${upper}_STDERR`] = spec.stderr ?? '';
		env[`FAKE_${upper}_STATUS`] = String(spec.status ?? 0);
	}
	return {
		root,
		env,
		stdinFile,
		calls: () => (existsSync(logFile) ? readFileSync(logFile, 'utf8').split(/\r?\n/).filter(Boolean) : []),
	};
}

describe.skipIf(IS_WINDOWS)('run-affected-tests.mjs (POSIX fake binaries)', () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), 'affected-tests-'));
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	describe('run', () => {
		it('should return ok with stdout when the command succeeds', () => {
			// Arrange
			const fakes = setupFakes(root, { git: { stdout: 'src/a.ts\n' } });
			// Act
			const result = callHelper('run', ['git', ['diff', '--name-only', 'HEAD']], fakes.env);
			// Assert
			expect(result).toEqual({ ok: true, stdout: 'src/a.ts\n', error: null });
		});

		it('should pass args through unchanged without quoting on posix', () => {
			// Arrange
			const fakes = setupFakes(root, { git: {} });
			// Act
			callHelper('run', ['git', ['diff', 'my file.ts'], { platform: 'linux' }], fakes.env);
			// Assert
			expect(fakes.calls()).toEqual(['git[diff][my file.ts]']);
		});

		it('should forward input to the child stdin when input is provided', () => {
			// Arrange
			const fakes = setupFakes(root, { codegraph: { stdout: 'x\n' } });
			// Act
			callHelper('run', ['codegraph', ['affected', '--stdin'], { input: 'src/a.ts\nsrc/b.ts\n' }], fakes.env);
			// Assert
			expect(readFileSync(fakes.stdinFile, 'utf8')).toBe('src/a.ts\nsrc/b.ts\n');
		});

		it('should return an error naming the command when spawn fails to start', () => {
			// Arrange: no git fake on PATH, so spawn reports ENOENT
			const fakes = setupFakes(root, {});
			// Act
			const result = callHelper('run', ['git', ['diff']], fakes.env) as { ok: boolean; error: string };
			// Assert
			expect(result.ok).toBe(false);
			expect(result.error).toMatch(/^git failed to start: .*ENOENT/);
		});

		it('should return an error with exit code and trimmed stderr when the command exits non-zero', () => {
			// Arrange
			const fakes = setupFakes(root, { git: { status: 2, stderr: '  fatal: boom\n' } });
			// Act
			const result = callHelper('run', ['git', ['diff']], fakes.env);
			// Assert
			expect(result).toEqual({ ok: false, stdout: '', error: 'git exited with code 2: fatal: boom' });
		});

		it('should omit the stderr detail when the command exits non-zero without stderr', () => {
			// Arrange
			const fakes = setupFakes(root, { git: { status: 1 } });
			// Act
			const result = callHelper('run', ['git', ['diff']], fakes.env) as { error: string };
			// Assert
			expect(result.error).toBe('git exited with code 1');
		});

		it('should keep an argument with spaces intact when running with win32 quoting enabled', () => {
			// Arrange: win32 mode uses shell: true; on POSIX /bin/sh must still deliver the quoted argument as one arg
			const fakes = setupFakes(root, { git: {} });
			// Act
			callHelper('run', ['git', ['diff', 'my file.ts'], { platform: 'win32' }], fakes.env);
			// Assert
			expect(fakes.calls()).toEqual(['git[diff][my file.ts]']);
		});
	});

	describe('main (direct run, real script)', () => {
		it('should print a git-specific message and exit 1 when git is missing', () => {
			// Arrange
			const fakes = setupFakes(root, {});
			// Act
			const result = runScript(root, fakes.env);
			// Assert
			expect(result.status).toBe(1);
			expect(result.stderr).toContain('could not list changed files. git failed to start');
			expect(fakes.calls()).toEqual([]);
		});

		it('should exit 1 and include git stderr when git exits non-zero', () => {
			// Arrange
			const fakes = setupFakes(root, { git: { status: 128, stderr: 'not a git repository' } });
			// Act
			const result = runScript(root, fakes.env);
			// Assert
			expect(result.status).toBe(1);
			expect(result.stderr).toContain('git exited with code 128: not a git repository');
		});

		it('should print NO_AFFECTED_MESSAGE, exit 0, and skip codegraph when git reports no changes', () => {
			// Arrange
			const fakes = setupFakes(root, { git: { stdout: '\n' }, codegraph: {} });
			// Act
			const result = runScript(root, fakes.env);
			// Assert
			expect(result.status).toBe(0);
			expect(result.stdout).toContain(NO_AFFECTED);
			expect(fakes.calls().some((line) => line.startsWith('codegraph'))).toBe(false);
		});

		it('should print a codegraph install hint and exit 1 when codegraph is missing', () => {
			// Arrange
			const fakes = setupFakes(root, { git: { stdout: 'src/a.ts\n' }, npx: {} });
			// Act
			const result = runScript(root, fakes.env);
			// Assert
			expect(result.status).toBe(1);
			expect(result.stderr).toContain('codegraph unavailable or failed (is it installed? run npm run codegraph:init)');
			expect(fakes.calls().some((line) => line.startsWith('npx'))).toBe(false);
		});

		it('should exit 1 and include codegraph stderr when codegraph exits non-zero', () => {
			// Arrange
			const fakes = setupFakes(root, {
				git: { stdout: 'src/a.ts\n' },
				codegraph: { status: 1, stderr: 'index missing' },
			});
			// Act
			const result = runScript(root, fakes.env);
			// Assert
			expect(result.status).toBe(1);
			expect(result.stderr).toContain('codegraph exited with code 1: index missing');
		});

		it('should print NO_AFFECTED_MESSAGE, exit 0, and skip vitest when codegraph reports no affected files', () => {
			// Arrange
			const fakes = setupFakes(root, { git: { stdout: 'README.md\n' }, codegraph: { stdout: '\n' }, npx: {} });
			// Act
			const result = runScript(root, fakes.env);
			// Assert
			expect(result.status).toBe(0);
			expect(result.stdout).toContain(NO_AFFECTED);
			expect(fakes.calls().some((line) => line.startsWith('npx'))).toBe(false);
		});

		it('should pipe git changed files to codegraph stdin with the affected flags', () => {
			// Arrange
			const fakes = setupFakes(root, {
				git: { stdout: 'src/a.ts\nsrc/b.ts\n' },
				codegraph: { stdout: '' },
			});
			// Act
			runScript(root, fakes.env);
			// Assert
			expect(fakes.calls()).toContain('codegraph[affected][--stdin][--quiet]');
			expect(readFileSync(fakes.stdinFile, 'utf8')).toBe('src/a.ts\nsrc/b.ts\n');
		});

		it('should run vitest with the affected files and exit 0', () => {
			// Arrange
			const fakes = setupFakes(root, {
				git: { stdout: 'src/a.ts\n' },
				codegraph: { stdout: 'src/x.test.ts\nsrc/y.ts\n' },
				npx: {},
			});
			// Act
			const result = runScript(root, fakes.env);
			// Assert
			expect(result.status).toBe(0);
			expect(fakes.calls()).toContain('npx[vitest][run][src/x.test.ts][src/y.ts]');
		});

		it('should exit with the vitest exit status when vitest fails', () => {
			// Arrange
			const fakes = setupFakes(root, {
				git: { stdout: 'src/a.ts\n' },
				codegraph: { stdout: 'src/x.test.ts\n' },
				npx: { status: 3 },
			});
			// Act
			const result = runScript(root, fakes.env);
			// Assert
			expect(result.status).toBe(3);
		});

		it('should print a start failure and exit 1 when npx cannot be spawned', () => {
			// Arrange
			const fakes = setupFakes(root, {
				git: { stdout: 'src/a.ts\n' },
				codegraph: { stdout: 'src/x.test.ts\n' },
			});
			// Act
			const result = runScript(root, fakes.env);
			// Assert
			expect(result.status).toBe(1);
			expect(result.stderr).toContain('test:affected: failed to start vitest');
		});
	});

	describe('CRLF-safe parsing through the real script', () => {
		it('should treat CRLF codegraph output as separate affected files for vitest', () => {
			// Arrange
			const fakes = setupFakes(root, {
				git: { stdout: 'src/a.ts\r\n' },
				codegraph: { stdout: `src/x.test.ts${CRLF}src/y.test.ts${CRLF}` },
				npx: {},
			});
			// Act
			const result = runScript(root, fakes.env);
			// Assert
			expect(result.status).toBe(0);
			expect(fakes.calls()).toContain('npx[vitest][run][src/x.test.ts][src/y.test.ts]');
		});
	});
});

describe('run-affected-tests.mjs (pure helpers, child process harness)', () => {
	describe('parseAffected', () => {
		it('should return trimmed non-empty lines when given LF output', () => {
			expect(callHelper('parseAffected', ['src/a.test.ts\n  src/b.ts  \n\nsrc/c.ts\n'])).toEqual([
				'src/a.test.ts',
				'src/b.ts',
				'src/c.ts',
			]);
		});

		it('should strip carriage returns when given CRLF output', () => {
			expect(callHelper('parseAffected', [`src/a.test.ts${CRLF}src/b.ts${CRLF}`])).toEqual([
				'src/a.test.ts',
				'src/b.ts',
			]);
		});

		it('should return an empty array when output is empty', () => {
			expect(callHelper('parseAffected', [''])).toEqual([]);
		});

		it('should return an empty array when output contains only blank lines and whitespace', () => {
			expect(callHelper('parseAffected', ['  \n\r\n\t\n'])).toEqual([]);
		});

		it('should return an empty array when stdout is undefined', () => {
			expect(callHelper('parseAffected', [])).toEqual([]);
		});
	});

	describe('quoteArg', () => {
		it('should return the argument unchanged on win32 when it has no special characters', () => {
			expect(callHelper('quoteArg', ['src/a.test.ts', 'win32'])).toBe('src/a.test.ts');
		});

		it('should wrap the argument in double quotes on win32 when it contains whitespace', () => {
			expect(callHelper('quoteArg', ['my file.ts', 'win32'])).toBe('"my file.ts"');
		});

		it('should double embedded double quotes on win32', () => {
			expect(callHelper('quoteArg', ['a"b', 'win32'])).toBe('"a""b"');
		});

		it.each(['&', '|', '<', '>', '^', '(', ')'])(
			'should wrap the argument in double quotes on win32 when it contains %s',
			(char) => {
				// Arrange
				const arg = `a${char}b`;
				// Act
				const result = callHelper('quoteArg', [arg, 'win32']);
				// Assert
				expect(result).toBe(`"${arg}"`);
			},
		);

		it('should pass arguments through untouched on posix even with special characters', () => {
			expect(callHelper('quoteArg', ['my file & "x"', 'linux'])).toBe('my file & "x"');
		});
	});

	describe('NO_AFFECTED_MESSAGE', () => {
		it('should be the documented no-affected-tests message', () => {
			const source = `import { NO_AFFECTED_MESSAGE } from ${JSON.stringify(SCRIPT_URL)};\nconsole.log(JSON.stringify(NO_AFFECTED_MESSAGE));`;
			const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
				cwd: tmpdir(),
				encoding: 'utf8',
			});
			expect(JSON.parse(result.stdout.trim())).toBe(NO_AFFECTED);
		});
	});

	describe('module import', () => {
		it('should not execute main when the module is imported', () => {
			// Arrange: a non-git temp dir; if main ran it would exit 1 and the child would fail
			const tmp = mkdtempSync(join(tmpdir(), 'affected-import-'));
			try {
				const source = `import ${JSON.stringify(SCRIPT_URL)};\nconsole.log('IMPORTED');`;
				// Act
				const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
					cwd: tmp,
					encoding: 'utf8',
				});
				// Assert
				expect(result.status).toBe(0);
				expect(result.stdout.trim()).toBe('IMPORTED');
			} finally {
				rmSync(tmp, { recursive: true, force: true });
			}
		});
	});

	describe('package.json wiring', () => {
		it('should map test:affected to exactly node scripts/run-affected-tests.mjs', () => {
			// Arrange
			const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8')) as { scripts: Record<string, string> };
			// Act
			const script = pkg.scripts['test:affected'];
			// Assert
			expect(script).toBe('node scripts/run-affected-tests.mjs');
		});
	});
});
