<!--
Commit message template. Subject <= 72 chars, imperative mood, lowercase after the type, no trailing period.
Body optional: explain WHY and the effect, wrap at about 72 chars, blank line between subject and body.
Do NOT add Co-Authored-By, a Claude session link, a `Claude-Session:` trailer or any "Generated with" line.
Do NOT name where an idea came from (a reference repo, tool or version, e.g. "follows <project> 1.2"). Describe what the change does and why.
-->

```
<type>: <short summary>

<optional body: why this change, and its effect. Mention new config options with defaults. No reference to the source of the idea.>
```

## Types (only those our history uses)

| Type       | When                                |
| ---------- | ----------------------------------- |
| `feat`     | New behavior or capability          |
| `fix`      | Bug fix                             |
| `docs`     | Documentation only                  |
| `chore`    | Tooling, config, deps, version bump |
| `test`     | Tests only                          |
| `refactor` | Restructure, same behavior          |
| `perf`     | Performance only                    |
| `style`    | Formatting only, no logic change    |

No scope in parentheses: our history does not use them.

## PR number

A suffix like `(#188)` is added automatically by squash merges. Never write it by hand.

## Examples

```
feat: recognize Roborock P30 Pro (a306) and dock type 49
fix: stop selectAreas hanging on a stuck Matter transaction
docs: clean up to-do list (rc08 done, release comments verified)
chore: bump version to 1.2.0-rc08
```

With a body:

```
feat: read water slide codes 225/235/245 as Low/Medium/High

Slide devices report mop intensity as 221-250 instead of 201-203.
ModeResolver now maps 225, 235 and 245 to the Low, Medium and High
flow before lookup. Codes 221, 230, 240, 250 and 210 stay unmapped.
Read path only; the write path is unchanged.
```
