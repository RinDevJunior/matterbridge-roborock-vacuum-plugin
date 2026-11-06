/* eslint-disable n/no-process-exit */
import { spawnSync } from 'node:child_process';

spawnSync('npx vitest run --reporter=junit --outputFile=test-report.junit.xml', {
	shell: true,
	encoding: 'utf8',
	stdio: ['ignore', 'ignore', 'ignore'],
});

const { status } = spawnSync('node scripts/parse-junit-failures.mjs', {
	shell: true,
	encoding: 'utf8',
	stdio: 'inherit',
});

process.exit(status ?? 1);
