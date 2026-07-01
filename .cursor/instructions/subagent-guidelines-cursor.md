# Cursor Subagent Guidelines

Cursor-specific subagent patterns for this repository.

**Official reference:** [Cursor Subagents docs](https://cursor.com/docs/subagents)

**Agent SDK equivalent:** `.claude/instructions/subagent-guidelines.md` (`Agent` tool, `AgentDefinition`, `subagentId`).

---

## What Are Subagents

- Subagents are specialized assistants that the parent agent delegates to via the **`Task`** tool
- Each subagent runs in its **own context window** with a clean slate — it does not see the parent's message history
- The parent includes necessary context in the spawn prompt; only the subagent's **final summary** returns to the parent
- Subagents inherit workspace rules (`CLAUDE.md`, `.cursor/rules/`), skills, and MCP tools from the parent session
- Use subagents to isolate long research, run work in parallel, and preserve main-session context

### Foreground vs background

| Mode       | Task parameter                       | Behavior                                          | Best for                                       |
| ---------- | ------------------------------------ | ------------------------------------------------- | ---------------------------------------------- |
| Foreground | `run_in_background: false` (default) | Blocks until complete; result returns immediately | Sequential gates (plan review, implementation) |
| Background | `run_in_background: true`            | Returns immediately; subagent works independently | Long investigations, parallel workstreams      |

Background subagents write progress to `~/.cursor/subagents/`; the parent can read those files to check status.

---

## Spawning Subagents

- Use the **`Task`** tool to spawn a subagent
- Pass a focused **`prompt`** with all context the subagent needs (task folder paths, mode, constraints)
- Subagents do **not** see parent message history — only the task description you pass
- Parent context grows by subagent summary, not full transcript
- Launch **multiple `Task` calls in one message** to run subagents in parallel

### Automatic delegation

Cursor Agent may delegate proactively based on task complexity, custom subagent `description` fields, and available tools. Use phrases like "use proactively" or "always use for" in frontmatter descriptions to encourage automatic delegation.

### Explicit invocation

Request a custom subagent by name:

```text
/verifier confirm the auth flow is complete
/technical-architect plan the subagent config upgrade
```

Or mention naturally: "Use the briefer subagent to summarize the plan."

### Task tool parameters

```typescript
Task({
  description: "Brief: subagent config upgrade",  // short UI title
  subagent_type: "briefer",                       // built-in type or custom agent name
  model: "claude-4.6-sonnet-medium",              // optional override
  prompt: "Task folder: docs/subagent-config-upgrade/\n...",
  readonly: false,                                // true = no file edits or state-changing shell
  run_in_background: false,                        // true = background mode
})
```

### Built-in subagents (Cursor-provided)

Cursor includes three built-in subagents for context-heavy operations — Agent uses them automatically when appropriate:

| Subagent  | Purpose                                                                        |
| --------- | ------------------------------------------------------------------------------ |
| `explore` | Codebase search and analysis (uses a faster model; supports parallel searches) |
| `bash`    | Series of shell commands (isolates verbose command output)                     |
| `browser` | Browser automation via MCP (filters noisy DOM/screenshot output)               |

You do not configure these. Agent delegates to them when the task fits.

### Custom subagent file locations

| Type             | Location            | Scope                                       |
| ---------------- | ------------------- | ------------------------------------------- |
| Project          | `.cursor/agents/`   | Current project (preferred)                 |
| Project (compat) | `.claude/agents/`   | Current project — Claude Code compatibility |
| User             | `~/.cursor/agents/` | All projects for current user               |

When names conflict, `.cursor/` takes precedence over `.claude/` or `.codex/`. This repo maintains both trees; edit `.claude/agents/` then re-mirror to `.cursor/agents/` when agent roles change.

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
  prompt: "User follow-up: why did you choose approach A over B?"
})
```

Or in chat: `Resume agent abc123 and analyze the remaining test failures`.

**This project:** Engineer Manager saves agent IDs per task cycle (`ta_id`, `briefer_id`, etc.). See `CLAUDE.md` → **Subagent ID Tracking** for resume-vs-fresh-spawn rules. Clear all IDs when starting a new task cycle.

---

## Subagent Configuration

Custom subagents are markdown files with YAML frontmatter followed by the role prompt.

### Frontmatter fields (Cursor)

| Field           | Required | Default               | Description                                              |
| --------------- | -------- | --------------------- | -------------------------------------------------------- |
| `name`          | No       | Derived from filename | Display name and identifier (lowercase, hyphens)         |
| `description`   | No       | —                     | When Agent should delegate; shown in Task tool hints     |
| `model`         | No       | `inherit`             | `inherit` (parent model) or a specific model ID          |
| `readonly`      | No       | `false`               | Restrict writes — no file edits, no state-changing shell |
| `is_background` | No       | `false`               | Run in background without blocking parent                |

Example:

```markdown
---
name: code-reviewer
description: Reviews code for correctness and style. Use after implementation.
model: inherit
readonly: true
---

