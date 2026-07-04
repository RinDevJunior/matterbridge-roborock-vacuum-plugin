/* eslint-disable no-console, n/no-process-exit */
import { existsSync, readFileSync } from 'node:fs';

const LOG = 'type-check.log';
const MSG_MAX = 120;
const MAX_LINES = 25;

if (!existsSync(LOG)) {
	console.error('TYPE-CHECK FAIL: missing type-check.log');
	process.exit(1);
}

const log = readFileSync(LOG, 'utf8');
const failures = [];

for (const line of log.split('\n')) {
	const fileMatch = line.match(/^(.+?\(\d+,\d+\)): (error TS\d+: .+)$/);
	if (fileMatch) {
		failures.push(`${fileMatch[1]}: ${fileMatch[2].slice(0, MSG_MAX)}`);
		continue;
	}

	const bareMatch = line.match(/^(error TS\d+: .+)$/);
	if (bareMatch) {
		failures.push(bareMatch[1].slice(0, MSG_MAX));
	}
}

if (failures.length === 0) {
	if (/Found \d+ error/i.test(log) || /\berror TS\d+:/i.test(log)) {
		const detail = log
			.split('\n')
			.map((line) => line.trimEnd())
			.filter((line) => /error TS\d+:/i.test(line) || /Found \d+ error/i.test(line))
			.slice(0, MAX_LINES)
			.join('\n');
		console.log('TYPE-CHECK FAIL');
		console.log(detail || 'type-check failed');
		process.exit(1);
	}

	console.log('TYPE-CHECK PASS');
	process.exit(0);
}

console.log(`FAILED ${failures.length}:`);
console.log(failures.slice(0, MAX_LINES).join('\n'));
process.exit(1);
