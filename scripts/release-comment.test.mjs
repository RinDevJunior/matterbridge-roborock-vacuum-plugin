/* eslint-disable no-console */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	buildComment,
	hasReleaseMarker,
	isReleasePr,
	main,
	MARKER_PREFIX,
	npmTagFor,
	pickPreviousRelease,
	selectReleasedPrs,
} from './release-comment.mjs';

const REPO = 'owner/repo';
const PKG = 'matterbridge-roborock-vacuum-plugin';
const TAG_RC07 = '1.2.0-rc07';
const TAG_FINAL = '1.2.0';
const TAG_SHA = 'tagsha';
const SINCE = '2026-10-01T00:00:00Z';

const RC06 = { tagName: '1.2.0-rc06', createdAt: '2026-10-01T00:00:00Z', isDraft: false };
const RC07 = { tagName: TAG_RC07, createdAt: '2026-10-10T00:00:00Z', isDraft: false };
const FINAL = { tagName: TAG_FINAL, createdAt: '2026-10-17T00:00:00Z', isDraft: false };

function pr({
	number,
	title = `feat: change ${number}`,
	mergedAt = '2026-10-05T00:00:00Z',
	oid = `sha${number}`,
	headRefName = `feat/${number}`,
	baseRefName = 'dev',
	mergeCommit = { oid },
} = {}) {
	return { number, title, mergedAt, mergeCommit, headRefName, baseRefName };
}

/**
 * Fake exec: records every call and answers gh/git from a fixture.
 * `comments` maps PR number -> bodies and is mutated by `gh pr comment`,
 * so re-running main against the same fixture simulates a second run.
 */
