/* eslint-disable no-console */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const MARKER_PREFIX = '<!-- released:';
const LABEL = 'released';
const LABEL_COLOR = '0e8a16';
const FIRST_RUN_CAP = 100;
const PR_LIST_LIMIT = 200;
const COMMIT_CAP = 250;
const RELEASE_SUBJECT = /\(#(\d+)\)$/;

export function npmTagFor(prerelease) {
	return prerelease ? 'dev' : 'latest';
}

export function buildComment({ tag, npmTag, repo, pkg }) {
	return [
		`${MARKER_PREFIX}${tag} -->`,
		`Released in [${tag}](https://github.com/${repo}/releases/tag/${tag}), published to npm tag \`${npmTag}\` ([npm](https://www.npmjs.com/package/${pkg}/v/${tag})).`,
	].join('\n');
}

export function hasReleaseMarker(commentBodies) {
	return commentBodies.some((body) => body.includes(MARKER_PREFIX));
}

export function pickPreviousRelease(releases, currentTag) {
	const current = releases.find((release) => release.tagName === currentTag);
	const cutoff = current ? Date.parse(current.createdAt) : Number.POSITIVE_INFINITY;
	const [previous] = releases
		.filter((release) => !release.isDraft && release.tagName !== currentTag && Date.parse(release.createdAt) < cutoff)
		.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
	return previous ? { tagName: previous.tagName, createdAt: previous.createdAt } : null;
}

const VERSION_TITLE = /^v?\d+\.\d+\.\d+(-[\w.]+)?$/;

// Release PRs (dev->main, release/X branches, title = version) are never commented,
// including earlier ones that fall inside the time window.
export function isReleasePr(pr) {
	return (
		pr.headRefName?.startsWith('release/') ||
		(pr.headRefName === 'dev' && pr.baseRefName === 'main') ||
		VERSION_TITLE.test(pr.title.trim())
	);
}

// Edge cases (see workspace/release-pr-comments/plan.md):
// - rc after rc: since = previous release createdAt, membership by dev ancestry.
// - public after rcs: release PR commits (relShas) plus ancestry; time window cuts older PRs.
// - first release (no previous): candidates capped to newest FIRST_RUN_CAP PRs.
// - re-run: existing `<!-- released:` marker skips the PR.
export function selectReleasedPrs({ candidates, since, prerelease, relPr, relShas, isAncestor }) {
	const sinceMs = since === null ? Number.NEGATIVE_INFINITY : Date.parse(since);
	const numbered = candidates.filter((pr) => {
		if (Number.isInteger(pr.number)) {
			return true;
		}
		console.log(`::warning::Skipping candidate without a valid PR number: ${JSON.stringify(pr.number)}`);
		return false;
	});
	return numbered
		.filter((pr) => {
			const oid = pr.mergeCommit?.oid;
			if (!oid || pr.number === relPr || isReleasePr(pr) || Date.parse(pr.mergedAt) <= sinceMs) {
				return false;
			}
			return (!prerelease && relShas.has(oid)) || isAncestor(oid);
		})
		.map(({ number, title }) => ({ number, title }))
		.sort((a, b) => a.number - b.number);
}

function realExec(cmd, args, input) {
	return execFileSync(cmd, args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] });
}

function readPackageName() {
	const pkgJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
	return pkgJson.name;
}

function errorMessage(err) {
	return err instanceof Error ? err.message : 'unknown error';
}

