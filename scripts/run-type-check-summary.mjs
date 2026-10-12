/* eslint-disable no-console, n/no-process-exit */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const LOG = 'type-check.log';

const tsc = spawnSync('npx tsc --noEmit', {
	shell: true,
	encoding: 'utf8',
	stdio: ['ignore', 'pipe', 'pipe'],
});

if (tsc.error || tsc.status === null) {
	console.log('TYPE-CHECK FAIL');
	console.log(String(tsc.error ?? 'tsc did not run'));
	process.exit(1);
}

const output = `${tsc.stdout ?? ''}${tsc.stderr ?? ''}`;
writeFileSync(LOG, output);

const hasStructuredErrors = /\berror TS\d+:/i.test(output) || /Found \d+ error/i.test(output);

if (tsc.status !== 0 && !hasStructuredErrors) {
	console.log('TYPE-CHECK FAIL');
	console.log(
		output
			.split(/\r?\n/)
			.filter((line) => line.trim() !== '')
			.slice(0, 5)
			.join('\n') || `tsc exited with ${tsc.status}`,
	);
	process.exit(1);
}

const { status } = spawnSync('node scripts/parse-tsc-failures.mjs', {
	shell: true,
	encoding: 'utf8',
	stdio: 'inherit',
});

process.exit(status ?? 1);
