# Claude Code ↔ Cursor Tool Parity

When porting agent logic from `.claude/agents/` to `.cursor/agents/`, map tools as below. **Do not** copy Claude `tools:` frontmatter into Cursor agent files — Cursor resolves tools from the host environment.

## Progress tracking

| Claude Code                                          | Cursor      | Notes                                                                                     |
| ---------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| `TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList` | `TodoWrite` | `TaskCreate` is **not enabled in Claude subagents** either — skip silently if unavailable |
| —                                                    | `TodoWrite` | May be unavailable in some Cursor subagent contexts — skip silently                       |

## Subagent spawning

| Claude Code                     | Cursor                                                   |
| ------------------------------- | -------------------------------------------------------- |
| `Agent` (spawn nested subagent) | `Task` (`subagent_type`, `prompt`)                       |
| `Explore` (built-in)            | `Task` with `subagent_type: explore` or `generalPurpose` |

## Code navigation

| Claude Code                                   | Cursor                                 | Fallback                                                      |
| --------------------------------------------- | -------------------------------------- | ------------------------------------------------------------- |
| `LSP` (`findReferences`, `goToDefinition`, …) | **Not available**                      | Serena MCP → `codegraph explore` / `codegraph_explore` → Grep |
| `mcp__serena__*`                              | Serena MCP (`mcp_serena_*`)            | Same names, different prefix                                  |
| `codegraph explore` (CLI)                     | `codegraph_explore` (MCP) or shell CLI | Subagents without MCP: shell only                             |

## Search / logs / CLI

| Claude Code                     | Cursor                   | Fallback                                                                                  |
| ------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `mcp__glob-grep__Glob` / `Grep` | Built-in `Glob` / `Grep` | —                                                                                         |
| `mcp__read-log__ReadLog`        | **Not configured**       | `Read` with `limit` + `offset`, or `Grep` on log path (avoid full-file read on huge logs) |
| `mcp__cli-runner__RunCli`       | **Not configured**       | `Shell`                                                                                   |
| `Bash`                          | `Shell`                  | Same role                                                                                 |

## User prompts

| Claude Code       | Cursor        |
| ----------------- | ------------- |
| `AskUserQuestion` | `AskQuestion` |

## Release / notifications

| Claude Code                          | Cursor                                                          |
| ------------------------------------ | --------------------------------------------------------------- |
| `mcp__github-release__GitHubRelease` | `mcp_plugin-github-github_*` or `gh release create` via `Shell` |
| `mcp__discord-send__DiscordSend`     | **Not configured** — skip Discord step; note in report          |

## Runtime monitoring

| Claude Code                         | Cursor                                                        |
| ----------------------------------- | ------------------------------------------------------------- |
| `Monitor` (tail background process) | `Shell` with `block_until_ms: 0` + `Await` on terminal output |

## Shared rules path

Both hosts read **`.claude/instructions/shared-rules.md`** (canonical). There is no separate `.cursor/instructions/shared-rules.md`.
