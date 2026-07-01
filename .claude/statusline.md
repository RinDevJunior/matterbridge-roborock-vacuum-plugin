# Claude Code Status Line

Shared status line for this repo. Enabled automatically via `.claude/settings.json` when you open the project in Claude Code.

## Setup

No manual config needed for this repo — `statusLine` is already in `.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash .claude/statusline-command.sh"
  }
}
```

Make the script executable once after clone:

```bash
chmod +x .claude/statusline-command.sh
```

### Use globally (optional)

To use the same status line in other repos, add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash /absolute/path/to/repo/.claude/statusline-command.sh"
  }
}
```

Replace `/absolute/path/to/repo` with your local clone path.

## What it shows

```
Sonnet ~medium | context:34% ███████░░░░░░░░░░░░░ | 5h:12% █░░░░░░░░░░░░░░ reset: 3:45pm | 7d:45% ███████░░░░░░░░ reset: 29/06/2026 3:45pm | /path/to/project
```

- **Model name** — current model in cyan
- **Effort level** — `~low`, `~medium`, `~high` (color-coded)
- **Context bar** — 20-block bar, green < 70%, red ≥ 70%
- **5h / 7d bars** — rate-limit usage with reset times
- **Directory** — current working directory in magenta

## Cursor CLI

For Cursor, see [`.cursor/statusline.md`](../.cursor/statusline.md).
