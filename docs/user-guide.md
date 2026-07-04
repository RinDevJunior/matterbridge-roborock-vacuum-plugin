# User Guide — Working With the Claude Orchestration Ecosystem

How to get the best results (and the lowest token cost) from the agent setup in `.claude/`. Written for the human driving the session — you.

---

## 1. What you are talking to

The main Claude Code session is the **Engineer Manager (EM)**. It never writes code itself — it routes your request down one of three paths and dispatches specialist subagents:

```text
Your request
  │
  ├── LOW complexity ──────→ direct-executor (one agent, done)
  │
  ├── MEDIUM / HIGH ───────→ technical-architect → briefer → YOUR APPROVAL
  │                          → implementer → reviewer → test-writer → documenter
  │
  └── Question (how/why) ──→ technical-architect (explain mode) → answer.md
```

On-demand only (never automatic): `compiler` (build/test verify), `finalizer` (commit prep), `release-manager` (version bump), `wiki-manager` update mode (wiki refresh).

---

## 2. Cheat sheet — what to say

| You want                          | Say something like                               | What runs                       |
| --------------------------------- | ------------------------------------------------ | ------------------------------- |
| Small fix, one file, config, docs | "Fix the typo in X" / "add a log line to Y"      | direct-executor (lite path)     |
| Feature or bug, 2–5 files         | "Add feature X" — mention files if you know them | Full pipeline, approval gate    |
| Big / cross-module change         | "This is high complexity: …"                     | Full pipeline + investigator    |
| Understand behavior               | "Explain how X works" / "is there a way to…"     | Explain mode → answer, no code  |
| Skip all process                  | "direct", "skip the flow", "run this directly"   | direct-executor                 |
| Verify build/tests                | "run the compiler"                               | compiler                        |
| Prepare a commit                  | "finalize" / "suggest a commit message"          | finalizer                       |
| Cut a release                     | "cut a release" (+ optional notes)               | release-manager                 |
| Refresh the wiki                  | "update the wiki"                                | wiki-manager (update mode)      |
| Continue previous work            | "follow-up: …" (same session)                    | Resumes the same agent, cheaper |

---

## 3. The three paths

### Lite path (low complexity) — the default for small work

One `direct-executor` spawn. No task folder, no plan, no approval gate. Your safety net is that **nothing is ever committed without you** — review the diff before committing.

Best results when you state the target precisely: file name, function name, expected behavior. If the executor discovers the task is bigger than it looked, it stops and the EM restarts it through the full pipeline — that's intended, not a failure.

### Full pipeline (medium / high)

1. EM clarifies and confirms complexity with you.
2. `technical-architect` writes `plan.md` in an ephemeral `docs/<task>/` folder.
3. `briefer` writes a plain-language business brief; the EM prints it in chat.
4. **You approve or request changes.** Nothing is implemented before approval.
5. implementer → reviewer → test-writer (medium/high) → documenter run in sequence.

The approval gate is your main steering point: reject the brief with one sentence of feedback and the architect replans without restarting the cycle.

### Explain mode (questions)

Ask "how does X work?" and the architect researches and writes `answer.md`. The EM itself never reads source code for questions — this keeps your long-lived main session small. If the answer makes you want a change, that's a new task cycle.

---

## 4. Token-saving habits (Claude Pro, 5-hour window)

The setup is already optimized (slim shared instructions, haiku for most agents, lite path for small tasks). These habits are the part only you can do:

1. **State complexity up front.** "Low complexity: rename this constant" skips clarification round-trips and goes straight to the lite path. Every avoided back-and-forth is main-session context saved.
2. **Batch related small tasks into one request.** "Direct: fix A, B, and C" is one executor spawn instead of three cycles.
3. **Say "follow-up" for work in the same area.** The EM resumes the existing agent (which still holds the relevant files in context) instead of spawning fresh and re-reading everything.
4. **Use explain mode for questions** instead of asking the EM to "look at the code and tell me…" — that phrasing pulls source files into the main session where they get re-paid every turn.
5. **Keep the CodeGraph index fresh** (`npm run codegraph:init`). One `codegraph explore` call replaces dozens of Grep/Read calls in every planning and implementation agent.
6. **Don't paste large logs or diffs into chat.** Say "run the compiler" or "run finalizer" — those agents are context sinks that read the noise and return a summary.
7. **Start a new session for a new topic.** A long session carries all prior context on every turn. Wrap up (commit) and start clean when switching feature areas.
8. **Batch wiki refreshes.** The wiki no longer updates after every task — ask for "update the wiki" once every few tasks or before a release.
9. **Don't upgrade models by hand.** Haiku agents escalate themselves by reporting they're blocked; the EM only bumps to sonnet when that happens or you ask.

