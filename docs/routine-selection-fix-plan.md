# Routine Selection Fix Plan

## Problem

When a user selects a routine (displayed as a room) in Apple Home, `setSelectedAreas` is called
with the routine's areaId (range 5000–9000). The current implementation fails to handle this:

### Bug 1 — Routine areaIds are stripped in `setSelectedAreas`

**File:** `src/services/areaManagementService.ts:32`

`setSelectedAreas` converts every areaId to a roomId via `RoomIndexMap`:

```typescript
const roomIds = selectedAreas.map((areaId) => indexMap.getRoomId(areaId)).filter((id) => id !== undefined);
this.selectedAreas.set(duid, roomIds);
```

Routine areaIds (5000+) are **not** in `RoomIndexMap` (which only contains real room mappings).
→ `getRoomId(5500)` returns `undefined` → filtered out → `selectedAreas` stored as `[]`.
→ **Routine selection is completely lost before `startClean` is called.**

### Bug 2 — Room selection breaks when routines are configured

**File:** `src/services/messageRoutingService.ts:93`

When routines are configured, `tryStartRoutineClean` runs and filters rooms using areaIds:

```typescript
const rooms = selected.filter((slt) => supportedRooms.some((a) => a.areaId === slt));
```

But `selected` at this point contains **roomIds** (e.g., `[17]`) converted by Bug 1's path,
not areaIds (e.g., `[2]`). Room areaIds are in range 1–4999; roomIds are arbitrary
device-specific numbers. The filter returns `[]`.
→ `filteredSelection = []` → `startRoomBasedClean` sees empty → **falls back to global clean**.

### Bug 3 — `startScene` receives areaId instead of actual scene ID

**File:** `src/services/messageRoutingService.ts:113`

```typescript
await this.iotApi.startScene(routines[0]);
```

`routines[0]` is an areaId = `SCENE_AREA_ID_MIN + routine.id = 5000 + sceneId`.
The IoT API expects the actual `sceneId`, not the encoded `areaId`.
→ **Scene start call sends wrong ID to Roborock cloud API.**

---

## Root Cause

`setSelectedAreas` converts areaIds to roomIds too early. The downstream routine-detection
logic in `messageRoutingService` expects areaIds to identify routines vs rooms. Once converted
to roomIds, the distinction is lost and both routine and room selections break.

---

## Fix Plan

### Change 1 — `src/services/areaManagementService.ts`

**`setSelectedAreas`**: Remove the RoomIndexMap conversion. Store raw areaIds as-is.

```typescript
// Before
public setSelectedAreas(duid: string, selectedAreas: number[]): void {
  const indexMap = this.supportedAreaIndexMaps.get(duid);
  if (!indexMap) {
    this.logger.warn('No area index map found for device', duid);
    this.selectedAreas.set(duid, []);
    return;
  }
  const roomIds = selectedAreas.map((areaId) => indexMap.getRoomId(areaId)).filter((id) => id !== undefined);
  this.selectedAreas.set(duid, roomIds);
}

// After
public setSelectedAreas(duid: string, selectedAreas: number[]): void {
  this.logger.debug('AreaManagementService - setSelectedAreas', selectedAreas);
  this.selectedAreas.set(duid, selectedAreas);
}
```

The `selectedAreas` map now stores raw areaIds from Matter. Conversion to roomIds happens
at dispatch time in `roborockService`.

---

### Change 2 — `src/services/roborockService.ts`

**`startClean`**: After fetching selectedAreaIds, separate routines from rooms, convert
room areaIds to roomIds, and pass a combined array to messageService.

```typescript
// Before
public async startClean(duid: string): Promise<void> {
  const selectedAreas = this.areaService.getSelectedAreas(duid);
  const supportedRooms = this.areaService.getSupportedAreas(duid) ?? [];
  const supportedRoutines = this.areaService.getSupportedRoutines(duid) ?? [];
  return this.messageService.startClean(duid, selectedAreas, supportedRooms, supportedRoutines);
}

// After
public async startClean(duid: string): Promise<void> {
  const selectedAreaIds = this.areaService.getSelectedAreas(duid);
  const supportedRooms = this.areaService.getSupportedAreas(duid) ?? [];
  const supportedRoutines = this.areaService.getSupportedRoutines(duid) ?? [];
  const indexMap = this.areaService.getSupportedAreasIndexMap(duid);

  const routineAreaIds = selectedAreaIds.filter((id) => supportedRoutines.some((r) => r.areaId === id));
  const roomAreaIds = selectedAreaIds.filter((id) => !supportedRoutines.some((r) => r.areaId === id));
  const roomIds = roomAreaIds
    .map((areaId) => indexMap?.getRoomId(areaId))
    .filter((id): id is number => id !== undefined);

  const resolvedSelection = [...routineAreaIds, ...roomIds];
  return this.messageService.startClean(duid, resolvedSelection, supportedRooms, supportedRoutines);
}
```

`resolvedSelection` contains:

- Routine areaIds (5000+) → preserved for scene detection in messageRoutingService
- Room IDs (device-specific) → ready for `startRoomCleaning` dispatcher call

