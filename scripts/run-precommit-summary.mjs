/* eslint-disable no-console, n/no-process-exit */
import { spawnSync } from 'node:child_process';

const MAX_LINES = 25;

const STEPS = [
	{ name: 'lint', command: 'npm run lint' },
	{ name: 'type-check', command: 'npm run type-check' },
	{ name: 'dup-check', command: 'npm run dup-check' },
	{ name: 'format:check', command: 'npm run format:check' },
	{ name: 'test', command: 'npm run test:ci' },
];

function runStep(command) {
	return spawnSync(command, {
		shell: true,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	});
}

function compactLines(output, patterns) {
	const lines = output.split('\n').map((line) => line.trimEnd());
	const matched = lines.filter((line) => patterns.some((re) => re.test(line)));
	const unique = [...new Set(matched)];
	return unique.slice(0, MAX_LINES);
}

function summarize(name, stdout, stderr, code) {
	if (code === 0) {
		const passLine = stdout.trim().split('\n').filter(Boolean).pop();
		return { pass: true, detail: passLine && name === 'test' ? passLine : 'PASS' };
	}

	const output = `${stdout}\n${stderr}`;

	switch (name) {
		case 'lint':
			return {
				pass: false,
				detail: compactLines(output, [/\berror\b/i, /✖/, /ESLint/]).join('\n') || 'lint failed',
			};
		case 'type-check':
			return {
				pass: false,
				detail: compactLines(output, [/error TS\d+/, /Found \d+ error/]).join('\n') || 'type-check failed',
			};
		case 'dup-check':
			return {
				pass: false,
				detail: compactLines(output, [/Clone found/i, /duplication/i, /ERROR/i]).join('\n') || 'dup-check failed',
			};
		case 'format:check':
			return {
				pass: false,
				detail:
					compactLines(output, [/^\[warn\]/i, /Code style issue/, /\.(ts|tsx|js|md|json)/]).join('\n') ||
					'format:check failed',
			};
		case 'test':
			return {
				pass: false,
				detail: compactLines(output, [/TESTS FAIL/, /FAILED \d+:/, /^FAILED /, / > /]).join('\n') || 'test failed',
			};
		default:
			return { pass: false, detail: output.split('\n').slice(0, MAX_LINES).join('\n') };
	}
}

const results = [];
let failed = false;

for (const step of STEPS) {
	const { status, stdout, stderr } = runStep(step.command);
	const code = status ?? 1;
	const summary = summarize(step.name, stdout ?? '', stderr ?? '', code);
	results.push({ name: step.name, ...summary });
	if (!summary.pass) {
		failed = true;
		break;
	}
}

console.log(failed ? 'PRECOMMIT FAIL' : 'PRECOMMIT PASS');
for (const result of results) {
	console.log(`${result.name}: ${result.pass ? result.detail : 'FAIL'}`);
	if (!result.pass) {
		console.log(result.detail);
	}
}

process.exit(failed ? 1 : 0);
