# Agent Prompts

Use these prompt templates when the **main session (Engineer Manager)** spawns subagents via the **`Task`** tool in Cursor.

**Models:** Use the `model` slug on each template. Fast/leaf agents → `composer-2.5-fast`. Reasoning agents → `claude-4.6-sonnet-medium`. Match `.cursor/agents/<name>.md` frontmatter when in doubt.

**Usage limit:** If a spawn fails or is blocked because the preferred model hit a usage limit, **retry without `model`** (Cursor routes to **Auto**) or omit `model` on the next spawn. Do not upgrade to a heavier slug unless the user asks or the subagent reports it is blocked on reasoning.

System prompts live in `.cursor/agents/`. Read the matching file before spawning — Cursor does not auto-load them; the prompt must carry the agent's role and the user's request. Spawn syntax, foreground/background, resume: `.cursor/instructions/subagent-guidelines-cursor.md`. Workflow: `.cursor/CURSOR.md`.

**Nested planning:** main session spawns `technical-architect` only. Architect nests `wiki-manager` and `investigator` — never spawn those from the main session.

**Explain mode:** main session spawns `technical-architect` with `type: explain`; architect writes `answer.md`. EM must not read `src/` or `wiki/`.

**Direct execution:** spawn `direct-executor` only when the user explicitly asks to skip the full flow (ad-hoc / custom task). No task folder, no architect, no briefer, no approval cycle.

---

## 🟣 Technical Architect

**Implement mode** (default):

```typescript
Task({
  description: "Architecture plan: <task summary>",
  subagent_type: "technical-architect",
  model: "claude-4.6-sonnet-medium",
  prompt:
    "Task folder: docs/<short-task-description>/\nRequirement file: docs/<short-task-description>/requirement.md\ntype: implement\nComplexity: low | medium | high",
});
```

**Explain mode** (user Q&A — EM must not read source code):

```typescript
Task({
  description: "Explain: <question summary>",
  subagent_type: "technical-architect",
  model: "claude-4.6-sonnet-medium",
  prompt:
    "Task folder: docs/<short-task-description>/\nRequirement file: docs/<short-task-description>/requirement.md\ntype: explain\n\nWrite answer.md (not plan.md). Spawn wiki-manager for curated knowledge; read src/ directly as needed; spawn investigator for deep traces.",
});
```

Spawned by **main session** (Engineer Manager role). **Must** nest `wiki-manager` first when useful, then `investigator` if needed. Write `plan.md` + `test-plan.md` when test-writer applies (implement) or `answer.md` (explain).

---

## ⬜ Wiki Manager (nested only — do not spawn from EM)

**Gather mode** (technical-architect):

```typescript
Task({
  description: "Wiki gather: <task summary>",
  subagent_type: "wiki-manager",
  model: "composer-2.5-fast",
  prompt:
    "Task folder: docs/<short-task-description>/\nRequirement file: docs/<short-task-description>/requirement.md",
});
```

**Update mode** (documenter):

```typescript
Task({
  description: "Wiki update: <task summary>",
  subagent_type: "wiki-manager",
  model: "claude-4.6-sonnet-medium",
  prompt:
    "Mode: update\nTask folder: docs/<short-task-description>/\nHistory entry: <paste the claude_history.md entry you just wrote>\nBusiness brief: docs/<short-task-description>/business-brief.md",
});
```

Spawned by **technical-architect** (gather) or **documenter** (update) via `Task`. Leaf subagent — no further `Task` spawns. Gather writes `wiki-brief.md`; update edits `wiki/` only.

---

## 🔵 Investigator (nested only — do not spawn from EM)

```typescript
Task({
  description: "Investigate: <topic>",
  subagent_type: "investigator",
  model: "claude-4.6-sonnet-medium",
  prompt:
    "Task folder: docs/<short-task-description>/\nWiki brief: docs/<short-task-description>/wiki-brief.md\nQuestion files: docs/<short-task-description>/questions-<topic>.md",
});
```

Spawned by **technical-architect** only via `Task` when complex gaps remain. Leaf subagent — no further `Task` spawns. Deep investigation — not trivial lookups.

---

## 🟤 Briefer

Business mode (default):

```typescript
Task({
  description: "Brief: <task summary>",
  subagent_type: "briefer",
  model: "composer-2.5-fast",
  prompt: "Task folder: docs/<short-task-description>/",
});
```

Technical mode (only when the user asks for a technical explanation — resume `briefer_id` if it exists, else spawn fresh with this prompt):

```typescript
Task({
  description: "Technical brief: <task summary>",
  subagent_type: "briefer",
  model: "composer-2.5-fast",
  prompt: "Task folder: docs/<short-task-description>/\nmode: technical",
});
```

Run AFTER Technical Architect returns `plan.md` (Status: ready). Reads `requirement.md` and `plan.md`, writes `business-brief.md`, then **`AskQuestion`** for Approve / Request Changes before reporting. Technical mode additionally writes `technical-brief.md` — plain-language, framed around files/services and system impact, not run unless requested.

---

## 🟢 Implementer

```typescript
Task({
  description: "Implement: <task summary>",
  subagent_type: "implementer",
  model: "claude-4.6-sonnet-medium",
  prompt: "Task folder: docs/<short-task-description>/",
});
```

Run AFTER user approves `business-brief.md`. Follow `plan.md` only (not `test-plan.md`).

---

## 🟡 Test Writer

```typescript
Task({
  description: "Tests: <task summary>",
  subagent_type: "test-writer",
  model: "claude-4.6-sonnet-medium",
  prompt: "Task folder: docs/<short-task-description>/",
});
```

Run AFTER Implementer and Reviewer, or after Compiler when explicitly requested. Follow `test-plan.md` for cases; use `plan.md` for file list only.

---

## 🔴 Compiler

```typescript
Task({
  description: "Compiler: lint, build, test",
  subagent_type: "compiler",
  model: "composer-2.5-fast",
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
  model: "claude-4.6-sonnet-medium",
  prompt: "Task folder: docs/<short-task-description>/",
});
```

Run AFTER Implementer completes. Compare diff against `plan.md`.

---

## 🩵 Documenter

```typescript
Task({
  description: "Docs: update history and todo",
  subagent_type: "documenter",
  model: "composer-2.5-fast",
  prompt: "Task folder: docs/<short-task-description>/",
});
```

Run after Reviewer approves. Nests **wiki-manager** (update mode) via `Task`. Skip for investigation-only tasks.

---

## ⬜ Finalizer

```typescript
Task({
  description: "Finalize: clean, stage, format, precommit, commit message",
  subagent_type: "finalizer",
  model: "composer-2.5-fast",
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
  model: "composer-2.5-fast",
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
  model: "claude-4.6-sonnet-medium",
  prompt: "<optional: user-provided changelog notes>",
});
```

Run only when the user explicitly requests a release.

---

## 🔷 Direct Executor

**User request only.** Bypasses task folder, architect, briefer, approval, reviewer, and documenter unless the user asks for those separately.

```typescript
Task({
  description: "Direct: <short summary>",
  subagent_type: "direct-executor",
  model: "claude-4.6-sonnet-medium",
  prompt:
    "USER REQUEST:\n<verbatim user request>\n\nCONSTRAINTS (if any):\n<optional scope limits from manager>",
});
```

Spawn when the user says e.g. "direct-executor", "run this directly", "skip the flow", or "/direct". Leaf agent — no further `Task` spawns.

Do **not** create `docs/<task>/requirement.md` for this path.
