# B01 currentPose / Room Detection — Phase 2 Proposal

**Status:** Phase 1 complete. Phase 2 deferred — pending real Q10 device data.
**Audience:** A future Technical Architect or Implementer with no access to ephemeral task folders.
**Date written:** 2026-07-03

---

## 1. Context

### Why This Matters

When a Q10 robot vacuum cleans multiple rooms simultaneously, the Matterbridge plugin cannot determine which room the robot is actually in during the clean. The `cleaning_info` status field — which normally carries a segment ID — is absent during multi-room Q10 cleaning. The fallback in `serviceAreaHandler.ts → handleCleaningWithoutInfo()` therefore falls through to "Preparing" in the Matter `currentArea` attribute for all multi-room Q10 sessions.

This is purely a Q10 (B01-family) problem. V1 devices have a different fallback via `LegacyMapParser`; Q7 has no known live-position channel at all; single-room cleaning is unaffected regardless of device.

### Device Scope

**Q10 only.** The B01 protobuf `RobotMap` message carries `currentPose` (field 8) and `roomMatrix` (field 13) — both confirmed present in the wire schema by roborock-gitlab's `b01.proto` reverse-engineering. Q7 would nominally use the same proto field, but **no reference implementation has confirmed Q7 devices populate these fields in real firmware** — Q7 is explicitly out of scope.

### References Consulted During Original Investigation

| Reference                                              | Finding                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **roborock-gitlab** (`@functor/roborock`, `b01.proto`) | Richest B01 proto schema found; declares `currentPose = 8` and `roomMatrix = 13`; `MapContainerB01.getRobotPosition()` is a live accessor; neither field is joined to a room ID anywhere in that repo                                                                                        |
| **python-roborock** (`b01_q10_map_parser.py`)          | `Q10TracePacket.robot_position` is a real live Q10 position signal sourced from **trace packets** (protocol marker `02 01`) — a separate transport not currently consumed by this project; the signal is never joined to a room despite room `pixel_value` + grid data being available       |
| **ioBroker.roborock** (`Q10MapCreator.ts:70-79`)       | **Strongest real-world evidence of unreliability**: explicitly notes live Q10 pose is often absent from device pushes; builds a dock-anchoring workaround to prevent the robot icon from disappearing; independently corroborates that `currentPose` may be empty mid-clean on real hardware |
| **This project (prior B01 status)**                    | `roborockProto.ts` only declared `mapType`, `mapHead`, and `roomDataInfo`; `currentPose` and `roomMatrix` were present on the wire but undecoded                                                                                                                                             |

### The `roomMatrix` Problem

The root open question for Phase 2 is: **how does `roomMatrix` encode pixel-to-room membership?** No reference implementation — including roborock-gitlab, which raw-decodes the bytes — interprets or documents the byte layout. It is plausibly a pixel-per-byte or packed grid (analogous to the V1 `packed >> 21` room ID scheme in `LegacyMapParser`), but **this is speculation from the field name, not confirmed**. A wrong room ID is worse than no room ID — it would silently corrupt `currentArea` — so Phase 2 must not attempt to implement decoding until real Q10 capture data confirms the layout.

---

## 2. Prior Investigation Artifacts

These documents may be deleted when their ephemeral task folder is cleaned:

- `docs/b01-currentpose-room-detection/requirement.md` — original requirement with phase design decisions
- `docs/b01-currentpose-room-detection/plan.md` — authoritative technical plan (Phase 1 implemented; Phase 2 section is the source for §5 below)
- `docs/b01-currentpose-room-detection/business-brief.md` — non-technical summary
- `docs/room-update-fallback-investigation/answer-b01-reference-research.md` — detailed per-reference findings (python-roborock, ioBroker, roborock-gitlab)
- `docs/room-update-fallback-investigation/answer.md` — original fallback behavior investigation

**Surviving references:**

- `wiki/B01-Map-Parsing.md` — authoritative wiki page; kept current by documenter
- `wiki/Room-Map-Sync-Flow.md` — production listener architecture; §6 notes Phase 2 as deferred
- `docs/to_do.md` — "B01 currentPose Phase 2 (deferred)" in Pending list

---

## 3. Phase 1 — What Landed

Phase 1 was implemented and reviewed on 2026-07-03. All changes are in the current codebase.

