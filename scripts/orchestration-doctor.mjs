/* eslint-disable no-console, n/no-process-exit */
// Orchestration doctor — a fast health check for the .claude/ orchestration setup.
//
// Catches the silent breakage that hurts most: a skill/agent/style with missing
// frontmatter, or a `.claude/...` / `scripts/...` file reference that no longer resolves
// (e.g. a renamed script or template). Prints a compact PASS line or a list of problems,
// and exits non-zero on any problem so it can gate a precommit run.
//
// Usage: node scripts/orchestration-doctor.mjs

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const problems = [];
const stats = { agents: 0, skills: 0, styles: 0, refs: 0 };

function walk(dir) {
	const out = [];
	if (!existsSync(dir)) return out;
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		const s = statSync(p);
		if (s.isDirectory()) out.push(...walk(p));
		else if (name.endsWith('.md')) out.push(p);
	}
	return out;
}

/** Return the YAML frontmatter block text, or null if absent. */
function frontmatter(text) {
	if (!text.startsWith('---')) return null;
	const end = text.indexOf('\n---', 3);
	return end === -1 ? null : text.slice(3, end);
}

function checkFrontmatter(file, kind) {
	const fm = frontmatter(readFileSync(file, 'utf8'));
	if (!fm) {
		problems.push(`${kind}: ${file} — missing YAML frontmatter (--- block)`);
		return;
	}
	if (!/^\s*name\s*:/m.test(fm)) problems.push(`${kind}: ${file} — frontmatter missing "name"`);
	if (!/^\s*description\s*:/m.test(fm)) problems.push(`${kind}: ${file} — frontmatter missing "description"`);
}

// 1. Agents — .claude/agents/*.md
for (const f of walk('.claude/agents')) {
	stats.agents++;
	checkFrontmatter(f, 'agent');
}

// 2. Output styles — .claude/output-styles/*.md
for (const f of walk('.claude/output-styles')) {
	stats.styles++;
	checkFrontmatter(f, 'style');
}

// 3. Skills — .claude/skills/<name>/SKILL.md, folder name should match frontmatter name
for (const dir of existsSync('.claude/skills') ? readdirSync('.claude/skills') : []) {
	const skillFile = join('.claude/skills', dir, 'SKILL.md');
	if (!existsSync(skillFile)) continue;
	stats.skills++;
	checkFrontmatter(skillFile, 'skill');
	const fm = frontmatter(readFileSync(skillFile, 'utf8')) || '';
	const m = fm.match(/^\s*name\s*:\s*(.+?)\s*$/m);
	if (m && m[1].trim() !== dir) {
		problems.push(`skill: ${skillFile} — folder "${dir}" != frontmatter name "${m[1].trim()}"`);
	}
}

// 4. Broken references — backtick-quoted `.claude/...` and `scripts/...` paths that don't resolve.
//    Conservative: only committed orchestration paths, only clear file extensions, skip
//    placeholders (<>, *, ...) and generated/ephemeral paths (workspace/, dist/).
const REF = /`((?:\.claude|scripts)\/[^`]+?)`/g;
const EXT = /\.(md|html|json|mjs|cjs|js|ts|sh)$/;
// Lines that present a path as a hypothetical/example are not real references.
const EXAMPLE_LINE = /\b(e\.g\.|example|instead|such as|would be|could be)\b/i;
const seen = new Set();
for (const f of walk('.claude')) {
	const text = readFileSync(f, 'utf8');
	const lines = text.split('\n');
	for (const line of lines) {
		if (EXAMPLE_LINE.test(line)) continue;
		let m;
		REF.lastIndex = 0;
		while ((m = REF.exec(line)) !== null) {
			const ref = m[1];
			if (/[<>*]|\.\.\./.test(ref) || ref.includes(' ') || !EXT.test(ref)) continue;
			if (seen.has(ref)) continue;
			seen.add(ref);
			stats.refs++;
			if (!existsSync(ref)) problems.push(`ref: ${f} points to missing "${ref}"`);
		}
	}
}

if (problems.length) {
	console.log(`DOCTOR: ${problems.length} problem(s)`);
	for (const p of problems) console.log(`  - ${p}`);
	process.exit(1);
}
console.log(
	`DOCTOR: ok (${stats.agents} agents, ${stats.styles} styles, ${stats.skills} skills, ${stats.refs} refs checked)`,
);