---

### Change 3 — `src/services/messageRoutingService.ts`

**`tryStartRoutineClean`**: Three fixes:

**3a** — Change `rooms` filter: instead of matching by `supportedRooms.some(a.areaId)` (which
compares areaIds against roomIds — wrong), use "not a routine" to extract rooms:

```typescript
// Before
const rooms = selected.filter((slt) => supportedRooms.some((a) => a.areaId === slt));

// After
const rooms = selected.filter((slt) => !supportedRoutines.some((a) => a.areaId === slt));
```

Everything in `selected` that is not a routine areaId is a roomId — passed directly to
`startRoomCleaning`.

**3b** — Mixed selection (rooms + routines): start first routine by name, ignore rooms.

When both routines and rooms are selected, rooms are ignored. If multiple routines are
selected, pick the first one sorted alphabetically by `locationName`:

```typescript
// Before
if (routines.length > 1) {
  this.logger.warn('Multiple routines selected - falling back to global clean', { duid, routines });
  await this.startGlobalClean(duid);
  return { handled: true, filteredSelection: [] };
}

// After — resolve "first" routine by locationName, ignore rooms
const firstRoutineAreaId = routines
  .map((areaId) => supportedRoutines.find((r) => r.areaId === areaId)!)
  .sort((a, b) => (a.areaInfo.locationInfo.locationName ?? '').localeCompare(b.areaInfo.locationInfo.locationName ?? ''))
  [0].areaId;
```

When multiple routines are selected: sort by `areaInfo.locationInfo.locationName`, take first.
When one routine + rooms: run the routine, ignore rooms.

**3c** — Fix `startScene` call: subtract `SCENE_AREA_ID_MIN` to get actual scene ID:

```typescript
// Before
await this.iotApi.startScene(routines[0]);

// After
await this.iotApi.startScene(firstRoutineAreaId - SCENE_AREA_ID_MIN);
```

Import `SCENE_AREA_ID_MIN` from `../constants/index.js`.

---

## Files Changed

| File                                    | Change                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `src/services/areaManagementService.ts` | Store raw areaIds in `setSelectedAreas` (remove RoomIndexMap conversion) |
| `src/services/roborockService.ts`       | `startClean`: separate routines/rooms, convert room areaIds → roomIds    |
| `src/services/messageRoutingService.ts` | Fix `rooms` filter; fix `startScene` scene ID                            |

---

## Data Flow After Fix

### Routine selected (areaId 5500, sceneId 500)

```
User selects areaId 5500 in Apple Home
  ↓ setSelectedAreas([5500])
  ↓ stored as-is: selectedAreas = [5500]
  ↓ startClean → routineAreaIds=[5500], roomIds=[]
  ↓ resolvedSelection = [5500]
  ↓ messageService.startClean([5500], ...)
  ↓ tryStartRoutineClean → routines=[5500], rooms=[]
  ↓ iotApi.startScene(5500 - 5000) = startScene(500) ✓
```

### Room selected (areaId 2 → roomId 17)

```
User selects areaId 2 in Apple Home
  ↓ setSelectedAreas([2])
  ↓ stored as-is: selectedAreas = [2]
  ↓ startClean → routineAreaIds=[], roomAreaIds=[2]
  ↓ indexMap.getRoomId(2) = 17 → roomIds=[17]
  ↓ resolvedSelection = [17]
  ↓ messageService.startClean([17], ...)
  ↓ tryStartRoutineClean → routines=[], rooms=[17]
  ↓ return { handled: false, filteredSelection: [17] }
  ↓ startRoomBasedClean([17]) → startRoomCleaning(duid, [17], 1) ✓
```

### Room selected WITH routines configured

Same as above — the `rooms` filter now uses `!supportedRoutines.some(a.areaId === slt)`,
so roomId 17 (not in routines) passes through correctly.

### Both rooms and routine selected (areaId 5500 + roomId 17)

```
User selects [areaId 5500, areaId 2] in Apple Home
  ↓ setSelectedAreas([5500, 2])
  ↓ stored as-is
  ↓ startClean → routineAreaIds=[5500], roomAreaIds=[2] → roomIds=[17]
  ↓ resolvedSelection = [5500, 17]
  ↓ tryStartRoutineClean → routines=[5500], rooms=[17]
  ↓ routines.length >= 1 → sort by locationName → firstRoutine = 5500
  ↓ iotApi.startScene(5500 - 5000) = startScene(500) ✓ (rooms ignored)
```

### Multiple routines selected (areaId 5500, 5600)

```
routines = [5500, 5600]
  ↓ resolve locationNames: "Kitchen Clean" vs "Bedroom Clean"
  ↓ sort alphabetically → "Bedroom Clean" (5600) first
  ↓ iotApi.startScene(5600 - 5000) = startScene(600) ✓
```

---

## Tests to Add/Update

- `src/test/areaManagementService.test.ts` — `setSelectedAreas` stores raw areaIds
- `src/test/messageRoutingService.test.ts` — routine and room selection when routines configured
- `src/test/roborockService.test.ts` — `startClean` converts room areaIds to roomIds
