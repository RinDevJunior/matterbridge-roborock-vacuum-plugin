# Agent Prompts

Use these prompt templates when the **main session (Engineer Manager)** spawns subagents via the `Agent` tool.

System prompts live in `.claude/agents/`. Read the matching file before spawning — Cursor does not auto-load them; the prompt must carry the agent's role and the user's request.

**Model policy:** do **not** pass `model:` — each agent's frontmatter is the source of truth. Single exception: `implementer` on **high** complexity gets `model: "sonnet"`.

**Nested planning:** main session spawns `technical-architect` only. Architect nests `wiki-manager` (gather, high complexity) and `investigator` — never spawn those from the main session during planning.

**Lite path:** low-complexity tasks go straight to `direct-executor` — no task folder, no architect, no briefer, no approval cycle.

**Explain mode:** main session spawns `technical-architect` with `type: explain`; architect writes `answer.md`. EM must not read `src/` or `wiki/`.

---

## 🟣 Technical Architect

**Implement mode** (medium/high complexity):

```
Agent({
  description: "Architecture plan: <task summary>",
  subagent_type: "technical-architect",
  prompt: "Task folder: docs/<short-task-description>/\nRequirement file: docs/<short-task-description>/requirement.md\ntype: implement\nComplexity: medium | high"
})
```

**Explain mode** (user Q&A — EM must not read source code):

```
Agent({
  description: "Explain: <question summary>",
  subagent_type: "technical-architect",
  prompt: "Task folder: docs/<short-task-description>/\nRequirement file: docs/<short-task-description>/requirement.md\ntype: explain\n\nWrite answer.md (not plan.md). Read memory/wiki directly; spawn investigator for deep traces."
})
```

Spawned by **main session**. Researches internally (direct reads for medium; nests `wiki-manager` + `investigator` for high). Writes `plan.md` (+ `test-plan.md`) or `answer.md`, and returns a **≤10-line summary** — EM reviews the summary, not the files.

---

## ⬜ Wiki Manager

**Gather mode** (nested — spawned by technical-architect, high complexity only):

```
Agent({
  description: "Wiki: <task summary>",
  subagent_type: "wiki-manager",
  prompt: "Task folder: docs/<short-task-description>/\nRequirement file: docs/<short-task-description>/requirement.md"
})
```

**Update mode** (spawned by main session — only on user request or before a release, never automatically per cycle):

```
Agent({
  description: "Wiki update: <task summary>",
  subagent_type: "wiki-manager",
  prompt: "Mode: update\nRecent changes: <latest docs/claude_history.md entries or summary>\nTask folder (optional): docs/<short-task-description>/"
})
```

Leaf subagent (no `Agent` tool). Writes `wiki-brief.md` (gather) or edits `wiki/` (update).

---

## 🔵 Investigator (nested only — do not spawn from EM)

```
Agent({
  description: "Investigate: <task summary>",
  subagent_type: "investigator",
  prompt: "Task folder: docs/<short-task-description>/\nWiki brief (if present): docs/<short-task-description>/wiki-brief.md\nQuestion files: docs/<short-task-description>/questions-<topic>.md"
})
```

Spawned by **technical-architect** only when complex gaps remain. Leaf subagent. Deep investigation — not trivial lookups.

---

## 🟤 Briefer

Business mode (default):

```
Agent({
  description: "Brief: <task summary>",
  subagent_type: "briefer",
  prompt: "Task folder: docs/<short-task-description>/"
})
```

Technical mode (only when the user asks for a technical explanation — resume `briefer_id` if it exists, else spawn fresh with this prompt):

```
Agent({
  description: "Technical brief: <task summary>",
  subagent_type: "briefer",
  prompt: "Task folder: docs/<short-task-description>/\nmode: technical"
})
```

Run AFTER Technical Architect returns (`Status: ready`). Reads `requirement.md` and `plan.md`, writes `business-brief.md` only — EM presents the brief and runs approval. Technical mode additionally writes `technical-brief.md` — not run unless requested.

