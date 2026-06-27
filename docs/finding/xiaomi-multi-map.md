# Reference Plugin Multi-Map Support Investigation

**Reference Plugin:** `/Volumes/ExternalSSD/code/references/matterbridge-xiaomi-roborock/`
**Current Plugin:** `/Volumes/ExternalSSD/code/matterbridge-roborock-vacuum-plugin/`
**Investigation Date:** 2026-06-27

---

## Executive Summary

The **reference plugin does NOT support multiple maps**. All `ServiceArea.Area` objects have `mapId: null` hardcoded. The plugin retrieves a single flat list of rooms from the device (via `getRoomMap()` or timer-based discovery) and exposes them as a flat list to the Matter controller with no mechanism to select between maps or track which map is active.

The **current plugin DOES support multiple maps** with per-map tracking, map switching, and map-scoped room retrieval. This architectural difference means Gap 1's "all-selected normalization" has different semantics in each plugin.

---

## Reference Plugin (`matterbridge-xiaomi-roborock`) — Multi-Map Analysis

### 1. Does It Store or Track More Than One Map?

**Answer: NO**

Evidence:
- **`vacuum_device_accessory.ts` line 333, 367:** All `ServiceArea.Area` objects hardcode `mapId: null`
  ```typescript
  return roomMapping.map(
    ([roomId, roomName], index): ServiceArea.Area => ({
      areaId: parseInt(roomId),
      mapId: null,  // ← Explicitly null, not a variable
      areaInfo: { ... }
    }),
  );
  ```
- **No map storage anywhere** — the plugin maintains only a single `serviceAreas: ServiceArea.Area[]` array, not a map of `Map<mapId, ServiceArea.Area[]>`
- **No multi-map API calls** — `getRoomMap()` returns a single flat response: `Promise<[string, string][]>` (room ID, room name pairs)
- **Fallback is also single-map** — if `getRoomMap()` fails, the plugin looks for a timer with room segments (`segments.split(',')`) and maps those to a single flat list

### 2. Does It Expose Map Selection to User or Matter Controller?

**Answer: NO**

Evidence:
- **No `switchMap()` or equivalent** — the device manager does not implement any mechanism to switch between maps or track an "active map"
- **No `mapId` parameter in API calls** — `getRoomMap()` takes no map selection argument; `cleanRooms()` accepts only room IDs, not a map context
- **No UI exposure** — the config file (`matterbridge-xiaomi-roborock.config.json`) has no `activeMap` or `mapSelection` option
- **No `ServiceArea.Cluster` events** — Matter controllers see a single static list of areas; there is no cluster attribute or command to switch maps

### 3. How Does It Resolve `selectAreas` / `ServiceArea` Across Multiple Maps?

**Answer: Single flat list; maps rooms from all sources (real or hypothetical) into one array**

Evidence:
- **`selectAreas` command handler** (line 163–170):
  ```typescript
  this.endpoint.addCommandHandler('selectAreas', async (data) => {
    let selectedAreas = data.request.newAreas;
    if ((data.attributes.supportedAreas as ServiceArea.Area[])?.length === selectedAreas.length) {
      selectedAreas = []; // Force empty if all areas are selected
    }
    await this.endpoint?.updateAttribute(ServiceArea.Cluster.id, 'selectedAreas', selectedAreas);
  });
  ```
  - All areas passed to `cleanRooms()` are room IDs from the **single flat list**
  - No per-map scoping; all selected areas are treated as belonging to the same namespace

- **Fallback room discovery** (line 346–380) also returns a single flat array:
  ```typescript
  const segments = timer[2][1][1].segments.split(',');
  return segments.map(
    (roomId, index): ServiceArea.Area => ({
      areaId: parseInt(roomId),
      mapId: null,
      // ...
    }),
  );
  ```

### 4. Data Flow Summary

```
getRoomMap() or Timer Fallback
    ↓
[roomId, roomName] pairs or "roomId,roomId,roomId"
    ↓
Convert to ServiceArea.Area[] with mapId: null
    ↓
Single static supportedAreas list (no map tracking)
    ↓
selectAreas → selectedAreas (areaId values)
    ↓
cleanRooms(selectedAreas) via device API
```

No map context anywhere in the flow.

---

## Current Plugin (`matterbridge-roborock-vacuum-plugin`) — Multi-Map Contrast

### 1. Multiple Map Storage

**Answer: YES**

Evidence:
- **`platformRunner.ts`:** Tracks active map
  ```typescript
  if (robot.homeInFo.activeMapId === data.mapId) return;
  robot.homeInFo.activeMapId = data.mapId;
  await handleActiveMapChanged(robot, data.mapId, this.platform);
  ```
