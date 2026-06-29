# Agent Prompts

Use these prompt templates when the **main session (Engineer Manager)** spawns subagents via the `Agent` tool.

System prompts live in `.claude/agents/`. Read the matching file before spawning — Cursor does not auto-load them; the prompt must carry the agent's role and the user's request.

**Nested planning:** main session spawns `technical-architect` only. Architect nests `wiki-manager` and `investigator` — never spawn those from the main session.

**Direct execution:** spawn `direct-executor` only when the user explicitly asks to skip the full flow (ad-hoc / custom task). No task folder, no architect, no briefer, no approval cycle.

---

## 🟣 Technical Architect

```
Agent({
  description: "Architecture plan: <task summary>",
  subagent_type: "technical-architect",
  model: "sonnet",
  prompt: "Task folder: docs/<short-task-description>/\nRequirement file: docs/<short-task-description>/requirement.md\nComplexity: low | medium | high"
})
```

Spawned by **main session** (Engineer Manager role). **Must** nest `wiki-manager` first, then `investigator` if needed, then write `plan.md`.

---

## ⬜ Wiki Manager (nested only — do not spawn from EM)

```
Agent({
  description: "Wiki: <task summary>",
  subagent_type: "wiki-manager",
  model: "haiku",
  prompt: "Task folder: docs/<short-task-description>/\nRequirement file: docs/<short-task-description>/requirement.md"
})
```

Spawned by **technical-architect** only. Leaf subagent (no `Agent` tool). Writes `wiki-brief.md`.

---

## 🔵 Investigator (nested only — do not spawn from EM)

```
Agent({
  description: "Investigate: <task summary>",
  subagent_type: "investigator",
  model: "sonnet",
  prompt: "Task folder: docs/<short-task-description>/\nWiki brief: docs/<short-task-description>/wiki-brief.md\nQuestion files: docs/<short-task-description>/questions-<topic>.md"
})
```

Spawned by **technical-architect** only when complex gaps remain. Leaf subagent. Deep investigation — not trivial lookups.

---

## 🟤 Briefer

```
Agent({
  description: "Brief: <task summary>",
  subagent_type: "briefer",
  model: "haiku",
  prompt: "Task folder: docs/<short-task-description>/"
})
```

Run AFTER Technical Architect returns `plan.md` (Status: ready). Reads `requirement.md` and `plan.md`, writes `business-brief.md`.

---

## 🟢 Implementer

```
Agent({
  description: "Implement: <task summary>",
  subagent_type: "implementer",
  model: "haiku" | "sonnet",
  prompt: "Task folder: docs/<short-task-description>/"
})
```

Run AFTER user approves `business-brief.md`. Follow `plan.md`.

---

## 🟡 Test Writer

```
Agent({
  description: "Tests: <task summary>",
  subagent_type: "test-writer",
  model: "haiku",
  prompt: "Task folder: docs/<short-task-description>/"
})
```

Run AFTER Implementer and Reviewer, or after Compiler when explicitly requested.

---

## 🔴 Compiler

```
Agent({
  description: "Compiler: lint, build, test",
  subagent_type: "compiler",
  model: "haiku",
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
  model: "sonnet",
  prompt: "Task folder: docs/<short-task-description>/"
})
```

Run AFTER Implementer completes. Compare diff against `plan.md`.

---

## 🩵 Documenter

```
Agent({
  description: "Docs: update history and todo",
  subagent_type: "documenter",
  model: "haiku",
  prompt: "Task folder: docs/<short-task-description>/"
})
```

Run after Reviewer approves. Skip for investigation-only tasks.

---

## ⬜ Cleaner

```
Agent({
  description: "Clean: remove ephemeral agent files",
  subagent_type: "cleaner",
  model: "haiku",
  prompt: ""
})
```

Run only when explicitly requested.

---

## 🟠 Release Manager

```
Agent({
  description: "Release: bump version and changelog",
  subagent_type: "release-manager",
  model: "sonnet",
  prompt: "<optional: user-provided changelog notes>"
})
```

Run only when the user explicitly requests a release.

---

## ⬜ Commit Message Writer

```
Agent({
  description: "Commit message: draft from changes",
  subagent_type: "commit-message-writer",
  model: "haiku",
  prompt: "Scope (default: staged): staged | unstaged | all | branch\nBase branch (if branch scope): main | dev\nUser notes: <optional>"
})
```

Run when the user asks for a commit message suggestion. Never commits, stages, or pushes.

In **Cursor**, use `subagent_type: "generalPurpose"` and embed the Commit Message Writer rules from `.claude/agents/commit-message-writer.md` in the prompt.

---

## 🔷 Direct Executor

**User request only.** Bypasses task folder, architect, briefer, approval, reviewer, and documenter unless the user asks for those separately.

```
Task({
  description: "Direct: <short summary>",
  subagent_type: "generalPurpose",
  prompt: "<read .claude/agents/direct-executor.md role + rules>\n\nUSER REQUEST:\n<verbatim user request>\n\nCONSTRAINTS (if any):\n<optional scope limits from manager>"
})
```

In **Cursor**, use `subagent_type: "generalPurpose"` and embed the Direct Executor rules from `.claude/agents/direct-executor.md` in the prompt (there is no built-in `direct-executor` Task type).

In **Claude Code**, use `Agent({ subagent_type: "direct-executor", ... })` when the CLI exposes that agent from `.claude/agents/`.

Spawn when the user says e.g. "direct-executor", "run this directly", "skip the flow", or "/direct".

Do **not** create `docs/<task>/requirement.md` for this path.
