/* eslint-disable no-console, n/no-process-exit */
import { spawnSync } from 'node:child_process';

const GLOB = '**/*.{js,jsx,ts,tsx,json,css,md}';
const MAX_FILES = 30;

const { status, stdout, stderr } = spawnSync(`npx prettier --write "${GLOB}"`, {
	shell: true,
	encoding: 'utf8',
	stdio: ['ignore', 'pipe', 'pipe'],
});

const code = status ?? 1;
if (code !== 0) {
	console.log('FORMAT FAIL');
	const detail = `${stderr}\n${stdout}`.trim().split('\n').slice(0, 10).join('\n');
	console.log(detail || 'prettier failed');
	process.exit(1);
}

const reformatted = `${stdout}`
	.split('\n')
	.map((line) => line.trim())
	.filter((line) => line.length > 0 && !line.includes('(unchanged)'))
	.map((line) => line.replace(/\s+\d+ms$/, ''));

if (reformatted.length === 0) {
	console.log('FORMAT PASS');
	process.exit(0);
}

const shown = reformatted.slice(0, MAX_FILES);
const suffix = reformatted.length > MAX_FILES ? `\n... +${reformatted.length - MAX_FILES} more` : '';

console.log(`FORMAT: ${reformatted.length} file(s)`);
console.log(shown.join('\n') + suffix);