Review the code changes for bugs, style issues, and edge cases.
```

### Task tool parameters (runtime overrides)

| Parameter           | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| `description`       | Short title shown in the UI                                    |
| `subagent_type`     | Built-in type, custom agent name, or `generalPurpose` fallback |
| `prompt`            | Task-specific context and instructions                         |
| `model`             | Model override for this invocation                             |
| `readonly`          | Restrict to read-only operations                               |
| `run_in_background` | Non-blocking background execution                              |
| `resume`            | Agent ID to continue a prior session                           |

### Model configuration

| Value             | Behavior                                                                   |
| ----------------- | -------------------------------------------------------------------------- |
| `inherit`         | Same model as parent (default)                                             |
| Specific model ID | Exact model for this subagent (e.g. `composer-2.5-fast`, `gpt-5.5-medium`) |

Cursor may fall back if the model is blocked by team admin, requires Max Mode, or is unavailable on your plan.

**This project:** EM (main session) uses **Auto**. Subagent models follow `.claude/instructions/agent-prompts.md`. Do not upgrade unless the user asks or a subagent reports it is blocked.

### Agent SDK frontmatter (this repo)

Our `.claude/agents/*.md` files include Agent SDK metadata (`effort`, `maxTurns`, `tools`) for Claude Code. Cursor reads `.cursor/agents/*.md` with `name`, `description`, `model`, and optional `readonly`.

---

## Nested Subagents

- Subagents can spawn their own subagents (Cursor 2.5+), forming a tree of coordinated work
- A subagent launched by another subagent **cannot** launch further subagents (one level of nesting from children)
- Nested launches require Task tool access in the current mode; hooks or tool policies can block spawning
- Prevent nesting in a custom agent by constraining its prompt (no delegation instructions) or using `readonly: true`

**This project orchestration tree:**

```
Engineer Manager (main session)
  └── technical-architect
        ├── wiki-manager   (leaf — never spawn from EM)
        └── investigator   (leaf — only if gaps remain)
```

EM **must not** spawn `wiki-manager` or `investigator` directly — technical-architect nests them during planning.

---

## Best Practices

- Use subagents for **isolated, well-defined subtasks** — not simple one-shot actions (use skills instead)
- Keep subagent **prompts focused and specific**; long prompts dilute focus
- **Invest in `description`** — it determines when Agent delegates automatically
- Use **`readonly: true`** for review, audit, and verification agents
- Use **background mode** for long-running or parallel work; use **foreground** for sequential gates
- **Resume** subagents for multi-turn follow-ups within the same task cycle
- Add `.cursor/agents/` (or `.claude/agents/`) to version control so the team shares definitions
- Prefer the **minimum** subagents required; parallel subagents multiply token usage

### This project (Engineer Manager)

- Spawn templates: `.claude/instructions/agent-prompts.md`
- User input from subagents: `.cursor/instructions/user-input-guidelines-cursor.md` (`AskQuestion`)
- EM workflow: `CLAUDE.md`, `.cursor/rules/engineer-manager.mdc`
- **Compiler:** use `npm run test:ci` — never paste full test output into the main session
- One **technical-architect** spawn per planning cycle unless the user rejects the brief
- Use `/name` or `subagent_type: "<name>"` — custom agents load from `.cursor/agents/` automatically
- Use `generalPurpose` + embed rules only when a built-in type is unavailable in your Cursor version

### Anti-patterns

- Vague descriptions ("helps with coding") — Agent won't know when to delegate
- Spawning dozens of generic subagents — start with 2–3 focused roles
- Duplicating skills as subagents — single-purpose tasks don't need a separate context window
- Pasting full subagent transcripts into the main session — summaries only
