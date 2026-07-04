# Pro Tips — How Experienced Claude Engineers Work

A reference to re-read when drifting. Written 2026-07-04, based on how experienced Claude Code users (including Anthropic engineers) actually work. The scorecard at the bottom is personal — update it as habits change.

---

## The nine patterns

### 1. Run less orchestration, not more

Most pros use vanilla Claude Code + a well-maintained CLAUDE.md + a few skills + git. Heavy custom pipelines are rare — every orchestration layer adds its own failure modes. The best config is the one you stop editing. When tempted to add another agent or skill, wait until the same pain has appeared three times.

### 2. Spend effort on the plan, not the code

A wrong plan executed perfectly is the most expensive failure. Argue with the plan **before** generation starts, not after. Get the spec right, then let execution be cheap.

### 3. Give Claude a way to check its own work — the biggest multiplier

Fast tests, strict typecheck, lint. Claude with a feedback loop self-corrects in seconds; Claude without one confidently ships a wrong guess. Invest here before investing anywhere else.

### 4. Read diffs, not transcripts

The review unit is `git diff`. Small frequent commits, one task per branch, git as the undo button. If a session went sideways, don't argue with it — reset and re-prompt with better instructions.

### 5. Interrupt early

Watch the first 30 seconds of a run. If the direction is wrong, stop it immediately — correcting at step 2 costs nothing; a finished wrong implementation costs the whole run. Letting a doomed run finish "to see what happens" is the most common token burn.

### 6. Context hygiene is a discipline

`/clear` between unrelated tasks, fresh session per feature, one error message instead of a 500-line log. Many short focused sessions beat one heroic all-day thread — long contexts degrade quality, not just cost.

### 7. Fix the config, not the prompt

When Claude makes the same mistake twice: recurring correction → CLAUDE.md rule; recurring workflow → skill; recurring lookup → doc. If you've typed the same instruction in three prompts, it's configuration, not prompting.

### 8. Parallelize with worktrees and background sessions

Independent tasks in separate git worktrees or web sessions, checked on like a lead reviewing a small team. Automate the periphery headlessly (`claude -p` in CI): PR triage, labels, changelog drafts.

### 9. Delegate the mechanical 80%, keep the judgment 20%

Claude gets tests, refactors, migrations, boilerplate, docs, "make this pattern exist in five more places." The human keeps architecture decisions, API design, and anything where being wrong is expensive and quiet.

---

## Personal scorecard (as of 2026-07-04)

### Doing well — keep it

- **Plan-first (#2)** — the approval gate forces spec review before implementation; the requirement echo catches misunderstandings before any agent spawns.
- **Fix the config (#7)** — `memory.md` collects pitfalls, skills capture repeated workflows (`/ref-idea`, `/status-of`), CLAUDE.md carries the rules. This whole system is pattern #7 done seriously.
- **Context hygiene (#6)** — compact `*:ci` scripts, context-sink agents (compiler, finalizer), artifacts flowing through files instead of chat.
- **Diff-based review (#4)** — nothing commits without the user; finalizer prepares, human commits.
- **Simplicity instinct (#1)** — said "too complicated, keep it simple" to the capture skill. That is the pro answer. Protect this instinct against the urge to keep adding agents.

### To improve — in priority order

1. **Interrupt early (#5)** — cheapest habit with the biggest payoff. Read the one-line restate at the top of every lite-path run; if it's wrong, stop the run immediately instead of waiting for the report.
2. **Self-checking loop for hardware (#3)** — the `*:ci` scripts cover code, but protocol work has no fast feedback (see the Int32LE/UInt16LE incident in memory.md). Until a capture workflow exists, treat every unverified protocol guess as a draft, never as done.
3. **Session rhythm (#6, remaining half)** — start sessions from `docs/to_do.md` ("do the top item") instead of re-explaining context; start heavy pipelines right after the 5h window resets; switch to lite tasks + finalize when near the limit.
4. **Parallelism (#8)** — currently mostly serial. When two tasks touch different files, run them as parallel background agents or separate sessions. Rule: parallelize only when the write-sets don't overlap.
5. **Freeze the config (#1)** — the setup is now three skills, eleven agents, and a slim policy. Use it for a few weeks without changes; only fix what actually hurts twice.

### Standing rule for this file

When a habit moves from "to improve" to "doing well" (or a new bad habit appears), update the scorecard — same discipline as memory.md, but for the human.
