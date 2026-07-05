/* eslint-disable no-console, n/no-process-exit */
import { spawnSync } from 'node:child_process';

const MAX_LINES = 30;

function run(command) {
	return spawnSync(command, {
		shell: true,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	});
}

const { status, stdout, stderr } = run('npm run build:local');

const code = status ?? 1;
if (code !== 0) {
	console.log('BUILD LOCAL FAIL');
	const detail = `${stderr}\n${stdout}`
		.trim()
		.split('\n')
		.filter((line) => line.trim().length > 0)
		.slice(-MAX_LINES)
		.join('\n');
	console.log(detail || 'build:local failed');
	process.exit(1);
}

console.log('BUILD LOCAL PASS');