### Shared Decode Core

| File                                                      | Change                                                                                                                                                                                                                                                |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/roborockCommunication/map/b01/roborockProto.ts`      | Added `DeviceCurrentPoseInfo currentPose = 8` and `DeviceRoomMatrix roomMatrix = 13` to `SCMap.RobotMap`; added `DeviceCurrentPoseInfo` and `DeviceRoomMatrix` message types                                                                          |
| `src/roborockCommunication/map/b01/types.ts`              | Added `B01Pose { x, y, phi? }` and `B01RoomMatrix { data: Buffer }` interfaces; extended `B01MapInfo` with optional `currentPose?` and `roomMatrix?` fields                                                                                           |
| `src/roborockCommunication/map/b01/b01MapParser.ts`       | `parseRooms()` now defensively extracts `currentPose` and `roomMatrix` after the existing `mapId` extraction, using `typeof`/`Buffer.isBuffer()` guards; both fields are included in all return branches (empty-rooms early-return and normal return) |
| `src/roborockCommunication/map/b01/roomMatrixResolver.ts` | **New.** `resolveRoomFromPose(pose, roomMatrix): number \| undefined` — pure, dependency-free; always returns `undefined` (intentional safe no-op with explanation comment); never throws                                                             |

### CLI Tool

| File                              | Change                                                      |
| --------------------------------- | ----------------------------------------------------------- |
| `src/cli/commands/b01PoseInfo.ts` | **New.** See call flow and notes below.                     |
| `src/cli/main.ts`                 | `case 'b01-pose-info'` wired after `legacy-map-info`        |
| `src/cli/help.ts`                 | `b01-pose-info` row + example added after `legacy-map-info` |

**`b01PoseInfo.ts` call flow** — `cmdB01PoseInfo(duid, session, logger, local)`:

1. `connectDevice`
2. `waitForPush(Protocol.map_response)`
3. `dispatcher.getMapInfo(duid)`
4. `B01MapParser.parseRoomsFromEncryptedBinary()`
5. `resolveRoomFromPose()`
6. Print pose / resolved room / room list / roomMatrix byte length

Note: device model/serial is looked up directly from `session.devices` (not via the `connectDevice` return value, which doesn't expose `device`).

### Tests Added

- `src/tests/cli/b01PoseInfo.test.ts`
- `src/tests/roborockCommunication/map/b01/roomMatrixResolver.test.ts`
- `src/tests/roborockCommunication/map/b01/b01MapParser.test.ts` (currentPose/roomMatrix extraction cases)

### How to Verify Manually

```bash
npm run cli -- --command b01-pose-info --duid <Q10_DUID>
```

Expected output on a real Q10 mid-clean:

- `Robot pose: { x: ..., y: ..., phi: ... }` — if device populates the field
- `Robot pose: not found` — if device does NOT populate (see ioBroker finding; this is common)
- `Resolved room: could not determine — roomMatrix decoding not yet implemented, pending real-device capture`
- Room list from `roomDataInfo` (for cross-reference)
- `Raw roomMatrix byte length: <N>` or `not found`

**The byte length of `roomMatrix` is the key diagnostic for Phase 2 readiness.** If it's consistently `not found` or 0, Phase 2 may need to use a different strategy.

---

## 4. Phase 2 — The Open Problem: `roomMatrix` Decoding

### Research Strategy Before Implementation

Phase 2 cannot be implemented until the `roomMatrix` byte layout is confirmed. The recommended approach:

1. **Capture real Q10 data** with `b01-pose-info` on a Q10 during active multi-room cleaning. Record:
   - Whether `currentPose` is populated (and if `phi` is present)
   - The exact byte length of `roomMatrix`
   - The room list from `roomDataInfo` (room IDs present)

2. **Correlate pose to rooms visually.** While the CLI prints the pose `(x, y)`, the user knows which room the robot is in from the Roborock app. Run the CLI from multiple known positions (room A, room B, room C) and record `(x, y)` → known room ID pairs.

3. **Decode candidate algorithm.** Given a captured `roomMatrix` buffer of known dimensions, test candidate layouts:
   - `MapHeadInfo` on the same `RobotMap` message carries `sizeX`, `sizeY`, `minX`, `minY`, `resolution` — these define the coordinate-to-pixel mapping. The pose `(x, y)` is in map coordinates; convert to pixel `(px, py)` via `px = round((x - minX) / resolution)`, `py = round((y - minY) / resolution)`.
   - Index into `roomMatrix.data` at `py * sizeX + px`. If `data[index]` equals a `roomId` from `roomDataInfo`, the encoding is one-byte-per-pixel, room-ID value. This is the most likely layout based on the V1 parallel.
   - Alternative: packed bits (V1 uses `packed >> 21` for room ID and `packed & 0x1fffff` for other flags in a 4-byte-per-pixel layout). Test `data.readUInt32LE(index * 4) >> 21` if the simple 1-byte check fails.
   - Alternative: the matrix is indexed by room ID, not by position — inspect whether `data.length` equals `rooms.length` (a lookup table rather than a grid).

4. **Implement only when confirmed.** Once correlation is verified across ≥3 distinct rooms, implement `resolveRoomFromPose()` in `roomMatrixResolver.ts`. The function signature and all surrounding infrastructure already exist.

> **Do NOT guess or port the V1 encoding.** V1 `LegacyMapParser` uses `packed & 0x1fffff` / `packed >> 21` on a pixel grid — this is a different, unconfirmed wire format for B01 data.

### The `MapHeadInfo` Coordinate System

`MapHeadInfo` is already decoded in Phase 1 (`b01MapParser.ts` line 64) but only `mapHeadId` is extracted. For Phase 2, `sizeX`, `sizeY`, `minX`, `minY`, and `resolution` must also be extracted and carried alongside `roomMatrix` for the coordinate transform. This requires a minor extension to `B01MapInfo` and `b01MapParser.ts`.

---

## 5. Phase 2 — Detailed Implementation Plan

This section is **implementation-ready**. A future implementer can produce a `plan.md` from this section alone.

### 5.1 Prerequisites / Gates

Phase 2 must NOT be implemented until:

- [ ] Real Q10 device capture confirms `roomMatrix` byte layout (via `b01-pose-info` CLI)
- [ ] At least one `(pose, roomMatrix)` pair successfully correlates to a correct room ID
- [ ] `resolveRoomFromPose()` is implemented and manually verified against captured data

If the above gates are not met, **do not implement Phase 2** — the existing "Preparing" fallback is safe; a wrong room ID is a silent data corruption.

### 5.2 Architecture Overview

The design is a **cache-write / cache-read split** across two structurally independent listeners:

```
MapInfoListener.tryParseB01MapBinary()
  → resolveRoomFromPose(pose, matrix) → roomId
  → areaManagementService.setLastKnownB01Room(duid, roomId)   [cache write]