---

## 🟢 Implementer

```
Agent({
  description: "Implement: <task summary>",
  subagent_type: "implementer",
  // model: "sonnet" — ONLY for high complexity; omit otherwise (haiku frontmatter)
  prompt: "Task folder: docs/<short-task-description>/"
})
```

Run AFTER user approves `business-brief.md`. Follows `plan.md`. Before reporting: `npm run format:ci` → `npm run lint:fix:ci` (both must PASS).

---

## 🟡 Test Writer

```
Agent({
  description: "Tests: <task summary>",
  subagent_type: "test-writer",
  prompt: "Task folder: docs/<short-task-description>/"
})
```

Run AFTER Implementer and Reviewer. Before reporting: `npm run format:ci` → `npm run lint:fix:ci` → `npm run test:ci` (all must PASS).

---

## 🔴 Compiler

```
Agent({
  description: "Compiler: lint, build, test",
  subagent_type: "compiler",
  prompt: "Run lint, build, type-check, and tests. Return the compiler report."
})
```

Run only when explicitly requested by the user.

---

## 🟠 Reviewer

```
Agent({
  description: "Review: <task summary>",
  subagent_type: "reviewer",
  prompt: "Task folder: docs/<short-task-description>/"
})
```

Run AFTER Implementer completes (medium/high; for lite-path tasks only when security-sensitive or user asks). Compares diff against `plan.md`.

---

## 🩵 Documenter

```
Agent({
  description: "Docs: update history and todo",
  subagent_type: "documenter",
  prompt: "Task folder: docs/<short-task-description>/"
})
```

Run after Reviewer approves. Skip for investigation-only tasks. Does **not** trigger a wiki refresh — that is batched (see Wiki Manager update mode).

---

## ⬜ Finalizer

```
Agent({
  description: "Finalize: clean, stage, format, precommit, commit message",
  subagent_type: "finalizer",
  prompt: "Task folder (optional): docs/<short-task-description>/\nPaths to stage (optional): <paths or omit for session changes>\nUser notes: <optional>"
})
```

Run when the user wants commit prep or a commit message. Full pipeline: discover ephemeral paths → `clean-paths.mjs` → `git add` → `npm run format:ci` → re-stage → `npm run precommit:ci` → `npm run diff:ci` → commit message **only if precommit passes**.

**Cleanup only** (user just wants ephemeral docs deleted — "clean up docs", "run cleaner"):

```
Agent({
  description: "Finalize: cleanup ephemeral docs only",
  subagent_type: "finalizer",
  prompt: "Task folder: docs/<short-task-description>/\nmode: cleanup only\nUser notes: <optional>"
})
```

In **Cursor**, use `subagent_type: "generalPurpose"` and embed Finalizer rules from `.claude/agents/finalizer.md`.

---

## 🟠 Release Manager

```
Agent({
  description: "Release: bump version and changelog",
  subagent_type: "release-manager",
  prompt: "<optional: user-provided changelog notes>"
})
```

Run only when the user explicitly requests a release. Good moment to also run wiki-manager (update mode) if wiki refreshes have been batched up.

---

## 🔷 Direct Executor

**Default for low-complexity tasks**, and for any ad-hoc request where the user opts out of the flow. Bypasses task folder, architect, briefer, approval, reviewer, and documenter unless the user asks for those separately.

```
Agent({
  description: "Direct: <short summary>",
  subagent_type: "direct-executor",
  prompt: "USER REQUEST:\n<verbatim user request>\n\nCONSTRAINTS (if any):\n<optional scope limits from manager>"
})
```

In **Cursor**, use `subagent_type: "generalPurpose"` and embed the Direct Executor rules from `.claude/agents/direct-executor.md` in the prompt (there is no built-in `direct-executor` Task type).

Spawn when: the task is **low complexity**, or the user says e.g. "direct-executor", "run this directly", "skip the flow", "/direct".

Do **not** create `docs/<task>/requirement.md` for this path.
