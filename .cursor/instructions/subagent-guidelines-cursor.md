# Cursor Subagent Guidelines

Cursor-specific subagent patterns for this repository.

**Official reference:** [Cursor Subagents docs](https://cursor.com/docs/subagents)

**Claude Code equivalent:** `.claude/agents/` + `.claude/instructions/agent-prompts.md` (`Agent` tool). Do not mix paths when editing policy.

---

## What Are Subagents

- Subagents are specialized assistants that the parent agent delegates to via the **`Task`** tool
- Each subagent runs in its **own context window** with a clean slate — it does not see the parent's message history
- The parent includes necessary context in the spawn prompt; only the subagent's **final summary** returns to the parent
- Subagents inherit workspace rules (`AGENTS.md` → `.cursor/CURSOR.md`), `.cursor/agents/`, skills, and MCP tools from the parent session — **not** `.claude/CLAUDE.md` or `.claude/` (disable third-party imports in Cursor settings)
- Use subagents to isolate long research, run work in parallel, and preserve main-session context

### Foreground vs background

| Mode       | Task parameter                       | Behavior                                          | Best for                                       |
| ---------- | ------------------------------------ | ------------------------------------------------- | ---------------------------------------------- |
| Foreground | `run_in_background: false` (default) | Blocks until complete; result returns immediately | Sequential gates (plan review, implementation) |
| Background | `run_in_background: true`            | Returns immediately; subagent works independently | Long investigations, parallel workstreams      |

Background subagents write progress to `~/.cursor/subagents/`; the parent can read those files to check status.

**This project:** Default to **foreground** for the EM pipeline (architect → briefer → approval → implementer → …). Use background only when the user asks or work is independent (e.g. parallel investigations).

---

## Spawning Subagents

- Use the **`Task`** tool to spawn a subagent
- Pass a focused **`prompt`** with all context the subagent needs (task folder paths, mode, constraints)
- Subagents do **not** see parent message history — only the task description you pass
- Parent context grows by subagent summary, not full transcript
- Launch **multiple `Task` calls in one message** to run subagents in parallel when they do not depend on each other

### Automatic delegation

Cursor Agent may delegate proactively based on task complexity, custom subagent `description` fields, and available tools. Use phrases like "use proactively" or "always use for" in frontmatter descriptions to encourage automatic delegation.

### Explicit invocation

Request a custom subagent by name:

```text
/technical-architect plan the room-detection change
/briefer summarize the approved plan
```

Or mention naturally: "Use the briefer subagent to summarize the plan."

### Task tool parameters

```typescript
Task({
  description: "Brief: room detection", // short UI title
  subagent_type: "briefer", // built-in type or `.cursor/agents/` name
  model: "composer-2.5-fast", // optional — see Model configuration below
  prompt: "Task folder: docs/room-detection/\n...",
  readonly: false, // true = no file edits or state-changing shell
  run_in_background: false, // true = background mode
});
```

Spawn templates for this repo: `.cursor/instructions/agent-prompts.md`. Role prompts: `.cursor/agents/<name>.md` (Cursor does not auto-load them — the spawn `prompt` must carry task context).

### Built-in subagents (Cursor-provided)

Cursor includes built-in subagents for context-heavy operations — Agent may use them automatically when appropriate:

| Subagent  | Purpose                                                                 |
| --------- | ----------------------------------------------------------------------- |
| `explore` | Codebase search and analysis (faster model; supports parallel searches) |
| `bash`    | Series of shell commands (isolates verbose command output)              |
| `browser` | Browser automation via MCP (filters noisy DOM/screenshot output)        |

You do not configure these. Prefer **project custom agents** in `.cursor/agents/` for the EM workflow.

### Custom subagent file locations

| Type    | Location            | Scope                     |
| ------- | ------------------- | ------------------------- |
| Project | `.cursor/agents/`   | This repo (canonical)     |
| User    | `~/.cursor/agents/` | All projects for the user |

**Do not** edit `.claude/agents/` when working in Cursor — maintain `.cursor/agents/` for Cursor-specific syntax (`Task`, `TodoWrite`, Serena). Mirror to `.claude/` only when a change applies to both tools.

---

## Resuming Subagents

- Each subagent execution returns an **agent ID**
- Pass `resume: "<agent-id>"` in the `Task` tool call to continue the same session
- Resumed subagents maintain their conversation history
- Useful for multi-turn follow-ups within the same task cycle
- Background subagents can be resumed after completion to continue with preserved context

```typescript
Task({
  description: "TA follow-up: plan question",
  subagent_type: "technical-architect",
  resume: "<agent-id-from-prior-spawn>",
  prompt: "User follow-up: why did you choose approach A over B?",
});
```

**This project:** Engineer Manager saves agent IDs per task cycle (`ta_id`, `briefer_id`, etc.). See `.cursor/CURSOR.md` → **Subagent ID Tracking** for resume-vs-fresh-spawn rules. Clear all IDs when starting a new task cycle.

---

## Subagent Configuration

Custom subagents are markdown files with YAML frontmatter followed by the role prompt.

### Frontmatter fields (Cursor)

| Field           | Required | Default               | Description                                              |
| --------------- | -------- | --------------------- | -------------------------------------------------------- |
| `name`          | No       | Derived from filename | Display name and identifier (lowercase, hyphens)         |
| `description`   | No       | —                     | When Agent should delegate; shown in Task tool hints     |
| `model`         | No       | `inherit`             | `inherit` (parent model) or a specific model slug        |
| `readonly`      | No       | `false`               | Restrict writes — no file edits, no state-changing shell |
| `is_background` | No       | `false`               | Run in background without blocking parent                |

Example:

```markdown
---
name: reviewer
description: Reviews code against plan.md. Use after implementation.
model: claude-4.6-sonnet-medium
readonly: true
---

Review the code changes for bugs, style issues, and plan conformance.
```

### Task tool parameters (runtime overrides)

| Parameter           | Description                             |
| ------------------- | --------------------------------------- |
| `description`       | Short title shown in the UI             |
| `subagent_type`     | Built-in type or `.cursor/agents/` name |
| `prompt`            | Task-specific context and instructions  |
| `model`             | Model override for this invocation      |
| `readonly`          | Restrict to read-only operations        |
| `run_in_background` | Non-blocking background execution       |
| `resume`            | Agent ID to continue a prior session    |

### Model configuration

| Slug / value               | This project — when to use                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(omit `model`)_           | **Auto** — use when preferred slug hits a **usage limit** (retry spawn without `model`)                                                                   |
| `composer-2.5-fast`        | Fast / leaf: `compiler`, `briefer`, `wiki-manager` (gather), `documenter`, `finalizer`                                                                    |
| `claude-4.6-sonnet-medium` | Reasoning: `technical-architect`, `implementer`, `reviewer`, `test-writer`, `investigator`, `direct-executor`, `release-manager`; `wiki-manager` (update) |

**Main session (EM):** always **Auto**. Do not upgrade subagent models unless the user asks or a subagent reports it is blocked on reasoning.

Details: `.cursor/CURSOR.md` → **Model policy** and `.cursor/instructions/agent-prompts.md`.

---

## Nested Subagents

- Subagents spawned by **technical-architect** or **documenter** are **leaf** nodes in this repo — they do not spawn further subagents
- TA nests `wiki-manager` (gather) and optionally `investigator`; documenter nests `wiki-manager` (update) only
- EM **must not** spawn `wiki-manager` or `investigator` directly

**This project orchestration tree:**

```text
Engineer Manager (main session — Auto)
  ├── technical-architect
  │     ├── wiki-manager   (gather — leaf)
  │     └── investigator   (leaf — only if gaps remain)
  ├── briefer → AskQuestion approval → implementer → reviewer → test-writer → documenter
  │     └── wiki-manager   (update — nested by documenter only)
  ├── compiler / finalizer / release-manager / direct-executor (leaf)
  └── …
```

---

## Best Practices

- Use subagents for **isolated, well-defined subtasks** — not simple one-shot actions
- Keep subagent **prompts focused and specific**; long prompts dilute focus
- **Invest in `description`** — it determines when Agent delegates automatically
- Use **`readonly: true`** for review and audit agents (`reviewer`)
- Use **background mode** for long-running or parallel work; use **foreground** for sequential gates
- **Resume** subagents for multi-turn follow-ups within the same task cycle
- Commit `.cursor/agents/` so the team shares definitions
- Prefer the **minimum** subagents required; parallel subagents multiply token usage

### This project (Engineer Manager)

- Spawn templates: `.cursor/instructions/agent-prompts.md`
- EM workflow & user input: `.cursor/CURSOR.md` (`AskQuestion` for EM; briefer runs approval gate — see `.cursor/agents/briefer.md`)
- **Compiler:** `npm run test:ci` — never paste full test output into the main session
- One **technical-architect** spawn per planning cycle unless the user rejects the brief
- Use `subagent_type: "<name>"` — custom agents load from `.cursor/agents/` automatically

### Anti-patterns

- Vague descriptions ("helps with coding") — Agent won't know when to delegate
- Spawning dozens of generic subagents — start with 2–3 focused roles
- Loading `.claude/` policy in Cursor — disable third-party imports; use `AGENTS.md` + `.cursor/CURSOR.md`
- Pasting full subagent transcripts into the main session — summaries only