export async function main(env = process.env, { exec = realExec } = {}) {
	const tag = env.TAG?.trim();
	if (!tag) {
		console.error('TAG is required');
		return 1;
	}
	const repo = env.GH_REPO || env.GITHUB_REPOSITORY;
	if (!repo) {
		console.error('GH_REPO or GITHUB_REPOSITORY is required');
		return 1;
	}

	const prerelease = env.PRERELEASE === 'true';
	const dryRun = env.DRY_RUN === 'true';
	const addLabel = env.ADD_LABEL === 'true';
	const npmTag = npmTagFor(prerelease);

	const tagSha = exec('git', ['rev-list', '-n1', tag]).trim();
	const releases = JSON.parse(
		exec('gh', ['release', 'list', '--repo', repo, '--limit', '100', '--json', 'tagName,createdAt,isDraft']),
	);
	const previous = pickPreviousRelease(releases, tag);
	const since = previous?.createdAt ?? null;
	if (since === null) {
		console.log(`::warning::No previous release found; limiting candidates to the newest ${FIRST_RUN_CAP} merged PRs`);
	}

	const byNumber = new Map();
	for (const base of ['dev', 'main']) {
		const merged = JSON.parse(
			exec('gh', [
				'pr',
				'list',
				'--repo',
				repo,
				'--state',
				'merged',
				'--base',
				base,
				'--limit',
				String(PR_LIST_LIMIT),
				'--json',
				'number,title,mergedAt,mergeCommit,headRefName,baseRefName',
			]),
		);
		if (merged.length >= PR_LIST_LIMIT) {
			console.log(`::warning::Reached the ${PR_LIST_LIMIT} PR cap for base ${base}; older PRs may be missed`);
		}
		for (const pr of merged) {
			byNumber.set(pr.number, pr);
		}
	}
	let candidates = [...byNumber.values()].sort((a, b) => Date.parse(b.mergedAt) - Date.parse(a.mergedAt));
	if (since === null) {
		candidates = candidates.slice(0, FIRST_RUN_CAP);
	}

	let relPr = null;
	let relShas = new Set();
	if (!prerelease) {
		try {
			const subject = exec('git', ['log', '-1', '--format=%s', tagSha]).trim();
			const match = RELEASE_SUBJECT.exec(subject);
			if (match) {
				const number = Number(match[1]);
				const view = JSON.parse(
					exec('gh', ['pr', 'view', String(number), '--repo', repo, '--json', 'baseRefName,headRefName']),
				);
				if (view.baseRefName === 'main' && view.headRefName === 'dev') {
					const shas = exec('gh', ['api', '--paginate', `repos/${repo}/pulls/${number}/commits`, '--jq', '.[].sha'])
						.split(/\r?\n/)
						.filter(Boolean);
					if (shas.length >= COMMIT_CAP) {
						console.log(
							`::warning::Release PR #${number} reached the ${COMMIT_CAP} commit cap; some PRs may be missed`,
						);
					}
					relPr = number;
					relShas = new Set(shas);
				}
			}
			if (relPr === null) {
				console.log('::warning::Release PR not identified; falling back to ancestry only');
			}
		} catch (err) {
			console.log(`::warning::Release PR lookup failed: ${errorMessage(err)}`);
		}
	}

	const isAncestor = (sha) => {
		try {
			exec('git', ['merge-base', '--is-ancestor', sha, tagSha]);
			return true;
		} catch {
			return false;
		}
	};
	const selected = selectReleasedPrs({ candidates, since, prerelease, relPr, relShas, isAncestor });

	if (addLabel && !dryRun) {
		try {
			exec('gh', [
				'label',
				'create',
				LABEL,
				'--repo',
				repo,
				'--color',
				LABEL_COLOR,
				'--description',
				'Shipped in a release',
			]);
		} catch {
			// label already exists
		}
	}

	const body = buildComment({ tag, npmTag, repo, pkg: readPackageName() });
	let posted = 0;
	let skipped = 0;
	let failed = 0;
	for (const pr of selected) {
		try {
			const existing = exec('gh', [
				'api',
				'--paginate',
				`repos/${repo}/issues/${pr.number}/comments`,
				'--jq',
				'.[].body',
			]);
			if (hasReleaseMarker([existing])) {
				skipped += 1;
				continue;
			}
			if (dryRun) {
				console.log(`[dry-run] would comment on #${pr.number}: ${body.split(/\r?\n/)[0]}`);
				continue;
			}
			exec('gh', ['pr', 'comment', String(pr.number), '--repo', repo, '--body-file', '-'], body);
			if (addLabel) {
				exec('gh', ['pr', 'edit', String(pr.number), '--repo', repo, '--add-label', LABEL]);
			}
			posted += 1;
		} catch (err) {
			failed += 1;
			console.log(`::warning::Failed to comment on #${pr.number}: ${errorMessage(err)}`);
		}
	}

	console.log(
		`release-comment ${tag}: selected=${selected.length} posted=${posted} skipped=${skipped} failed=${failed} dryRun=${dryRun}`,
	);
	return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	process.exitCode = await main();
}