serviceAreaHandler.handleCleaningWithoutInfo()
  → roborockService.getLastKnownB01Room(duid) → roomId        [cache read]
  → if roomId: set currentArea + selectedAreas, return early
  → else: existing fallback unchanged
```

`MapInfoListener` (map-binary push, `Protocol.map_response`) and `B01StatusListener` (status push) are structurally separate — no coupling exists or should be introduced between them. The cache is the only bridge.

### 5.3 Files to Modify

#### `src/roborockCommunication/map/b01/types.ts`

Extend `B01MapInfo` to include `mapHead` fields needed for coordinate transform:

```ts
export interface B01MapHead {
  sizeX: number;
  sizeY: number;
  minX: number;
  minY: number;
  resolution: number;
}

// Add to B01MapInfo:
mapHead?: B01MapHead;
```

#### `src/roborockCommunication/map/b01/b01MapParser.ts`

In `parseRooms()`, after the existing `mapId` extraction (currently line 65), extract the additional `mapHead` fields:

```ts
const mapHead: B01MapHead | undefined =
  mapHead && typeof mapHead.sizeX === 'number' && typeof mapHead.sizeY === 'number' &&
  typeof mapHead.minX === 'number' && typeof mapHead.minY === 'number' &&
  typeof mapHead.resolution === 'number'
    ? { sizeX: mapHead.sizeX, sizeY: mapHead.sizeY, minX: mapHead.minX, minY: mapHead.minY, resolution: mapHead.resolution }
    : undefined;
