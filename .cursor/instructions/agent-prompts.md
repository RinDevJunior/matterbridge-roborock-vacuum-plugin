# Agent Prompts

Use these prompt templates when the **main session (Engineer Manager)** spawns subagents via the **`Task`** tool in Cursor.

**Model policy:** do **not** pass `model:` when spawning — each agent's `model` in `.cursor/agents/<name>.md` frontmatter is the source of truth. **Single exception:** `implementer` on **high** complexity gets `model: "claude-4.6-sonnet-medium"`.

**Frontmatter reference:**

| Slug                       | Agents                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `composer-2.5-fast`        | `briefer`, `compiler`, `documenter`, `finalizer`, `implementer` (default), `wiki-manager`              |
| `claude-4.6-sonnet-medium` | `technical-architect`, `investigator`, `reviewer`, `test-writer`, `direct-executor`, `release-manager` |

**Usage limit:** If a spawn fails because the preferred model hit a usage limit, **retry without `model`** (Cursor **Auto**). Do not upgrade to a heavier slug unless the user asks or the subagent reports it is blocked on reasoning.

System prompts live in `.cursor/agents/`. Read the matching file before spawning — Cursor does not auto-load them; the prompt must carry the agent's role and the user's request. Spawn syntax, foreground/background, resume: `.cursor/instructions/team-orchestrator-policy.md` → **Subagent IDs and resume** / **Task tool (Cursor)**. Workflow: `.cursor/instructions/team-orchestrator-policy.md`.

**Nested planning:** main session spawns `technical-architect` only. Architect nests `wiki-manager` (gather, **high complexity only**), `explore` (locate-only), and `investigator` — never spawn those from the main session during planning.

**Lite path:** low-complexity tasks go straight to `direct-executor` — no task folder, no architect, no briefer, no approval cycle. Optional `reviewer` when security-sensitive or user asks.

**Full pipeline (medium/high):** `technical-architect` → `briefer` → user approval → `implementer` → `reviewer` → `test-writer` → `documenter`. `compiler` and `finalizer` on user request only.

**Explain mode:** main session spawns `technical-architect` with `type: explain`; architect writes `answer.md`. EM reads and presents `answer.md` only — must not read `src/`, `wiki/`, or `plan.md`.

**Wiki refresh (batched):** EM spawns `wiki-manager` (update mode) on user request or before a release — not after every documenter cycle.

---

## 🟣 Technical Architect

**Implement mode** (medium/high complexity):

```typescript
Task({
  description: "Architecture plan: <task summary>",
  subagent_type: "technical-architect",
  prompt:
    "Task folder: docs/<short-task-description>/\nRequirement file: docs/<short-task-description>/requirement.md\ntype: implement\nComplexity: medium | high",
});
```

**Explain mode** (user Q&A — EM must not read source code):

```typescript
Task({
  description: "Explain: <question summary>",
  subagent_type: "technical-architect",
  prompt:
    "Task folder: docs/<short-task-description>/\nRequirement file: docs/<short-task-description>/requirement.md\ntype: explain\n\nWrite answer.md (not plan.md). Read memory/wiki directly; use explore or investigator for deep traces.",
});
```

Spawned by **main session** (Engineer Manager role). Researches internally (direct reads for medium/explain; nests `wiki-manager` + `investigator` for high). Writes `plan.md` (+ `test-plan.md`) or `answer.md`, and returns a **≤10-line summary** — EM reviews the summary, not the plan files.

---

## ⬜ Wiki Manager

**Gather mode** (nested — spawned by **technical-architect**, high complexity only; EM must not spawn):

```typescript
Task({
  description: "Wiki gather: <task summary>",
  subagent_type: "wiki-manager",
  prompt:
    "Task folder: docs/<short-task-description>/\nRequirement file: docs/<short-task-description>/requirement.md",
});
```

**Update mode** (spawned by **main session** — only on user request or before a release, never automatically per cycle):

```typescript
Task({
  description: "Wiki update: <task summary>",
  subagent_type: "wiki-manager",
  prompt:
    "Mode: update\nRecent changes: <latest docs/claude_history.md entries or summary>\nTask folder (optional): docs/<short-task-description>/",
});
```

Spawned by **technical-architect** (gather) or **main session** (update) via `Task`. Leaf subagent — no further `Task` spawns. Gather writes `wiki-brief.md`; update edits `wiki/` only.

---

## 🔵 Investigator (nested only — do not spawn from EM)

```typescript
Task({
  description: "Investigate: <topic>",
  subagent_type: "investigator",
  prompt:
    "Task folder: docs/<short-task-description>/\nWiki brief (if present): docs/<short-task-description>/wiki-brief.md\nQuestion files: docs/<short-task-description>/questions-<topic>.md",
});
```

Spawned by **technical-architect** only when complex gaps remain (not locate-only — architect uses `explore` or CodeGraph for that). Leaf subagent. Deep investigation — writes `answers-*.md`.

---

## 🟤 Briefer

Business mode (default):

```typescript
Task({
  description: "Brief: <task summary>",
  subagent_type: "briefer",
  prompt: "Task folder: docs/<short-task-description>/",
});
```