Rough cost intuition: a lite-path task ≈ 1 agent spawn; a medium task ≈ 6 spawns (2 sonnet); a high task ≈ 8 (4 sonnet). Explain mode ≈ 1 sonnet spawn.

---

## 5. When English is hard — avoiding wasted work

You do not need perfect English to drive this system. The safeguards, in order:

1. **Write in Vietnamese when unsure.** Claude reads Vietnamese natively. The EM restates your request in simple English before doing anything — that restatement is your translation check.
2. **The requirement echo (medium/high).** Before the architect is spawned, the EM shows you "what will change / what will NOT change" in 2–4 short bullets and asks you to confirm. Correcting a wrong echo costs one message; a wrong plan costs two sonnet spawns — so read the echo carefully, it is the cheapest place to say "no".
3. **Before → after beats description.** The most language-proof way to specify anything: "now: X happens. I want: Y to happen." One concrete example outruns a paragraph.
4. **The brief approval gate.** The business brief is written for a non-native reader (short sentences, no jargon). If it does not match what you wanted, choose Request Changes — the architect replans from your feedback without restarting.
5. **Lite path restate.** For small tasks the EM restates your request in one line as it starts — if the line is wrong, interrupt immediately.

Where a misunderstanding gets caught and what it costs:

| Caught at            | Cost                                                |
| -------------------- | --------------------------------------------------- |
| Requirement echo     | ~free (one chat message)                            |
| Business brief       | 2 spawns (architect + briefer) — replan via resume  |
| After implementation | the expensive case — the two gates above prevent it |

---

## 6. A typical day

```text
"Low: bump the log level in mapInfoListener to debug"     → lite path, done in one pass
"Add per-room cleaning support"                            → EM asks 2 questions → confirms medium
   → plan → brief printed → you: "Approve"                 → implement/review/tests/docs
"follow-up: also expose it in the schema"                  → resumes the same cycle's agents
"explain how room names are resolved for B01"              → answer.md presented, no code touched
"finalize"                                                 → cleanup, format, precommit, commit message
git commit -m "<suggested message>"                        → you commit; agents never do
"update the wiki"                                          → batched wiki refresh (every few tasks)
```

---

## 7. Where things live

| Path                                               | What it is                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| `.claude/CLAUDE.md`                                | Slim shared rules — loaded by every session and subagent          |
| `.claude/instructions/team-orchestrator-policy.md` | Full EM playbook — main session only                              |
| `.claude/instructions/agent-prompts.md`            | Spawn templates the EM uses                                       |
| `.claude/agents/*.md`                              | Each specialist's definition (model, tools, workflow, gates)      |
| `.claude/memory.md`                                | Durable project knowledge — committed, shared across sessions     |
| `docs/<task>/`                                     | Ephemeral per-task artifacts (plan, brief) — deleted by finalizer |
| `docs/claude_history.md`, `docs/to_do.md`          | Permanent history and task list — updated by documenter           |
| `wiki/`                                            | Curated architecture docs — refreshed in batches by wiki-manager  |

---

## 8. Troubleshooting

- **EM starts coding by itself / ignores the flow** → run `/load-policy` to force-load the playbook.
- **Brief isn't what you meant** → choose "Request Changes" and say what's wrong in one or two sentences; the architect replans from your feedback.
- **Lint/format/test failures after a task** → don't fix by hand and don't let the EM edit source; say "resume the implementer (or test-writer) with the failure output".
- **Agent seems to over-explore** → check `.codegraph/` exists; without the index every agent falls back to token-heavy Grep/Read sweeps.
- **You hit the usage limit mid-task** → state is on disk (`docs/<task>/plan.md`, the diff). In the next session: "continue the task in docs/<task>/ — plan is approved, implementation was in progress."
- **A subagent asks you something odd** → answer briefly or tell the EM to make the conservative choice; long answers to subagents are cheap (their context is disposable), long EM chats are not.
