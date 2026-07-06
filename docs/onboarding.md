# Onboarding — Working On This Project With AI Support

For a new supporter/co-worker joining this project and using Claude Code (or Cursor) day-to-day. This is the "start here" doc — it links out to the detailed references rather than repeating them.

---

## 1. Setup

### 1.1 Clone the main repo and the wiki sub-repo

```sh
git clone https://github.com/RinDevJunior/matterbridge-roborock-vacuum-plugin.git
cd matterbridge-roborock-vacuum-plugin
git submodule update --init --recursive   # pulls wiki/ (separate git repo, curated architecture docs)
```

`wiki/` is a submodule (`.gitmodules`) — if you skip this step it stays empty and `wiki-manager`/`ref-idea` lose their knowledge source.

### 1.2 Install and build

```sh
npm install
sudo npm run precondition      # installs matterbridge@3.9.0 globally (required peer)
npm run build:local:ci         # build + link matterbridge, compact CI-style output
```

Run `npm run build:local:ci` again after any `npm install` — it's the fast way to catch build breakage (see `.claude/CLAUDE.md`).

### 1.3 CodeGraph (recommended — code intelligence for AI agents)

```sh
npm i -g @colbymchenry/codegraph
npm run codegraph:init
```

Full details: [`README_CODEGRAPH.md`](../README_CODEGRAPH.md). Without this, agents fall back to slower Grep/Glob sweeps.

### 1.4 Serena / LSP

- **Claude Code**: LSP is built in for the main session (not for subagents — see `.claude/memory.md` "LSP tool availability"). `.mcp.json` also registers a `serena` server used mainly by Cursor.
- **Cursor**: uses Serena MCP for symbol lookups (`.cursor/mcp.json`).
- If you're on a different machine than the committed `.mcp.json` path, update the `serena` entry's `--project` path to your local clone location, or Serena will point at the wrong directory.

See `.mcp.json` for the full MCP server list: `codegraph`, `glob-grep`, `cli-runner`, `serena`.

### 1.5 Reference workspaces (external codebases for research)

`ref-idea` and the technical-architect's investigator can research **other codebases** (e.g. the Matterbridge SDK, python-roborock, other Roborock/Matter integrations) to see how a problem has been solved elsewhere — but only in paths you explicitly allowlist.

1. Clone whatever reference repos you want available, anywhere on disk.
2. Copy the template and fill in real paths:
   ```sh
   cp .claude/templates/reference-workspaces.md wiki/reference-workspaces.md
   ```
3. Edit `wiki/reference-workspaces.md`, replacing the placeholder row with real `Name | Path | Notes` entries, ordered by priority (agents stop at the first source that answers the question).

Nothing outside this allowlist is readable by investigator/technical-architect during reference research — this is intentional (read-only, scoped).

### 1.6 Roborock account login (CLI)

Authentication is a manual, one-time step — no agent does this for you:

```sh
npm run build:local:ci   # if not already built
npm run cli -- --command login
```

This saves a session file (gitignored) that `npm run cli` and the `cli-runner` MCP tool both reuse. See [`README_CLI.md`](../README_CLI.md) for the full command list.

---

## 2. Starting a session

Open Claude Code (or Cursor) in the repo root. `CLAUDE.md` routes automatically to `.claude/CLAUDE.md` (Claude Code) or `.cursor/CURSOR.md` (Cursor) — you don't need to point it there yourself.

- If the session doesn't seem to be following the orchestration flow (e.g. it starts writing code directly for a non-trivial request), run **`/load-policy`** to force-load the Engineer Manager playbook.
- Read [`docs/user-guide.md`](user-guide.md) once — it's the cheat sheet for *how to phrase requests* (low/medium/high complexity, "follow-up", "direct", etc.) and the token-saving habits section is worth the five minutes.
- Check [`docs/to_do.md`](to_do.md) for a backlog if you don't have a specific task in mind — "do the top item in to_do.md" is a valid way to start a session.

---

## 3. Brainstorming

Before writing any code, use these two skills to build context cheaply (they run research only — no implementation, no approval gate needed):

- **`/status-of <feature>`** — "what do we currently do for X, what's missing, what's already been decided?" Reads `.claude/memory.md`, `docs/to_do.md`, `docs/claude_history.md`, and the actual source, and gives you a plain-language status report. Use this **first** when picking up unfamiliar territory.
- **`/ref-idea <question>`** — researches the allowlisted reference codebases (§1.5) for how the Roborock protocol / Matter integration / a similar feature has been handled elsewhere, then reports candidate approaches. Follow up with "apply idea N" to turn a finding into a real implementation cycle.

Typical sequence: `/status-of per-room water flow` → read the report → `/ref-idea how does python-roborock read per-room water flow?` → `apply idea 1`.

---

## 4. Start doing something fun — implementation workflow

State the request with a complexity hint if you can ("low: …", "this is medium/high: …") — see `docs/user-guide.md` §2 for the cheat sheet. The EM will confirm before spawning anything non-trivial, and nothing is ever committed without you reviewing the diff first.

### For device-protocol / hardware-behavior work, use two phases

A lot of bugs in this codebase come from guessing at undocumented Roborock protocol behavior (byte widths, field offsets, feature flags) without ever touching a real device. Don't let an agent write production code against an unverified guess — split the work:

**Phase 1 — verify on the CLI**
Confirm the exact request/response shape against a real device *before* any production code changes:

```sh
npm run cli -- --command <status|map-info|legacy-map-info|custom|...> --duid <duid> [--local]
```

Or, from within a Claude Code session, ask an agent to call the `cli-runner` MCP tool (`RunCli`) directly and capture the output for you — faster iteration than shelling out yourself. `login` is intentionally excluded from that tool; you authenticate once manually (§1.6).

Confirm things like: does this attribute exist on this model, what does the raw payload actually look like, does a `custom --method` call return what you expect. Capture the real bytes/JSON before writing a parser or handler around them.

**Phase 2 — wire into production, scoped to what you verified**
Only after Phase 1 confirms the behavior, implement it in `src/`. Scope the change to the **specific device model / protocol version you actually tested** (e.g. gate by `DeviceModel`, `ProtocolVersion`, or a feature flag) rather than assuming it generalizes to every device — this keeps the blast radius limited to hardware you've confirmed, and other models fall back to existing behavior untouched.

This two-phase pattern is already recorded in `.claude/memory.md` under "Decisions Made" — cite it in your requirement if you want the architect to plan around it explicitly.

### Then let the normal pipeline run

- Low complexity → `direct-executor`, done in one pass.
- Medium/high → `technical-architect` → `briefer` → **your approval** → `implementer` → `reviewer` → `test-writer` → `documenter`.
- When it's done: "finalize" prepares the commit (format, precommit, message) — you still run `git commit`/`git push` yourself.

---

## 5. Where to go next

| Question | Doc |
| --- | --- |
| How do I phrase requests / what's the cheat sheet? | [`docs/user-guide.md`](user-guide.md) |
| How do I add a new device model or clean mode? | [`README_DEV.md`](../README_DEV.md) |
| CodeGraph setup/usage details | [`README_CODEGRAPH.md`](../README_CODEGRAPH.md) |
| Full CLI command reference | [`README_CLI.md`](../README_CLI.md) |
| What's already been decided / known pitfalls | [`.claude/memory.md`](../.claude/memory.md) |
| Backlog | [`docs/to_do.md`](to_do.md) |
| Habits experienced Claude users follow | [`docs/pro-tips.md`](pro-tips.md) |
| Something feels off / EM not behaving | `docs/user-guide.md` §8 Troubleshooting |
