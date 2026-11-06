/* eslint-disable no-console, n/no-process-exit */
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const NO_AFFECTED_MESSAGE = 'No affected tests (run npm run codegraph:init if .codegraph/ is missing)';

/** Split command output into non-empty, trimmed lines (LF or CRLF). */
export function parseAffected(stdout) {
	return String(stdout ?? '')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

/** Quote an argument for cmd.exe when running with shell: true on Windows. */
export function quoteArg(arg, platform = process.platform) {
	if (platform !== 'win32') {
		return arg;
	}
	return /[\s"&|<>^()]/.test(arg) ? `"${arg.replace(/"/g, '""')}"` : arg;
}

/** Run a command; returns { ok, stdout, error }. Never throws. */
export function run(command, args, { input, platform = process.platform, spawn = spawnSync } = {}) {
	const isWin = platform === 'win32';
	const result = spawn(command, isWin ? args.map((a) => quoteArg(a, platform)) : args, {
		input,
		encoding: 'utf8',
		shell: isWin,
		stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
	});
	if (result.error) {
		return { ok: false, stdout: '', error: `${command} failed to start: ${result.error.message}` };
	}
	if (result.status !== 0) {
		const detail = String(result.stderr ?? '').trim();
		return {
			ok: false,
			stdout: '',
			error: `${command} exited with code ${result.status}${detail ? `: ${detail}` : ''}`,
		};
	}
	return { ok: true, stdout: String(result.stdout ?? ''), error: null };
}

export function main() {
	const changed = run('git', ['diff', '--name-only', 'HEAD']);
	if (!changed.ok) {
		console.error(`test:affected: could not list changed files. ${changed.error}`);
		return 1;
	}
	if (parseAffected(changed.stdout).length === 0) {
		console.log(NO_AFFECTED_MESSAGE);
		return 0;
	}

	const affected = run('codegraph', ['affected', '--stdin', '--quiet'], { input: changed.stdout });
	if (!affected.ok) {
		console.error(
			`test:affected: codegraph unavailable or failed (is it installed? run npm run codegraph:init). ${affected.error}`,
		);
		return 1;
	}
	const files = parseAffected(affected.stdout);
	if (files.length === 0) {
		console.log(NO_AFFECTED_MESSAGE);
		return 0;
	}

	const isWin = process.platform === 'win32';
	const vitest = spawnSync('npx', ['vitest', 'run', ...(isWin ? files.map((f) => quoteArg(f)) : files)], {
		stdio: 'inherit',
		shell: isWin,
	});
	if (vitest.error) {
		console.error(`test:affected: failed to start vitest: ${vitest.error.message}`);
		return 1;
	}
	return vitest.status ?? 1;
}

function isDirectRun() {
	try {
		return (
			process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
		);
	} catch {
		return false;
	}
}

if (isDirectRun()) {
	process.exit(main());
}
