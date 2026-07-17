/* eslint-disable no-console, n/no-process-exit */
import { spawnSync } from 'node:child_process';

const MAX_LINES = 25;

function run(command) {
	return spawnSync(command, {
		shell: true,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	});
}

function compactLintErrors(output) {
	const lines = output.split('\n').map((line) => line.trimEnd());
	const matched = lines.filter((line) => /\berror\b/i.test(line) || /✖/.test(line) || /ESLint/.test(line));
	return [...new Set(matched)].slice(0, MAX_LINES).join('\n');
}

const fix = run('npx eslint --fix --max-warnings=0 .');
const fixCode = fix.status ?? 1;
if (fixCode !== 0) {
	console.log('LINT FIX FAIL');
	const detail = compactLintErrors(`${fix.stdout ?? ''}\n${fix.stderr ?? ''}`);
	console.log(detail || 'eslint --fix failed');
	process.exit(1);
}

const verify = run('npm run lint');
const verifyCode = verify.status ?? 1;
if (verifyCode !== 0) {
	console.log('LINT FIX FAIL');
	const detail = compactLintErrors(`${verify.stdout ?? ''}\n${verify.stderr ?? ''}`);
	console.log(detail || 'eslint verify failed after --fix');
	process.exit(1);
}

console.log('LINT FIX PASS');