- **`getSupportedAreas.ts`:** Stores per-map room lists
  ```typescript
  const mapId = room.iot_map_id;
  areaInfos.set(index, { roomId: room.id, mapId: mapId, roomName: locationName });
  roomInfos.set(`${room.id}-${room.iot_map_id}`, { areaId: index, mapId: room.iot_map_id, roomName: locationName });
  ```
  - `mapId` is extracted from the API response (`iot_map_id`)
  - Rooms are keyed by `roomId-mapId` pair, enabling multiple maps with overlapping room IDs

### 2. Map Selection Exposure

**Answer: YES**

Evidence:
- **`Q7MessageDispatcher.ts`:** Implements `switchMap()`
  ```typescript
  public async switchMap(duid: string, mapId: number): Promise<void> {
    return this.call(
      dps: this.createDps(Q7RequestMethod.set_cur_map, { map_id: mapId }),
    );
  }
  ```
- **`getRoomMap()` scopes by active map:**
  ```typescript
  public async getRoomMap(duid: string, activeMap: number): Promise<RawRoomMappingData> {
    return this.call(
      dps: this.createDps(Q7RequestMethod.get_room_mapping_backup_1, { map_id: activeMap, prefer_type: 1 }),
    );
  }
  ```

### 3. Per-Map `selectAreas` Scoping

**Answer: YES**

Evidence:
- **`getSupportedAreas.ts` line 118–126:**
  ```typescript
  roomInfos.set(`${room.id}-${room.iot_map_id}`, {
    areaId: index,
    mapId: room.iot_map_id,
    roomName: locationName,
  });
  ```
  Rooms are scoped by both ID and map ID; selecting areas implicitly selects from the current active map's rooms

---

## Gap 1 — "All-Selected Normalization" in Multi-Map Context

### Statement of Gap 1

From `docs/finding/feature-gap.md`:
```typescript
// Reference behavior
if ((data.attributes.supportedAreas as ServiceArea.Area[])?.length === selectedAreas.length) {
  selectedAreas = []; // Force empty if all areas are selected
}
```
When **all supported areas** are selected, normalize to empty array (signals "full clean" vs. "room-specific with all rooms listed").

### Applicability to Current Plugin

**Gap 1 is semantically ambiguous in a multi-map plugin:**

1. **Current behavior:** No normalization; all selected areas are passed as-is to the room-cleaning command.

2. **Multi-map ambiguity:**
   - If user selects all areas from Map A only → should this be normalized to empty (full clean)?
   - Or is a full clean only triggered when "all maps' all areas" are selected (which is rare/impossible for multi-map users)?
   - Or does the Matter controller only see areas from the **active map**, making "all" refer only to the active map?

3. **Reference plugin assumption:** Single flat list → "all areas" is unambiguous.

4. **Current plugin reality:** Rooms are returned with `iot_map_id` already set; `supportedAreas` should reflect only the active map's rooms. Thus "all areas selected" = "all active map's areas selected."

### Open Decision

**Does the current plugin's multi-map design imply that `supportedAreas` is already scoped per-map?**

If YES: Gap 1's normalization should apply to "all areas of the active map," making it relevant even in multi-map scenarios.
If NO: The current plugin exposes a flat union of all maps' areas, in which case Gap 1 becomes ambiguous again.

---

## Recommendations

### 1. For Gap 1 Applicability

Verify in `getSupportedAreas.ts`:
- Does the `supportedAreas` attribute passed to the Matter endpoint include rooms from all maps, or only the active map?
- Check how `currentArea` changes when the user switches maps — does the UI re-fetch and filter to the active map's rooms?

### 2. For Current Plugin

No action required. Multi-map support is already designed and implemented. The reference plugin's lack of multi-map support does not create a gap in the current plugin.

### 3. For Future Multi-Map Users

When/if Gap 1 is addressed:
- Clarify the semantics: "all selected" means "all on active map" or "all across all maps"
- Test the normalization logic (if implemented) with multiple maps to ensure it doesn't cause unexpected full-clean triggering

---

## Summary Table

| Aspect | Reference (xiaomi-roborock) | Current (roborock-vacuum) |
|---|---|---|
| **Stores multiple maps** | NO (mapId: null) | YES (mapId per room, activeMapId tracked) |
| **Exposes map selection** | NO | YES (switchMap API) |
| **selectAreas scoping** | Single flat list | Per-map scoping (roomId-mapId keyed) |
| **Gap 1 applicability** | Direct (single list) | Ambiguous (multi-map semantics unclear) |
| **Complexity to implement Gap 1** | N/A | Requires clarification of multi-map intent |