```

Include `mapHead` in all return branches alongside `currentPose` / `roomMatrix`.

#### `src/roborockCommunication/map/b01/roomMatrixResolver.ts`

Replace the safe no-op body with the confirmed decoding algorithm. Signature remains identical:

```ts
export function resolveRoomFromPose(
  pose: B01Pose | undefined,
  roomMatrix: B01RoomMatrix | undefined,
  mapHead: B01MapHead | undefined,
  rooms: B01RoomInfo[],
): number | undefined
```

**Note:** Add `mapHead` and `rooms` parameters — needed for coordinate transform and room ID validation. All callers must be updated accordingly. The function must still never throw and must return `undefined` for any malformed/missing input.

Implementation skeleton (to be filled in once encoding is confirmed):

```ts
export function resolveRoomFromPose(
  pose: B01Pose | undefined,
  roomMatrix: B01RoomMatrix | undefined,
  mapHead: B01MapHead | undefined,
  rooms: B01RoomInfo[],
): number | undefined {
  if (!pose || !roomMatrix || !mapHead || rooms.length === 0) return undefined;
  if (typeof pose.x !== 'number' || typeof pose.y !== 'number') return undefined;
  if (!Buffer.isBuffer(roomMatrix.data) || roomMatrix.data.length === 0) return undefined;

  // TODO: implement based on confirmed byte layout from b01-pose-info capture
  // Candidate: 1-byte-per-pixel grid indexed by (py * sizeX + px)
  // const px = Math.round((pose.x - mapHead.minX) / mapHead.resolution);
  // const py = Math.round((pose.y - mapHead.minY) / mapHead.resolution);
  // if (px < 0 || px >= mapHead.sizeX || py < 0 || py >= mapHead.sizeY) return undefined;
  // const roomId = roomMatrix.data[py * mapHead.sizeX + px];
  // return rooms.some((r) => r.roomId === roomId) ? roomId : undefined;

  return undefined;
}
```

#### `src/services/areaManagementService.ts`

Add a new per-duid cache for the last known resolved room from B01 live pose.

Location: alongside existing per-duid `Map` fields near `supportedAreaIndexMaps` (line ~19).

```ts
private lastKnownB01Room = new Map<string, number>();
```

Add three new public methods, placed near `setSupportedAreaIndexMap`/`getSupportedAreasIndexMap` (lines ~70-84):

```ts
public setLastKnownB01Room(duid: string, roomId: number): void {
  this.lastKnownB01Room.set(duid, roomId);
}

public getLastKnownB01Room(duid: string): number | undefined {
  return this.lastKnownB01Room.get(duid);
}

public clearLastKnownB01Room(duid: string): void {
  this.lastKnownB01Room.delete(duid);
}
```

In `clearAll()` (lines ~182-194), add `this.lastKnownB01Room.clear();` alongside other `.clear()` calls.

#### `src/services/roborockService.ts`

Add three delegate methods mirroring the existing `setSupportedAreaIndexMap`/`getSupportedAreasIndexMap` pair (see lines ~213, ~232-234 for the exact delegate pattern):

```ts
public setLastKnownB01Room(duid: string, roomId: number): void {
  this.areaService.setLastKnownB01Room(duid, roomId);
}

public getLastKnownB01Room(duid: string): number | undefined {
  return this.areaService.getLastKnownB01Room(duid);
}

public clearLastKnownB01Room(duid: string): void {
  this.areaService.clearLastKnownB01Room(duid);
}
```

#### `src/roborockCommunication/routing/listeners/implementation/mapInfoListener.ts`

In `tryParseB01MapBinary()` (currently lines ~152-191), after the existing successful `b01Info` decode (after line ~167, before/alongside the room-mapping logic at lines ~173-183), add:

```ts
import { resolveRoomFromPose } from '../../../map/b01/roomMatrixResolver.js';

