# Cursor Status Line

A shared status line for the Cursor CLI that mirrors the Claude terminal style.

## Claude Code

For Claude, see [`.claude/statusline.md`](../.claude/statusline.md). It is enabled automatically via `.claude/settings.json` in this repo.

## Setup

Add the following to your `~/.cursor/cli-config.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "/absolute/path/to/repo/.cursor/statusline.sh",
    "padding": 2
  }
}
```

Replace `/absolute/path/to/repo` with your local clone path.

Make the script executable if needed:

```bash
chmod +x .cursor/statusline.sh
```

## What it shows

```
Sonnet 4.6 ~Medium | context:34% ███████░░░░░░░░░░░░░ | /path/to/project (dev)
```

- **Model name** — current model in cyan
- **Param summary** — effort/thinking level (color-coded)
- **Context bar** — 20-block bar, green < 70%, red ≥ 70%
- **Directory + branch** — current working directory and git branch