Technical mode (only when the user asks for a technical explanation — resume `briefer_id` if it exists, else spawn fresh with this prompt):

```typescript
Task({
  description: "Technical brief: <task summary>",
  subagent_type: "briefer",
  prompt: "Task folder: docs/<short-task-description>/\nmode: technical",
});
```

Run AFTER Technical Architect returns (`Status: ready` in summary). Briefer reads `requirement.md` and `plan.md`; EM does not. Writes `business-brief.md` — EM presents the brief and runs approval. Technical mode additionally writes `technical-brief.md` — not run unless requested.

---

## 🟢 Implementer

**Medium complexity (default — frontmatter `composer-2.5-fast`):**

```typescript
Task({
  description: "Implement: <task summary>",
  subagent_type: "implementer",
  prompt: "Task folder: docs/<short-task-description>/",
});
```

**High complexity only** — pass `model: "claude-4.6-sonnet-medium"`:

```typescript
Task({
  description: "Implement: <task summary>",
  subagent_type: "implementer",
  model: "claude-4.6-sonnet-medium",
  prompt: "Task folder: docs/<short-task-description>/",
});
```

Run AFTER user approves `business-brief.md`. Follows `plan.md` only (not `test-plan.md`). Before reporting: `npm run format:ci` → `npm run lint:fix:ci` (both must PASS).

---

## 🟡 Test Writer

```typescript
Task({
  description: "Tests: <task summary>",
  subagent_type: "test-writer",
  prompt: "Task folder: docs/<short-task-description>/",
});
```

Run AFTER Implementer and Reviewer (medium/high full pipeline). Before reporting: `npm run format:ci` → `npm run lint:fix:ci` → `npm run test:ci` (all must PASS). Reads `test-plan.md` for cases; `plan.md` file list only.

---

## 🔴 Compiler

```typescript
Task({
  description: "Compiler: lint, build, test",
  subagent_type: "compiler",
  prompt: "Run lint, build, type-check, and tests. Return the compiler report.",
});
```

Run only when explicitly requested by the user.

---

## 🟠 Reviewer

```typescript
Task({
  description: "Review: <task summary>",
  subagent_type: "reviewer",
  prompt: "Task folder: docs/<short-task-description>/",
});
```

Run AFTER Implementer completes (**medium/high** full pipeline; **lite path** only when security-sensitive or user asks). Compares diff against `plan.md`. When `test-plan.md` exists, verify tests cover its Cases to Cover.

---

## 🩵 Documenter

```typescript
Task({
  description: "Docs: update history and todo",
  subagent_type: "documenter",
  prompt: "Task folder: docs/<short-task-description>/",
});
```

Run after Reviewer approves (full pipeline only — skip on lite path unless user asks). Skip for investigation-only tasks. Does **not** trigger a wiki refresh — batched (see Wiki Manager update mode).

---

## ⬜ Finalizer

```typescript
Task({
  description: "Finalize: clean, stage, format, precommit, commit message",
  subagent_type: "finalizer",
  prompt:
    "Task folder (optional): docs/<short-task-description>/\nPaths to stage (optional): <paths or omit for session changes>\nUser notes: <optional>",
});
```

Run when the user wants commit prep or a commit message. Full pipeline: discover ephemeral paths → `clean-paths.mjs` → `git add` → `npm run format:ci` → re-stage → `npm run precommit:ci` → `npm run diff:ci` → commit message **only if precommit passes**.

**Cleanup only** (user just wants ephemeral docs deleted — "clean up docs", "run cleaner" — no staging/format/precommit/commit message):

```typescript
Task({
  description: "Finalize: cleanup ephemeral docs only",
  subagent_type: "finalizer",
  prompt:
    "Task folder: docs/<short-task-description>/\nmode: cleanup only\nUser notes: <optional>",
});
```

---

## 🟠 Release Manager

```typescript
Task({
  description: "Release: bump version and changelog",
  subagent_type: "release-manager",
  prompt: "<optional: user-provided changelog notes>",
});
```

Run only when the user explicitly requests a release. Good moment to also run wiki-manager (update mode) if wiki refreshes have been batched up.

---

## 🔷 Direct Executor

**Default for low-complexity tasks (lite path)**, and for any ad-hoc request where the user opts out of the full flow. Bypasses task folder, architect, briefer, and approval unless the user asks for those separately.

```typescript
Task({
  description: "Direct: <short summary>",
  subagent_type: "direct-executor",
  prompt:
    "USER REQUEST:\n<verbatim user request>\n\nCONSTRAINTS (if any):\n<optional scope limits from manager>",
});
```

Cursor provides built-in `subagent_type: "direct-executor"` — read `.cursor/agents/direct-executor.md` and embed role rules in the prompt if needed.

Spawn when: task is **low complexity**, user opts out of full flow for medium/high, or user says e.g. "direct-executor", "run this directly", "skip the flow", "/direct". Leaf agent — no further `Task` spawns.

Do **not** create `docs/<task>/requirement.md` for the lite path. If direct-executor reports scope exceeds low complexity, EM restarts via full pipeline.