// After successful b01Info decode:
const resolvedRoom = resolveRoomFromPose(
  b01Info.currentPose,
  b01Info.roomMatrix,
  b01Info.mapHead,   // new field from §5.3 types/parser extension
  b01Info.rooms,
);
if (resolvedRoom !== undefined) {
  this.areaService.setLastKnownB01Room(this.duid, resolvedRoom);
  this.logger.debug(`[${this.duid}] MapInfoListener: B01 live pose resolved to room ${resolvedRoom}`);
}
```

No constructor changes needed — `MapInfoListener` already holds `this.areaService: AreaManagementService` via its existing constructor parameter.

#### `src/runtimes/handlers/serviceAreaHandler.ts`

In `handleCleaningWithoutInfo()` (currently lines ~68-94), insert a new step **immediately after** `const selectedAreas = getSelectedAreas(...)` (line ~76) and **before** the travel check (line ~78):

```ts
const livePoseRoom = platform.roborockService?.getLastKnownB01Room(robot.device.duid);
if (livePoseRoom !== undefined) {
  await robot.updateAttribute(ServiceArea.id, 'selectedAreas', selectedAreas, logger);
  await robot.updateAttribute(ServiceArea.id, 'currentArea', livePoseRoom, logger);
  return;
}
```

This is **strictly additive**: when `getLastKnownB01Room()` returns `undefined` (the default for all devices today, and permanently for all non-Q10 or Q10 without pose data), execution falls through unchanged to the existing travel-check / single-room / multi-room logic.

In `handleServiceAreaUpdate()` (currently lines ~28-54), in the `Idle` branch (lines ~36-41), add a cache-clear to prevent room ID leakage across cleaning sessions:

```ts
platform.roborockService?.clearLastKnownB01Room(robot.device.duid);
```

Placed after the existing `selectedAreas` update in the Idle branch, before `return;`.

### 5.4 Updated CLI Command (b01PoseInfo.ts)

Update the caller to pass the new `mapHead` and `rooms` parameters to `resolveRoomFromPose()`:

```ts
const resolvedRoom = resolveRoomFromPose(
  b01Info.currentPose,
  b01Info.roomMatrix,
  b01Info.mapHead,
  b01Info.rooms,
);
```

The output message for "could not determine" can be updated once Phase 2 is live to remove the "not yet implemented" qualifier.

### 5.5 Implementation Steps (ordered)

1. Confirm `roomMatrix` encoding from real Q10 capture (prerequisite gate — cannot skip)
2. Extend `types.ts` — add `B01MapHead` interface; add `mapHead?` to `B01MapInfo`
3. Extend `b01MapParser.ts` — extract full `mapHead` fields in `parseRooms()`; include in both return branches
4. Implement `resolveRoomFromPose()` in `roomMatrixResolver.ts` — replace no-op body with confirmed algorithm; add `mapHead` and `rooms` parameters
5. Update `b01PoseInfo.ts` CLI caller — pass new parameters; update output message
6. Extend `areaManagementService.ts` — add `lastKnownB01Room` Map and three methods + `clearAll()` entry
7. Extend `roborockService.ts` — add three delegate methods
8. Modify `mapInfoListener.ts` — call `resolveRoomFromPose()` after B01 decode; write to cache on non-`undefined` result
9. Modify `serviceAreaHandler.ts` — insert cache-read short-circuit in `handleCleaningWithoutInfo()`; add cache-clear in Idle branch of `handleServiceAreaUpdate()`

---

## 6. Behavioral Contracts and Constraints

### Fallback Rules

| Condition                               | Behavior                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| `currentPose` not present in map binary | `resolveRoomFromPose()` returns `undefined`; existing fallback runs unchanged               |
| `roomMatrix` not present or zero-length | `resolveRoomFromPose()` returns `undefined`; existing fallback runs unchanged               |
| Pose outside map bounds                 | `resolveRoomFromPose()` returns `undefined`; existing fallback runs unchanged               |
| Room ID from matrix not in `rooms` list | `resolveRoomFromPose()` returns `undefined`; do not return unknown IDs                      |
| Cache is empty (no resolved room yet)   | `getLastKnownB01Room()` returns `undefined`; existing fallback runs unchanged               |
| Robot goes Idle                         | Cache cleared via `clearLastKnownB01Room()` — prevents stale room from leaking              |
| Any non-Q10 device                      | `MapInfoListener.tryParseB01MapBinary()` is never called for V1 devices; Q7 is out of scope |

### Safety Constraints

- `resolveRoomFromPose()` MUST NEVER THROW under any input
- `resolveRoomFromPose()` MUST remain a pure function with no imports from `src/cli/`, `src/services/`, or `matterbridge/*`
- Phase 2 changes are **additive only** — every existing path in `handleCleaningWithoutInfo()` must remain reachable and behaviorally unchanged when `getLastKnownB01Room()` returns `undefined`
- Do NOT attempt to port V1's `packed & 0x1fffff` / `packed >> 21` encoding onto B01 data
- Do NOT touch Q7 code paths; do NOT modify `ServiceAreaUpdateMessage` / `MessagePayloads.ts`
- Do NOT add new `Protocol` enum entries or new `AbstractMessageListener` registrations — `currentPose` arrives on the existing `Protocol.map_response` (301) buffer in `MapInfoListener`, no new transport plumbing needed

### Cache Lifecycle

- **Written:** each time `MapInfoListener.tryParseB01MapBinary()` produces a non-`undefined` `resolveRoomFromPose()` result
- **Read:** each time `handleCleaningWithoutInfo()` runs for a Q10 device
- **Cleared:** when robot transitions to `Idle` in `handleServiceAreaUpdate()`
- **Not written across maps:** `tryParseB01MapBinary()` already handles the `onActiveMapChanged` callback; if a map switch clears areas, the stale cache from the previous map should also be cleared — consider adding `clearLastKnownB01Room()` in the active-map-changed handler path (`serviceAreaHandler.handleActiveMapChanged()`, lines ~55-64) as a defensive measure

---

## 7. Test Strategy

### Unit Tests

| File                                                                        | Cases                                                                                                                                                                                                          |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/tests/roborockCommunication/map/b01/roomMatrixResolver.test.ts`        | Missing pose → undefined; missing roomMatrix → undefined; missing mapHead → undefined; pose out of bounds → undefined; pixel value not in rooms list → undefined; correct pixel → correct roomId; never throws |
| `src/tests/roborockCommunication/map/b01/b01MapParser.test.ts`              | mapHead fields extracted; mapHead fields included in early-return branch                                                                                                                                       |
| `src/tests/services/areaManagementService.test.ts`                          | set/get/clear round-trip; clearAll() clears the map; undefined on miss                                                                                                                                         |
| `src/tests/services/roborockService.test.ts`                                | Delegate calls through to areaService                                                                                                                                                                          |
| `src/tests/roborockCommunication/routing/listeners/mapInfoListener.test.ts` | resolvedRoom written to cache when non-undefined; cache NOT written when undefined; debug log emitted                                                                                                          |
| `src/tests/runtimes/handlers/serviceAreaHandler.test.ts`                    | livePoseRoom short-circuit fires when cache has value; sets selectedAreas + currentArea; returns early; cache-clear fires on Idle                                                                              |

### Integration Notes

- `roomMatrixResolver.ts` tests should use synthetic `roomMatrix` buffers crafted to match the confirmed encoding (populated after real-device data is available)
- The CLI output change in `b01PoseInfo.ts` should be covered by updating the existing `b01PoseInfo.test.ts` mock fixture

---

## 8. Risks

| Risk                                                                         | Likelihood | Impact                                                  | Mitigation                                                                                                           |
| ---------------------------------------------------------------------------- | ---------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Real Q10 firmware does NOT populate `currentPose` (ioBroker finding)         | Medium     | Blocks Phase 2 entirely                                 | CLI diagnostic (`b01-pose-info`) exists precisely to test this; if absent, fallback is safe                          |
| `roomMatrix` byte layout is different from any candidate algorithm           | Medium     | Blocks algorithm implementation                         | Capture-first strategy; multiple candidates tested with known ground-truth                                           |
| Room ID from matrix is a transient index, not stable between cleans          | Low        | Phase 2 could produce wrong rooms after map rebuilds    | Validate room ID against `rooms` list on every resolution; cross-reference with live room names                      |
| Cache leaks across cleaning sessions (robot goes back to base between rooms) | Low        | `currentArea` stuck at last seen room in next clean     | `clearLastKnownB01Room()` on Idle handles this; also consider clearing on active-map-change                          |
| Q10 firmware update changes `roomMatrix` encoding                            | Low        | Silent wrong rooms                                      | `roomMatrixResolver()` guard against unknown IDs provides safety net                                                 |
| `currentPose` is only populated mid-clean (python-roborock CLI warning)      | High       | Room detection only works when robot is actively moving | By design — the cache-write only fires during a live map binary push mid-clean; this is expected behavior, not a bug |

---

## 9. Open Questions

1. **Does `MapHeadInfo.resolution` in protobuf decode correctly?** protobuf float fields are 32-bit; confirm `resolution` round-trips without precision loss in the coordinate transform.

2. **Is `roomMatrix` stable across multiple map-binary pushes in one clean?** If it's rebuilt per-push, the algorithm must be idempotent; if it's only present in the first push, the cache must persist correctly.

3. **Should `clearLastKnownB01Room()` also fire on `handleActiveMapChanged()`?** The stale room from a prior map could leak if the robot switches maps mid-session. Adding the clear there is defensive and low-cost.

4. **Is `b01Info.rooms` the right source for room ID validation, or should we use `areaManagementService.getSupportedAreas(duid)`?** Using `b01Info.rooms` keeps `resolveRoomFromPose()` pure (no service import); using `getSupportedAreas` would give the authoritative plugin room list but requires a service dependency. Recommend keeping `resolveRoomFromPose()` pure and doing validation at the call site in `mapInfoListener.ts`.

5. **What happens when `roomMatrix` is received but `rooms` is empty?** The map binary sometimes arrives before rooms are populated. The `rooms.length === 0` guard in `resolveRoomFromPose()` handles this, but consider whether the cache should be cleared or the push retried.

6. **Does `phi` (orientation angle) need to be used in any candidate algorithm?** None of the known layout candidates require orientation — it's position-only. But if `roomMatrix` encodes directional sectors, this assumption would be wrong.

---

## 10. References

### Codebase (current)

- `src/roborockCommunication/map/b01/roomMatrixResolver.ts` — safe no-op resolver (Phase 1)
- `src/roborockCommunication/map/b01/b01MapParser.ts` — `parseRooms()` and `parseRoomsFromEncryptedBinary()`
- `src/roborockCommunication/map/b01/types.ts` — `B01Pose`, `B01RoomMatrix`, `B01MapInfo`
- `src/roborockCommunication/map/b01/roborockProto.ts` — `SCMap.RobotMap` with `currentPose` (field 8), `roomMatrix` (field 13)
- `src/cli/commands/b01PoseInfo.ts` — Phase 1 CLI probe
- `src/roborockCommunication/routing/listeners/implementation/mapInfoListener.ts` — `tryParseB01MapBinary()` (production entry point for Phase 2 write)
- `src/runtimes/handlers/serviceAreaHandler.ts` — `handleCleaningWithoutInfo()` (target for Phase 2 read)
- `src/services/areaManagementService.ts` — existing per-duid Map pattern to mirror
- `src/services/roborockService.ts` — existing delegate pattern to mirror

### Wiki

- `wiki/B01-Map-Parsing.md` — module layout, parse pipeline, Phase 1 CLI usage
- `wiki/Room-Map-Sync-Flow.md` — production map binary handling, §6 Phase 2 deferred note
- `wiki/Message-Listeners-Architecture.md` — `MapInfoListener` registration and call path

### External Reference

- `roborock-gitlab` (`@functor/roborock`) — `b01.proto` field numbers; `MapContainerB01.getRobotPosition()`
- `python-roborock` — `b01_q10_map_parser.py`; `Q10TracePacket.robot_position`; trace-packet transport (protocol marker `02 01`)
- `ioBroker.roborock` — `Q10MapCreator.ts:70-79`; dock-anchoring workaround as evidence of unreliable live pose

---

## 11. Summary

Phase 2 is **not blocked by missing infrastructure** — the shared decode core, CLI probe, and all architectural interfaces are in place from Phase 1. The sole blocking dependency is **empirical confirmation of the `roomMatrix` byte layout** from a real Q10 device capture. Once that data exists:

1. Implement `resolveRoomFromPose()` using the confirmed algorithm (§5.3)
2. Wire the 4 production files (`areaManagementService`, `roborockService`, `mapInfoListener`, `serviceAreaHandler`) per §5.3 with the exact code snippets provided
3. Write tests per §7
4. Run `b01-pose-info` CLI against a live Q10 to validate end-to-end

Total estimated scope: **medium complexity** (4-5 files, established patterns, no new architecture). The only new conceptual work is `resolveRoomFromPose()` body, which depends entirely on the capture results.
