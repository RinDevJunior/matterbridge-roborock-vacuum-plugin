# Agent SDK Subagents Guidelines

## What Are Subagents

- Subagents are independent agents spawned by a parent agent to handle specific tasks
- Each subagent runs in its own session with fresh context
- Subagents inherit system prompt, CLAUDE.md, skills, and MCP servers from parent
- Only the subagent's final response returns to parent as a tool result

## Spawning Subagents

- Use the `Agent` tool to spawn a subagent with an AgentDefinition
- AgentDefinition includes: description, prompt, tools, skills, model, effort, permissionMode
- Subagents do NOT see parent's message history—only the task description
- Parent context grows by subagent summary, not full transcript

## Resuming Subagents

- Use `subagentId` to resume an existing subagent session
- Resumed subagents maintain their conversation history
- Useful for multi-turn interactions or continuing long-running tasks
- Pass `subagentId` in the Agent tool call to reconnect

## AgentDefinition Configuration

- `description`: When/why to use this subagent
- `prompt`: System prompt defining role and behavior
- `tools`: Array of allowed tool names (omit to inherit all)
- `disallowedTools`: Tools to block from subagent
- `model`: Model override for this subagent
- `skills`: Preload specific skills
- `memory`: Memory source ('user', 'project', or 'local')
- `mcpServers`: MCP servers available to subagent
- `maxTurns`: Maximum turns before stopping
- `background`: Run as non-blocking background task
- `effort`: Reasoning effort ('low', 'medium', 'high', 'xhigh', 'max')
- `permissionMode`: Permission mode for tool execution

## Nested Subagents

- Subagents can spawn their own subagents (up to 5 levels deep)
- Prevent nesting by omitting `Agent` from `tools` or adding to `disallowedTools`

## Best Practices

- Use subagents for isolated, well-defined subtasks
- Keep subagent prompts focused and specific
- Use `effort: "low"` for routine tasks to reduce token usage
- Resume subagents for multi-turn workflows
- Scope tools to minimum needed for each subagent
