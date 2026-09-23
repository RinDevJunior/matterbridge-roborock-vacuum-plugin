---
name: workspace-console
description: Rebuild and update the Workspace Console artifact from local workspace/ tasks. Appends/updates tasks in a persistent gitignored index, then publishes to the SAME artifact URL so nothing is lost. Use when the user wants to refresh their workspace dashboard, add a task to it, or asks for /workspace-console. Main session only — a subagent cannot publish artifacts.
---

# Workspace Console

Keep a single tabbed dashboard Artifact in sync with the local `workspace/` task folders — **including gitignored, ephemeral ones**. The artifact is a _render_ of a persistent index, never appended to one task at a time, so re-publishing never drops earlier tasks.

**Main session only.** Only the main session holds the `Artifact` tool; a subagent cannot publish. Do not delegate the publish step.

## Model

- **Source of truth:** `workspace/.console-index.json` — a gitignored, local, append-only index. It survives `finalizer` cleanup of ephemeral `workspace/<task>/` folders, so a task stays on the dashboard even after its folder is deleted.
- **Renderer:** `scripts/workspace-console.mjs` (committed) turns the index into `workspace/.console.html` (gitignored). It owns all layout — never hand-write the HTML.
- **Publish target:** the `artifactUrl` field in the index (seeded with the canonical Workspace Console URL). Passing it as `url` updates that artifact **in place** — same link.

## Arguments

- **(none)** → upsert **every** `workspace/*/` task folder into the index, then render + publish.
- **`<folder>`** (e.g. `/workspace-console todo-task`) → upsert **only** that one folder; every other task already in the index is preserved.

## Steps

1. **Ensure the index exists:** run `node scripts/workspace-console.mjs init` (no-op if it already exists — never clobbers).
2. **Pick scope:** all `workspace/*/` folders (skip dotfiles and non-directories), or just the folder argument. Ignore the permanent helpers `to_do.md` / `claude_history.md` unless the user asks to include them.
3. **Distill each in-scope task** by reading whatever exists in the folder (`requirement.md`, `business-brief.md`, `plan.md`, `change-map.md`, `answer.md`, `README.md`, proposals) into one index entry:
   - `id` — the folder name (stable key; this is what makes it an upsert, not a duplicate).
   - `title` — short human name.
   - `status` — one of `done` · `in-progress` · `pending` · `deferred` · `reference`.
   - `source` — the most representative file path.
   - `summary` — 1–3 plain sentences.
   - `keyPoints` — up to ~5 bullets (plain strings).
   - `changeMapMermaid` — _optional_ raw Mermaid source (no fences) if the task has a `change-map.md`; the renderer wraps it in `<pre class="mermaid">`.
4. **Upsert into `workspace/.console-index.json`:** replace the entry with the same `id`, or append if new. **Never remove other tasks.** Refresh the top-level `updatedAt` (ISO string). Keep `artifactUrl` as-is.
5. **Render:** `node scripts/workspace-console.mjs render` → writes `workspace/.console.html`.
6. **Read** `workspace/.console.html` (you did not author it directly), then **publish** with the `Artifact` tool:
   - `file_path`: `workspace/.console.html`
   - `url`: the `artifactUrl` from the index (**required** — omitting it mints a new link and defeats the purpose)
   - `title`: `Workspace Console — Roborock Plugin` · `favicon`: `🤖` (keep both stable across runs)
   - `description`: one line, e.g. "Tabbed dashboard of the Roborock plugin workspace tasks."
7. **Report** the artifact URL and how many tasks it now carries.

## Notes

- **Deleting a task** from the dashboard is deliberate: remove its entry from the index by `id`, then render + publish. Don't do it unless asked.
- **Cross-machine:** the index is local by default (matches gitignored tasks). To share one dashboard across machines instead, move the index to a committed path (e.g. `.claude/workspace-console.json`) and update `INDEX_PATH` in `scripts/workspace-console.mjs` — but that puts task summaries in git.
- **Ownership:** updating in place requires being logged into the account that owns the artifact. If the `url` update is ever rejected as not-owned, publish fresh (no `url`), then save the new URL into the index's `artifactUrl`.
- **Lost URL?** `Artifact` `action: "list"` finds it by title (`Workspace Console — Roborock Plugin`).