function createFakeExec(fixture = {}) {
	const calls = [];
	const comments = fixture.comments ?? {};
	const ancestors = new Set(fixture.ancestors ?? []);

	const execGit = (args) => {
		if (args[0] === 'rev-list') {
			return `${fixture.tagSha ?? TAG_SHA}\n`;
		}
		if (args[0] === 'log') {
			return `${fixture.subject ?? 'feat: work (#200)'}\n`;
		}
		if (args[0] === 'merge-base') {
			if (ancestors.has(args[2])) {
				return '';
			}
			throw new Error('not an ancestor');
		}
		throw new Error(`unexpected git ${args.join(' ')}`);
	};

	const execGh = (args, input) => {
		const [group, sub] = args;
		if (group === 'release') {
			return JSON.stringify(fixture.releases ?? []);
		}
		if (group === 'pr' && sub === 'list') {
			const base = args[args.indexOf('--base') + 1];
			return JSON.stringify(fixture.prs?.[base] ?? []);
		}
		if (group === 'pr' && sub === 'view') {
			if (!fixture.releasePr) {
				throw new Error('no such PR');
			}
			return JSON.stringify(fixture.releasePr);
		}
		if (group === 'pr' && sub === 'comment') {
			const number = Number(args[2]);
			if (fixture.commentFails?.includes(number)) {
				throw new Error('HTTP 500');
			}
			comments[number] = [...(comments[number] ?? []), input];
			return '';
		}
		if (group === 'pr' && sub === 'edit') {
			return '';
		}
		if (group === 'label') {
			return '';
		}
		if (group === 'api') {
			const endpoint = args[2];
			if (endpoint.includes('/pulls/')) {
				return (fixture.releaseShas ?? []).join('\n');
			}
			const number = Number(/issues\/(\d+)\//.exec(endpoint)?.[1]);
			if (fixture.commentListFails?.includes(number)) {
				throw new Error('HTTP 502');
			}
			return (comments[number] ?? []).join('\n');
		}
		throw new Error(`unexpected gh ${args.join(' ')}`);
	};

	const exec = (cmd, args, input) => {
		calls.push({ cmd, args, input });
		return cmd === 'git' ? execGit(args) : execGh(args, input);
	};

	return { exec, calls, comments };
}

function commentCalls(calls) {
	return calls.filter((c) => c.cmd === 'gh' && c.args[0] === 'pr' && c.args[1] === 'comment');
}

function commentedNumbers(calls) {
	return commentCalls(calls).map((c) => Number(c.args[2]));
}

async function runMain(env = {}, fixture = {}) {
	const fake = createFakeExec(fixture);
	const code = await main({ TAG: TAG_RC07, PRERELEASE: 'true', GH_REPO: REPO, ...env }, { exec: fake.exec });
	return { code, ...fake };
}

// rc07 run: since = rc06 createdAt. Eligible: 173, 175. Ineligible: 170 (before since),
// 174 (no merge commit), 176 (not an ancestor), 177 (dev->main release PR).
const RC_FIXTURE = {
	releases: [RC06, RC07],
	prs: {
		dev: [
			pr({ number: 173, title: 'fix: rc06 range work (#173)', mergedAt: '2026-10-05T00:00:00Z' }),
			pr({ number: 170, mergedAt: '2026-09-20T00:00:00Z' }),
			pr({ number: 174, mergeCommit: null }),
			pr({ number: 175, mergedAt: '2026-10-07T00:00:00Z' }),
			pr({ number: 176 }),
		],
		main: [pr({ number: 177, headRefName: 'dev', baseRefName: 'main', mergedAt: '2026-10-08T00:00:00Z' })],
	},
	ancestors: ['sha173', 'sha170', 'sha175', 'sha177'],
};

// public 1.2.0 run: previous = rc07. Release PR #147 (dev->main, 2 commits in this fixture).
const PUBLIC_FIXTURE = {
	releases: [RC06, RC07, FINAL],
	subject: 'Release 1.2.0 (#147)',
	releasePr: { baseRefName: 'main', headRefName: 'dev' },
	releaseShas: ['sha180', 'sha150'],
	prs: {
		dev: [pr({ number: 180, mergedAt: '2026-10-12T00:00:00Z' }), pr({ number: 150, mergedAt: '2026-10-05T00:00:00Z' })],
		main: [
			pr({ number: 147, headRefName: 'dev', baseRefName: 'main', mergedAt: '2026-10-16T00:00:00Z' }),
			pr({ number: 190, mergedAt: '2026-10-14T00:00:00Z', baseRefName: 'main' }),
		],
	},
	ancestors: ['sha190'],
};

describe('release-comment', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, 'log').mockImplementation(() => undefined);
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('npmTagFor', () => {
		it('should return dev when prerelease', () => {
			expect(npmTagFor(true)).toBe('dev');
		});

		it('should return latest when not prerelease', () => {
			expect(npmTagFor(false)).toBe('latest');
		});
	});

	describe('buildComment', () => {
		const rcBody = buildComment({ tag: TAG_RC07, npmTag: 'dev', repo: REPO, pkg: PKG });
		const publicBody = buildComment({ tag: TAG_FINAL, npmTag: 'latest', repo: REPO, pkg: PKG });

		it('should start with the exact released marker line when built for rc', () => {
			expect(rcBody.split(/\r?\n/)[0]).toBe(`<!-- released:${TAG_RC07} -->`);
		});

		it('should contain release URL, npm version URL and dev tag when built for rc', () => {
			expect(rcBody).toContain(`https://github.com/${REPO}/releases/tag/${TAG_RC07}`);
			expect(rcBody).toContain(`https://www.npmjs.com/package/${PKG}/v/${TAG_RC07}`);
			expect(rcBody).toContain('npm tag `dev`');
		});

		it('should start with the marker and contain latest tag when built for public release', () => {
			expect(publicBody.split(/\r?\n/)[0]).toBe(`<!-- released:${TAG_FINAL} -->`);
			expect(publicBody).toContain(`https://github.com/${REPO}/releases/tag/${TAG_FINAL}`);
			expect(publicBody).toContain(`https://www.npmjs.com/package/${PKG}/v/${TAG_FINAL}`);
			expect(publicBody).toContain('npm tag `latest`');
		});

		it('should have no trailing spaces on any line', () => {
			for (const body of [rcBody, publicBody]) {
				expect(body.split(/\r?\n/).every((line) => line === line.trimEnd())).toBe(true);
			}
		});
	});

	describe('hasReleaseMarker', () => {
		it('should return true when a body contains the rc06 marker', () => {
			expect(hasReleaseMarker([`${MARKER_PREFIX}1.2.0-rc06 -->\nReleased`])).toBe(true);
		});

		it('should return true when the marker is for a different version', () => {
			expect(hasReleaseMarker([`${MARKER_PREFIX}1.1.9 -->`])).toBe(true);
		});

		it('should return false when the comment list is empty', () => {
			expect(hasReleaseMarker([])).toBe(false);
		});

		it('should return false when comments are unrelated', () => {
			expect(hasReleaseMarker(['LGTM', '<!-- other: note -->'])).toBe(false);
		});
	});

	describe('isReleasePr', () => {
		it('should return true when head branch is release/*', () => {
			expect(isReleasePr(pr({ number: 1, headRefName: 'release/1.2.0', baseRefName: 'main' }))).toBe(true);
		});

		it('should return true when merging dev into main', () => {
			expect(isReleasePr(pr({ number: 2, headRefName: 'dev', baseRefName: 'main' }))).toBe(true);
		});

		it('should return true when title is a bare version, ignoring surrounding whitespace', () => {
			expect(isReleasePr(pr({ number: 3, title: ' 1.2.0 ' }))).toBe(true);
			expect(isReleasePr(pr({ number: 4, title: 'v1.2.0-rc07' }))).toBe(true);
		});

		it('should return false for a normal feature PR into dev', () => {
			expect(isReleasePr(pr({ number: 5, title: 'fix: stop hang (#184)', headRefName: 'fix/x' }))).toBe(false);
		});

		it('should return false when dev is the base and head is dev', () => {
			expect(isReleasePr(pr({ number: 6, headRefName: 'dev', baseRefName: 'dev' }))).toBe(false);
		});
	});

	describe('pickPreviousRelease', () => {
		it('should pick rc06 as previous when current is rc07', () => {
			expect(pickPreviousRelease([RC06, RC07], TAG_RC07)).toEqual({
				tagName: RC06.tagName,
				createdAt: RC06.createdAt,
			});
		});

		it('should pick rc07 as previous when current is the public 1.2.0', () => {
			expect(pickPreviousRelease([RC06, RC07, FINAL], TAG_FINAL)).toEqual({
				tagName: TAG_RC07,
				createdAt: RC07.createdAt,
			});
		});

		it('should ignore draft releases when picking previous', () => {
			const draft = { tagName: '1.2.0-rc065', createdAt: '2026-10-05T00:00:00Z', isDraft: true };
			expect(pickPreviousRelease([RC06, draft, RC07], TAG_RC07)?.tagName).toBe(RC06.tagName);
		});

		it('should pick the newest by createdAt regardless of array order', () => {
			const rc04 = { tagName: '1.2.0-rc04', createdAt: '2026-09-20T00:00:00Z', isDraft: false };
			const rc05 = { tagName: '1.2.0-rc05', createdAt: '2026-09-28T00:00:00Z', isDraft: false };
			expect(pickPreviousRelease([rc04, RC06, rc05, RC07], TAG_RC07)?.tagName).toBe(RC06.tagName);
		});

		it('should ignore releases created after the current one', () => {
			expect(pickPreviousRelease([RC06, RC07, FINAL], RC07.tagName)?.tagName).toBe(RC06.tagName);
		});

		it('should return null when only the current release exists', () => {
			expect(pickPreviousRelease([RC07], TAG_RC07)).toBeNull();
		});
	});

	describe('selectReleasedPrs', () => {
		const pick = (overrides = {}) =>
			selectReleasedPrs({
				candidates: [],
				since: SINCE,
				prerelease: true,
				relPr: null,
				relShas: new Set(),
				isAncestor: () => false,
				...overrides,
			});

		describe('rc case', () => {
			it('should include a PR that is an ancestor of the tag and merged after since', () => {
				const candidate = pr({ number: 173, title: 'fix: rc06 range (#173)' });
				const result = pick({ candidates: [candidate], isAncestor: (sha) => sha === 'sha173' });
				expect(result).toEqual([{ number: 173, title: candidate.title }]);
			});

			it('should exclude a PR merged before since', () => {
				const candidate = pr({ number: 170, mergedAt: '2026-09-20T00:00:00Z' });
				expect(pick({ candidates: [candidate], isAncestor: () => true })).toEqual([]);
			});

			it('should exclude a PR merged exactly at since', () => {
				const candidate = pr({ number: 171, mergedAt: SINCE });
				expect(pick({ candidates: [candidate], isAncestor: () => true })).toEqual([]);
			});

			it('should exclude a PR with no merge commit', () => {
				const candidate = pr({ number: 174, mergeCommit: null });
				expect(pick({ candidates: [candidate], isAncestor: () => true })).toEqual([]);
			});

			it('should exclude a PR whose merge commit is not an ancestor of the tag', () => {
				const candidate = pr({ number: 176 });
				expect(pick({ candidates: [candidate], isAncestor: () => false })).toEqual([]);
			});

			it('should ignore relShas in rc mode', () => {
				const candidate = pr({ number: 178 });
				const result = pick({ candidates: [candidate], relShas: new Set([candidate.mergeCommit.oid]) });
				expect(result).toEqual([]);
			});

			it('should return results sorted by number', () => {
				const candidates = [pr({ number: 175 }), pr({ number: 173 })];
				const result = pick({ candidates, isAncestor: () => true });
				expect(result.map((r) => r.number)).toEqual([173, 175]);
			});

			it('should include a revert PR like any other merged PR', () => {
				const candidate = pr({ number: 179, title: 'Revert "feat: x" (#179)', headRefName: 'revert-179' });
				expect(pick({ candidates: [candidate], isAncestor: () => true })).toHaveLength(1);
			});

			it('should include a dependabot-branch PR like any other merged PR', () => {
				const candidate = pr({ number: 180, headRefName: 'dependabot/npm_and_yarn/vite-7.0.0' });
				expect(pick({ candidates: [candidate], isAncestor: () => true })).toHaveLength(1);
			});
		});

		describe('public case', () => {
			const relShas = new Set(['sha180', 'sha150']);

			it('should include a PR in relShas that merged after since', () => {
				const candidate = pr({ number: 180, mergedAt: '2026-10-12T00:00:00Z' });
				const result = pick({
					candidates: [candidate],
					prerelease: false,
					relShas,
					isAncestor: () => false,
				});
				expect(result.map((r) => r.number)).toEqual([180]);
			});

			it('should exclude a PR in relShas that merged before since (already in an rc)', () => {
				const candidate = pr({ number: 150, mergedAt: '2026-10-05T00:00:00Z' });
				const result = pick({
					candidates: [candidate],
					since: RC07.createdAt,
					prerelease: false,
					relShas,
					isAncestor: () => false,
				});
				expect(result).toEqual([]);
			});

			it('should exclude the release PR by relPr number', () => {
				const candidate = pr({ number: 147, headRefName: 'chore/notes', baseRefName: 'main' });
				const result = pick({
					candidates: [candidate],
					prerelease: false,
					relPr: 147,
					relShas: new Set([candidate.mergeCommit.oid]),
				});
				expect(result).toEqual([]);
			});

			it('should include a main hotfix PR that is an ancestor of the tag', () => {
				const candidate = pr({ number: 190, baseRefName: 'main', mergedAt: '2026-10-14T00:00:00Z' });
				const result = pick({
					candidates: [candidate],
					prerelease: false,
					relShas,
					isAncestor: (sha) => sha === 'sha190',
				});
				expect(result.map((r) => r.number)).toEqual([190]);
			});
		});

		describe('candidates without a valid number', () => {
			it('should drop a candidate with undefined number and still select the others', () => {
				const valid = pr({ number: 173 });
				const result = pick({ candidates: [pr({ number: undefined }), valid], isAncestor: () => true });
				expect(result).toEqual([{ number: 173, title: valid.title }]);
			});

			it('should log a warning for each dropped candidate', () => {
				const candidates = [pr({ number: undefined }), pr({ number: null }), pr({ number: 175 })];
				pick({ candidates, isAncestor: () => true });
				const warnings = console.log.mock.calls.map((c) => c.join(' ')).filter((l) => l.includes('::warning::'));
				expect(warnings).toHaveLength(2);
			});

			it('should not log a warning when every candidate has a valid number', () => {
				pick({ candidates: [pr({ number: 173 })], isAncestor: () => true });
				expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('::warning::'));
			});

			it('should drop a candidate whose number is a numeric string and log a warning', () => {
				const valid = pr({ number: 173 });
				const result = pick({ candidates: [pr({ number: '174' }), valid], isAncestor: () => true });
				expect(result.map((r) => r.number)).toEqual([173]);
				expect(console.log).toHaveBeenCalledWith(expect.stringContaining('::warning::Skipping candidate'));
			});

			it('should drop a candidate whose number is null and still select the others', () => {
				const result = pick({ candidates: [pr({ number: null }), pr({ number: 175 })], isAncestor: () => true });
				expect(result.map((r) => r.number)).toEqual([175]);
			});

			it('should drop a candidate whose number is NaN and still select the others', () => {
				const result = pick({ candidates: [pr({ number: Number.NaN }), pr({ number: 176 })], isAncestor: () => true });
				expect(result.map((r) => r.number)).toEqual([176]);
			});
		});

		it('should include all valid candidates when since is null', () => {
			const old = pr({ number: 10, mergedAt: '2019-01-01T00:00:00Z' });
			const noMerge = pr({ number: 11, mergeCommit: null });
			const result = pick({ candidates: [old, noMerge], since: null, isAncestor: () => true });
			expect(result.map((r) => r.number)).toEqual([10]);
		});
	});

	describe('main', () => {
		it('should return 1 and call no gh or git when TAG is missing', async () => {
			const { code, calls } = await runMain({ TAG: undefined });
			expect(code).toBe(1);
			expect(calls).toHaveLength(0);
		});

		it('should return 1 and call no gh or git when TAG is only whitespace', async () => {
			const { code, calls } = await runMain({ TAG: '   ' });
			expect(code).toBe(1);
			expect(calls).toHaveLength(0);
		});

		it('should dry-run without posting, labelling or editing when DRY_RUN=true', async () => {
			const { code, calls } = await runMain({ DRY_RUN: 'true', ADD_LABEL: 'true' }, RC_FIXTURE);
			const subs = calls.filter((c) => c.cmd === 'gh').map((c) => `${c.args[0]} ${c.args[1]}`);
			expect(code).toBe(0);
			expect(subs).not.toContain('pr comment');
			expect(subs).not.toContain('label create');
			expect(subs).not.toContain('pr edit');
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[dry-run] would comment on #173'));
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[dry-run] would comment on #175'));
		});

		it('should post one rc comment per eligible PR using --body-file - with the marker', async () => {
			const { code, calls } = await runMain({}, RC_FIXTURE);
			expect(code).toBe(0);
			expect(commentedNumbers(calls)).toEqual([173, 175]);
			const first = commentCalls(calls)[0];
			expect(first.args).toEqual(['pr', 'comment', '173', '--repo', REPO, '--body-file', '-']);
			expect(first.input.split(/\r?\n/)[0]).toBe(`<!-- released:${TAG_RC07} -->`);
			expect(first.input).toContain('npm tag `dev`');
		});

		it('should not comment on PRs merged before since, without merge commits, or release PRs', async () => {
			const { calls } = await runMain({}, RC_FIXTURE);
			const numbers = commentedNumbers(calls);
			expect(numbers).not.toContain(170);
			expect(numbers).not.toContain(174);
			expect(numbers).not.toContain(176);
			expect(numbers).not.toContain(177);
		});

		it('should post 0 comments on a second run because the marker is present', async () => {
			const fixture = { ...RC_FIXTURE, comments: {} };
			await runMain({}, fixture);
			const second = await runMain({}, fixture);
			expect(commentedNumbers(second.calls)).toEqual([]);
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining('posted=0 skipped=2'));
		});

		it('should skip a PR whose existing marker is for an older version', async () => {
			const fixture = {
				...RC_FIXTURE,
				comments: { 173: [`${MARKER_PREFIX}1.2.0-rc06 -->\nReleased in rc06`] },
			};
			const { calls } = await runMain({}, fixture);
			expect(commentedNumbers(calls)).toEqual([175]);
		});

		it('should keep commenting other PRs and return 0 when one gh pr comment throws', async () => {
			const fixture = { ...RC_FIXTURE, commentFails: [173] };
			const { code, calls } = await runMain({}, fixture);
			expect(code).toBe(0);
			expect(commentedNumbers(calls)).toEqual([173, 175]);
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining('::warning::Failed to comment on #173'));
		});

		it('should keep commenting other PRs and return 0 when one comment lookup throws', async () => {
			const fixture = { ...RC_FIXTURE, commentListFails: [173] };
			const { code, calls } = await runMain({}, fixture);
			expect(code).toBe(0);
			expect(commentedNumbers(calls)).toEqual([175]);
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining('::warning::Failed to comment on #173'));
		});

		it('should resolve with code 0 when every gh pr comment fails', async () => {
			const fixture = { ...RC_FIXTURE, commentFails: [173, 175] };
			await expect(runMain({}, fixture)).resolves.toMatchObject({ code: 0 });
		});

		it('should also run gh label create and gh pr edit when ADD_LABEL=true', async () => {
			const { calls } = await runMain({ ADD_LABEL: 'true' }, RC_FIXTURE);
			const edit = calls.find((c) => c.cmd === 'gh' && c.args[0] === 'pr' && c.args[1] === 'edit');
			expect(edit?.args).toEqual(['pr', 'edit', '173', '--repo', REPO, '--add-label', 'released']);
			expect(calls.some((c) => c.cmd === 'gh' && c.args[0] === 'label' && c.args[1] === 'create')).toBe(true);
		});

		it('should not run gh pr edit when ADD_LABEL is unset', async () => {
			const { calls } = await runMain({}, RC_FIXTURE);
			expect(calls.some((c) => c.cmd === 'gh' && c.args[0] === 'pr' && c.args[1] === 'edit')).toBe(false);
			expect(calls.some((c) => c.cmd === 'gh' && c.args[0] === 'label')).toBe(false);
		});

		it('should use the public tag and exclude the release PR and pre-rc commits', async () => {
			const { code, calls } = await runMain({ PRERELEASE: 'false', TAG: TAG_FINAL, DRY_RUN: 'true' }, PUBLIC_FIXTURE);
			const logged = console.log.mock.calls.map((c) => c.join(' '));
			expect(code).toBe(0);
			expect(logged.some((l) => l.includes('#180'))).toBe(true);
			expect(logged.some((l) => l.includes('#190'))).toBe(true);
			expect(logged.some((l) => l.includes('#147'))).toBe(false);
			expect(logged.some((l) => l.includes('#150'))).toBe(false);
			expect(calls.some((c) => c.cmd === 'gh' && c.args[0] === 'api' && c.args[2].includes('/pulls/147/commits'))).toBe(
				true,
			);
		});

		it('should post the latest npm tag on a public release comment', async () => {
			const { calls } = await runMain({ PRERELEASE: 'false', TAG: TAG_FINAL }, PUBLIC_FIXTURE);
			expect(commentedNumbers(calls)).toEqual([180, 190]);
			expect(commentCalls(calls)[0].input).toContain('npm tag `latest`');
		});

		it('should pass every gh and git call as an array with no shell interpolation', async () => {
			const hostile = 'fix: "quoted" $(touch /tmp/pwned) `whoami`';
			const fixture = {
				...RC_FIXTURE,
				prs: { ...RC_FIXTURE.prs, dev: [pr({ number: 173, title: hostile }), ...RC_FIXTURE.prs.dev.slice(1)] },
			};
			const { calls } = await runMain({ ADD_LABEL: 'true' }, fixture);
			expect(calls.length).toBeGreaterThan(0);
			for (const call of calls) {
				expect(Array.isArray(call.args)).toBe(true);
				expect(['gh', 'git']).toContain(call.cmd);
				expect(call.args.some((arg) => arg.includes('pwned') || arg.includes(hostile))).toBe(false);
			}
		});
	});
});
