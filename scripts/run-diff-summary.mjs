/* eslint-disable no-console, n/no-process-exit */
import { spawnSync } from 'node:child_process';

const MAX_FILES = 40;
const MAX_HINTS = 20;
const HINT_MAX = 100;

function parseArgs(argv) {
	let mode = 'staged';
	let branchBase = null;

	for (const arg of argv) {
		if (arg === '--staged') {
			mode = 'staged';
		} else if (arg === '--unstaged') {
			mode = 'unstaged';
		} else if (arg.startsWith('--branch=')) {
			mode = 'branch';
			branchBase = arg.slice('--branch='.length);
		} else if (arg === '--branch' && branchBase === null) {
			continue;
		}
	}

	const branchIdx = argv.indexOf('--branch');
	if (branchIdx !== -1 && argv[branchIdx + 1]) {
		mode = 'branch';
		branchBase = argv[branchIdx + 1];
	}

	return { mode, branchBase };
}

function git(args) {
	const { status, stdout, stderr } = spawnSync('git', args, {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	if (status !== 0) {
		const detail = `${stderr}${stdout}`.trim().split('\n').slice(0, 5).join('\n');
		console.log('DIFF FAIL');
		console.log(detail || 'git failed');
		process.exit(1);
	}
	return stdout ?? '';
}

function diffArgs(mode, branchBase) {
	switch (mode) {
		case 'unstaged':
			return { nameStatus: ['diff', '--name-status'], numstat: ['diff', '--numstat'], diff: ['diff'] };
		case 'branch': {
			const range = `${branchBase}...HEAD`;
			return {
				nameStatus: ['diff', '--name-status', range],
				numstat: ['diff', '--numstat', range],
				diff: ['diff', range],
			};
		}
		default:
			return {
				nameStatus: ['diff', '--cached', '--name-status'],
				numstat: ['diff', '--cached', '--numstat'],
				diff: ['diff', '--cached'],
			};
	}
}

function parseNameStatus(output) {
	const entries = [];
	for (const line of output.split('\n')) {
		if (!line.trim()) {
			continue;
		}
		const tab = line.indexOf('\t');
		if (tab === -1) {
			continue;
		}
		const status = line.slice(0, tab).trim();
		const path = line.slice(tab + 1).trim();
		const code = status[0] ?? '?';
		entries.push({ code, path, status });
	}
	return entries;
}

function parseNumstat(output) {
	const map = new Map();
	for (const line of output.split('\n')) {
		if (!line.trim()) {
			continue;
		}
		const parts = line.split('\t');
		if (parts.length < 3) {
			continue;
		}
		const ins = parts[0] === '-' ? 0 : Number(parts[0]);
		const del = parts[1] === '-' ? 0 : Number(parts[1]);
		const path = parts.slice(2).join('\t');
		map.set(path, { ins, del });
	}
	return map;
}

function formatEntry({ code, path }, stats) {
	const stat = stats.get(path);
	if (!stat) {
		return `${code}  ${path}`;
	}
	const { ins, del } = stat;
	if (del > 0) {
		return `${code}  ${path} (+${ins} -${del})`;
	}
	return `${code}  ${path} (+${ins})`;
}

function collectHints(diffOutput, paths) {
	const hints = [];
	const pathSet = new Set(paths.map((p) => p.path));
	const blocks = diffOutput.split(/^diff --git /m).slice(1);

	for (const block of blocks) {
		const header = block.split('\n', 1)[0] ?? '';
		const match = header.match(/ b\/(.+)$/);
		if (!match) {
			continue;
		}
		const path = match[1];
		if (!pathSet.has(path)) {
			continue;
		}

		let fileHints = 0;
		for (const line of block.split('\n')) {
			if (!line.startsWith('+') || line.startsWith('+++')) {
				continue;
			}
			const text = line.slice(1).trim();
			if (!text || text === '{' || text === '}' || text === '[' || text === ']') {
				continue;
			}
			const hint = text.length > HINT_MAX ? `${text.slice(0, HINT_MAX - 1)}…` : text;
			hints.push(`${path}: ${hint}`);
			fileHints += 1;
			if (fileHints >= 2 || hints.length >= MAX_HINTS) {
				break;
			}
		}
		if (hints.length >= MAX_HINTS) {
			break;
		}
	}

	return hints;
}

const { mode, branchBase } = parseArgs(process.argv.slice(2));

if (mode === 'branch' && !branchBase) {
	console.log('DIFF FAIL');
	console.log('missing --branch <ref>');
	process.exit(1);
}

const args = diffArgs(mode, branchBase);
const nameStatusOut = git(args.nameStatus);
const numstatOut = git(args.numstat);
const entries = parseNameStatus(nameStatusOut);
const stats = parseNumstat(numstatOut);

if (entries.length === 0) {
	console.log(`DIFF: ${mode} | no changes`);
	process.exit(0);
}

let totalIns = 0;
let totalDel = 0;
for (const { ins, del } of stats.values()) {
	totalIns += ins;
	totalDel += del;
}

const label = mode === 'branch' ? `branch ${branchBase}...HEAD` : mode;
console.log(`DIFF: ${label} | ${entries.length} file(s) | +${totalIns} -${totalDel}`);

const shown = entries.slice(0, MAX_FILES);
for (const entry of shown) {
	console.log(formatEntry(entry, stats));
}
if (entries.length > MAX_FILES) {
	console.log(`... +${entries.length - MAX_FILES} more file(s)`);
}

const diffOut = git(args.diff);
const hints = collectHints(diffOut, entries);
if (hints.length > 0) {
	console.log('HINTS:');
	for (const hint of hints) {
		console.log(hint);
	}
}
