type: implement
complexity: high
mode: proposal

# Requirement — Durable Phase 2 proposal (B01 currentPose / room detection)

## Goal

Write a **persistent proposal plan** for a future technical-architect (or implementer) to pick up Phase 2 without re-reading the full ephemeral task cycle.

## Output location (mandatory)

Save the primary document to:

`docs/todo-task/b01-currentpose-phase2-proposal.md`

This folder is **not** ephemeral — it must survive `clean-paths.mjs` cleanup of `docs/<task>/` orchestration folders.

## Audience

A future TA who has **no** context from `docs/b01-currentpose-room-detection/` (may be deleted). The proposal must be self-contained.

## Content requirements

1. **Context** — Why we care: multi-room Q10 cleaning shows "Preparing" when `cleaning_info` is absent; prior investigation conclusions; device scope (Q10 only); references to roborock-gitlab `b01.proto`, python-roborock trace packet, ioBroker field observations.

2. **Phase 1 summary (brief)** — What landed in code: shared proto/parser types, `resolveRoomFromPose()` safe no-op, `b01-pose-info` CLI, tests, v1 rename if relevant. File paths and how to verify manually.

3. **Phase 2 (detailed)** — Everything needed to implement later:
   - `roomMatrix` byte-layout research strategy (CLI capture → decode algorithm — do NOT guess encoding)
   - Production wiring per original `docs/b01-currentpose-room-detection/plan.md` Phase 2 files (`areaManagementService`, `roborockService`, `mapInfoListener`, `serviceAreaHandler`)
   - Exact behavioral contracts, fallback rules, cache lifecycle (idle clear), constraints, risks
   - Prerequisites / gates (e.g. real Q10 device data confirming matrix layout)
   - Suggested implementation steps, file list, test strategy
   - Open questions and deferred decisions

4. **Pointers** — Link to `wiki/B01-Map-Parsing.md` and related wiki pages; note ephemeral source `docs/b01-currentpose-room-detection/` and `docs/room-update-fallback-investigation/` if still present.

## Source material (read these)

- `docs/b01-currentpose-room-detection/plan.md` — authoritative Phase 2 design (Phase 1 completed; Phase 2 not implemented)
- `docs/b01-currentpose-room-detection/business-brief.md`
- `docs/b01-currentpose-room-detection/requirement.md`
- `docs/to_do.md` — deferred Phase 2 item
- `docs/claude_history.md` — 2026-07-03 Phase 1 entry
- `wiki/B01-Map-Parsing.md` and related wiki updates from documenter
- Actual landed code under `src/roborockCommunication/map/b01/`, `src/cli/commands/b01PoseInfo.ts`

## Constraints

- Do **not** implement code — planning document only.
- Phase 2 production wiring was **intentionally deferred**; proposal must reflect that.
- `resolveRoomFromPose()` must remain safe (no wrong room ID) until matrix encoding is confirmed.
