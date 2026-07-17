/* eslint-disable no-console, n/no-process-exit */
import { existsSync, readFileSync } from 'node:fs';

const REPORT = 'test-report.junit.xml';
const MSG_MAX = 120;

function decodeXml(value) {
	return value
		.replace(/&apos;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');
}

if (!existsSync(REPORT)) {
	console.error('TESTS FAIL: missing test-report.junit.xml');
	process.exit(1);
}

const xml = readFileSync(REPORT, 'utf8');
const failures = [];

for (const block of xml.matchAll(/<testcase[^>]*>[\s\S]*?<\/testcase>/g)) {
	const testcase = block[0];
	const failure = testcase.match(/<failure[^>]*message="([^"]*)"/);
	if (!failure) {
		continue;
	}

	const openTag = testcase.match(/^<testcase\s+([^>]+)>/)?.[1] ?? '';
	const classname = openTag.match(/classname="([^"]*)"/)?.[1] ?? '';
	const name = decodeXml(openTag.match(/\bname="([^"]*)"/)?.[1] ?? '');
	const message = decodeXml(failure[1]).split('\n')[0].slice(0, MSG_MAX);
	failures.push(`${classname} > ${name}: ${message}`);
}

if (failures.length === 0) {
	console.log('TESTS PASS');
	process.exit(0);
}

console.log(`FAILED ${failures.length}:`);
console.log(failures.join('\n'));
process.exit(1);
