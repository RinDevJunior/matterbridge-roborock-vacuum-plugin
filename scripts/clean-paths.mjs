/* eslint-disable no-console, n/no-process-exit */
import { existsSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);

if (args.length === 0) {
	console.log('CLEANUP: none (no paths provided)');
	process.exit(0);
}

function isSafeDocsPath(path) {
	const normalized = path.replace(/\\/g, '/');
	if (normalized.includes('..')) {
		return false;
	}
	return normalized === 'docs' || normalized.startsWith('docs/');
}

const removed = [];
const skipped = [];

for (const raw of args) {
	const path = raw.replace(/\/$/, '');

	if (!isSafeDocsPath(path)) {
		skipped.push(`${path} (rejected: must be under docs/)`);
		continue;
	}

	const absolute = resolve(path);
	if (!existsSync(absolute)) {
		skipped.push(`${path} (not found)`);
		continue;
	}

	const stat = statSync(absolute);
	if (stat.isDirectory()) {
		rmSync(absolute, { recursive: true, force: true });
		removed.push(`${path}/`);
	} else {
		rmSync(absolute);
		removed.push(path);
	}
}

if (skipped.length > 0) {
	console.log('CLEANUP SKIPPED:');
	console.log(skipped.join('\n'));
}

if (removed.length === 0) {
	console.log('CLEANUP: none');
	process.exit(0);
}

console.log('CLEANUP:');
console.log(removed.join('\n'));
