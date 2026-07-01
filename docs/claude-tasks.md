# Todo Lists (Task Tools)

As of **TypeScript Agent SDK 0.3.142** and **Claude Code v2.1.142**, sessions use the structured Task tools — `TaskCreate`, `TaskUpdate`, `TaskGet`, and `TaskList` — instead of `TodoWrite`. These are the default, so no `options.env` change is needed.

## How the Task tools work

- `TaskCreate` — adds one task item.
- `TaskUpdate` — patches one item by `taskId`.
- `TaskList` / `TaskGet` — read back the current list.

Your monitoring code inspects `tool_use` blocks in the assistant stream, maintaining a **map keyed by task ID** instead of replacing the whole list on every call.

## TodoWrite → Task tools mapping

| With `TodoWrite`                              | With Task tools                                                                                                                                                                                                                                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One call rewrites the full `todos` array      | `TaskCreate` adds one item; `TaskUpdate` patches one item by `taskId`                                                                                                                                                                                                               |
| Match `block.name === "TodoWrite"`            | Match `block.name === "TaskCreate"` or `"TaskUpdate"`                                                                                                                                                                                                                               |
| Item shape: `{ content, status, activeForm }` | `TaskCreate`: `{ subject, description, activeForm?, metadata? }`<br>`TaskUpdate`: `{ taskId, status?, subject?, description?, activeForm?, addBlocks?, addBlockedBy?, owner?, metadata? }`<br>`status` ∈ `"pending"` \| `"in_progress"` \| `"completed"`; use `"deleted"` to delete |
| Render `block.input.todos` directly           | Accumulate items across calls, or read a snapshot from a `TaskList` result                                                                                                                                                                                                          |

## Key gotchas

- **Task ID is not in the `TaskCreate` input.** It comes back in the matching `tool_result` as `{ task: { id, subject } }` — capture it there to key your map.
- **Read input fields defensively.** The streamed `tool_use` input is the raw shape the model emitted. Claude Code repairs close-but-incorrect keys before execution (`id`/`task_id` → `taskId`, `active_form` → `activeForm`), but the repair is **not** reflected in the stream.

## Example: monitoring Task changes

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({ prompt: "Optimize my React app performance" })) {
  if (message.type !== "assistant") continue;
  for (const block of message.message.content) {
    if (block.type !== "tool_use") continue;
    if (block.name === "TaskCreate") {
      const input = block.input as { subject: string };
      console.log(`+ ${input.subject}`);
    } else if (block.name === "TaskUpdate") {
      const input = block.input as { taskId?: string; id?: string; task_id?: string; status?: string };
      const taskId = input.taskId ?? input.id ?? input.task_id;
      if (taskId && input.status) console.log(`  ${taskId} -> ${input.status}`);
    }
  }
}
```

```python
from claude_agent_sdk import query, AssistantMessage, ToolUseBlock

async for message in query(prompt="Optimize my React app performance"):
    if not isinstance(message, AssistantMessage):
        continue
    for block in message.content:
        if not isinstance(block, ToolUseBlock):
            continue
        if block.name == "TaskCreate":
            print(f"+ {block.input['subject']}")
        elif block.name == "TaskUpdate" and block.input.get("status"):
            task_id = block.input.get("taskId") or block.input.get("id") or block.input.get("task_id")
            if task_id:
                print(f"  {task_id} -> {block.input['status']}")
```
