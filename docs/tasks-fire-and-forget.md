# Fire-and-Forget: Task Breakdown

Reference: `docs/plan-fire-and-forget-v2.md`

---

## Phase 1 — Trivial send() conversions

### Task 1.1 — Convert `findMyRobot` from `get()` to `send()`

**File:** `src/roborockCommunication/protocol/dispatcher/V10MessageDispatcher.ts` line 103

**Change:** `await this.client.get(duid, request)` → `await this.client.send(duid, request)`

**Definition of Done:**

- [x] `findMyRobot()` calls `client.send()` not `client.get()`
- [x] `npm run type-check` exits 0

---

### Task 1.2 — Update `getDeviceStatus` interface return type to `void`

**File:** `src/roborockCommunication/protocol/dispatcher/abstractMessageDispatcher.ts` line 10

**Change:** `Promise<DeviceStatus | undefined>` → `Promise<void>`

**Definition of Done:**

- [x] Interface signature is `getDeviceStatus(duid: string): Promise<void>`
- [x] `npm run type-check` exits 0 (all implementations must also be updated in same step if TS complains)

---

### Task 1.3 — Convert `V10.getDeviceStatus()` from `get()` to `send()`

**File:** `src/roborockCommunication/protocol/dispatcher/V10MessageDispatcher.ts` lines 30-40

**Change:** Remove response handling, call `client.send()`, return `void`

**Definition of Done:**

- [x] Method signature is `Promise<void>`
- [x] Calls `client.send()` not `client.get()`
- [x] `CloudMessageResult` import removed if unused
- [x] `debugStringify` import removed if unused
- [x] `npm run type-check` exits 0

---

### Task 1.4 — Convert `Q10.getNetworkInfo()` from `get()` to `send()`

**File:** `src/roborockCommunication/protocol/dispatcher/Q10MessageDispatcher.ts` lines 36-40

**Change:** Replace `client.get()` + response log with `client.send()`

**Definition of Done:**

- [x] Calls `client.send()` not `client.get()`
- [x] Response log line removed
- [x] `debugStringify` import removed if unused
- [x] `npm run type-check` exits 0

---

### Task 1.5 — Convert `Q10.getDeviceStatus()` from `get()` to `send()`

**File:** `src/roborockCommunication/protocol/dispatcher/Q10MessageDispatcher.ts` lines 47-50

**Change:** `client.get()` → `client.send()`, return type `Promise<void>`

**Definition of Done:**

- [x] Method signature is `Promise<void>`
- [x] Calls `client.send()` not `client.get()`
- [x] `npm run type-check` exits 0

---

### Task 1.6 — Convert `Q10.getMapInfo()` from `get()` to `send()`

**File:** `src/roborockCommunication/protocol/dispatcher/Q10MessageDispatcher.ts` lines 58-67

**Change:** `client.get()` → `client.send()`, remove response/log, return stub

**Definition of Done:**

- [x] Calls `client.send()` not `client.get()`
- [x] Response variable and log line removed
- [x] Returns `new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] })`
- [x] `npm run type-check` exits 0

---

### Task 1.7 — Convert `Q10.getRoomMap()` from `get()` to `send()`

**File:** `src/roborockCommunication/protocol/dispatcher/Q10MessageDispatcher.ts` lines 70-73

**Change:** `client.get()` → `client.send()`, return `[]`

**Definition of Done:**

- [x] Calls `client.send()` not `client.get()`
- [x] Returns `[]`
- [x] `npm run type-check` exits 0

---

### Task 1.8 — Convert `Q7.getMapInfo()` from `get()` to `send()`

**File:** `src/roborockCommunication/protocol/dispatcher/Q7MessageDispatcher.ts` lines 82-93

**Change:** `client.get()` → `client.send()`, remove response/log, return stub

**Definition of Done:**

- [x] Calls `client.send()` not `client.get()`
- [x] Response variable and log line removed
- [x] Returns `new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] })`
- [x] `npm run type-check` exits 0

---

### Task 1.9 — Convert `Q7.getRoomMap()` from `get()` to `send()`

**File:** `src/roborockCommunication/protocol/dispatcher/Q7MessageDispatcher.ts` lines 95-106

**Change:** `client.get()` → `client.send()`, remove response/log, return `[]`

**Definition of Done:**

- [x] Calls `client.send()` not `client.get()`
- [x] Response variable and log line removed
- [x] Returns `[]`
- [x] `npm run type-check` exits 0

---

### Phase 1 Gate

- [x] All tasks 1.1–1.9 complete
- [x] `npm run type-check` exits 0
- [x] `npm test` passes

---

## Phase 2 — Introduce OneShotResponseListener + query()

### Task 2.1 — Create `OneShotResponseListener`

**New file:** `src/roborockCommunication/routing/listeners/oneShotResponseListener.ts`

**Definition of Done:**

- [x] File exists at the path above
- [x] Implements `AbstractMessageListener` (`name`, `duid`, `onMessage()`)
- [x] Has `waitFor(): Promise<T>` that resolves on first parseFn match, rejects on timeout
- [x] Has `settled` flag — `onMessage()` is no-op after resolving or rejecting
- [x] Timeout default is `MESSAGE_TIMEOUT_MS` from `src/constants/index.js`
- [x] `npm run type-check` exits 0

---

### Task 2.2 — Add `query<T>()` to `Client` interface

**File:** `src/roborockCommunication/routing/client.ts`

**Definition of Done:**

- [x] `query<T>(duid, request, parseFn, timeoutMs?)` method signature present in interface
- [x] `ResponseMessage` imported from `'../models/index.js'`
- [x] `npm run type-check` exits 0

---

### Task 2.3 — Add `query<T>()` to `AbstractClient`

**File:** `src/roborockCommunication/routing/abstractClient.ts`

**Definition of Done:**

- [x] `public async query<T>()` method implemented
- [x] Creates `OneShotResponseListener`, registers on `responseBroadcaster`, calls `sendInternal()`, awaits `waitFor()`
- [x] Errors caught and logged, returns `undefined` on failure
- [x] `OneShotResponseListener` imported
- [x] `npm run type-check` exits 0

---

### Task 2.4 — Add `query<T>()` to `ClientRouter`

**File:** `src/roborockCommunication/routing/clientRouter.ts`

**Definition of Done:**

- [x] `public async query<T>()` method implemented
- [x] Creates `OneShotResponseListener`, registers on `broadcasterFactory`, calls `send()`, awaits `waitFor()`
- [x] Errors caught and logged, returns `undefined` on failure
- [x] `OneShotResponseListener` imported
- [x] `npm run type-check` exits 0

---

### Task 2.5 — Add `parseV1Result<T>()` module-level helper to `V10MessageDispatcher`

**File:** `src/roborockCommunication/protocol/dispatcher/V10MessageDispatcher.ts`

**Definition of Done:**

- [x] `parseV1Result<T>(msg, messageId)` function exists at module level (before the class)
- [x] Tries `Protocol.rpc_response`, then `Protocol.general_response`, then `Protocol.general_request`
- [x] Returns `undefined` if no matching DPS or `dps.id !== messageId`
- [x] Returns `result[0]` for arrays, `result` for non-arrays
- [x] `DpsPayload`, `Protocol`, `ResponseMessage` imported as needed
- [x] `npm run type-check` exits 0

---

### Task 2.6 — Migrate `V10.getNetworkInfo()` to `query()`

**File:** `src/roborockCommunication/protocol/dispatcher/V10MessageDispatcher.ts`

**Definition of Done:**

- [x] Calls `client.query<NetworkInfo>()` with `parseV1Result` parseFn
- [x] No `client.get()` call remains
- [x] `npm run type-check` exits 0

---

### Task 2.7 — Migrate `V10.getSerialNumber()` to `query()`

**File:** `src/roborockCommunication/protocol/dispatcher/V10MessageDispatcher.ts`

**Definition of Done:**

- [x] Calls `client.query<{ serial_number: string }[]>()` with inline parseFn returning `dps.result` (not `result[0]`)
- [x] No `client.get()` call remains
- [x] Return logic (`response[0].serial_number ?? duid`) preserved
- [x] `npm run type-check` exits 0

---

### Task 2.8 — Migrate `V10.getHomeMap()` to `query()`

**File:** `src/roborockCommunication/protocol/dispatcher/V10MessageDispatcher.ts`

**Definition of Done:**

- [x] Calls `client.query<MapRoomResponse>()` with `parseV1Result` parseFn
- [x] Returns `response ?? {}`
- [x] No `client.get()` call remains
- [x] `npm run type-check` exits 0

---

### Task 2.9 — Migrate `V10.getMapInfo()` to `query()`

**File:** `src/roborockCommunication/protocol/dispatcher/V10MessageDispatcher.ts`

**Definition of Done:**

- [x] Calls `client.query<MultipleMapDto>()` (not `MultipleMapDto[]`) with `parseV1Result` parseFn
- [x] Passes `response` directly to `new MapInfo()` (not `response[0]` — `parseV1Result` already unwraps it)
- [x] Fallback to empty `MapInfo` on `undefined`
- [x] No `client.get()` call remains
- [x] `npm run type-check` exits 0

---

### Task 2.10 — Migrate `V10.getRoomMap()` to `query()`

**File:** `src/roborockCommunication/protocol/dispatcher/V10MessageDispatcher.ts`

**Definition of Done:**

- [x] Calls `client.query<RawRoomMappingData>()` with inline parseFn (`dps.result` directly)
- [x] Returns `response ?? []`
- [x] No `client.get()` call remains
- [x] `npm run type-check` exits 0

---

### Task 2.11 — Migrate `V10.getCustomMessage()` to `query()`

**File:** `src/roborockCommunication/protocol/dispatcher/V10MessageDispatcher.ts`

**Definition of Done:**

- [x] Calls `client.query<T>()` with `parseV1Result` parseFn using `def.messageId`
- [x] Returns `result as T`
- [x] Method is now `async`
- [x] No `client.get()` call remains
- [x] `npm run type-check` exits 0

---

### Task 2.12 — Fix `V10.changeCleanMode()` read-before-write guard

**File:** `src/roborockCommunication/protocol/dispatcher/V10MessageDispatcher.ts`

**Definition of Done:**

- [x] `getCustomMessage('get_custom_mode')` read removed
- [x] `currentMopMode`, `smartMopMode`, `customMopMode`, `customMopMode` variables removed
- [x] Guard replaced with: `if (mopRoute && mopRoute !== smartMopRoute) { send set_mop_mode(customMopRoute) }`
- [x] Remaining sends (`set_custom_mode`, `set_water_box_custom_mode`, `set_mop_mode`) unchanged
- [x] `VacuumSuctionPower` import removed if no longer used
- [x] `npm run type-check` exits 0

---

### Task 2.13 — Migrate `Q10.getCustomMessage()` to `query()`

**File:** `src/roborockCommunication/protocol/dispatcher/Q10MessageDispatcher.ts`

**Definition of Done:**

- [x] Calls `client.query<T>()` with B01 parseFn (extract `Object.values(msg.body.data)[0]`)
- [x] Returns `result as T`
- [x] No `client.get()` call remains
- [x] `npm run type-check` exits 0

---

### Task 2.14 — Migrate `Q7.getCustomMessage()` to `query()`

**File:** `src/roborockCommunication/protocol/dispatcher/Q7MessageDispatcher.ts`

**Definition of Done:**

- [x] Calls `client.query<T>()` with B01 parseFn (same pattern as Q10)
- [x] Returns `result as T`
- [x] No `client.get()` call remains
- [x] `npm run type-check` exits 0

---

### Phase 2 Gate

- [x] All tasks 2.1–2.14 complete
- [x] Zero `client.get()` calls remain in any dispatcher (`grep -r "client\.get(" src/`)
- [x] `npm run type-check` exits 0
- [x] `npm test` passes

---

## Phase 3 — Delete tracker infrastructure

### Task 3.1 — Remove `get<T>()` from `Client` interface

**File:** `src/roborockCommunication/routing/client.ts`

**Definition of Done:**

- [x] `get<T>()` line deleted from interface
- [x] `npm run type-check` exits 0

---

### Task 3.2 — Remove `get<T>()` and `responseTracker` from `AbstractClient`

**File:** `src/roborockCommunication/routing/abstractClient.ts`

**Definition of Done:**

- [x] `responseTracker: PendingResponseTracker` constructor param removed (line 30)
- [x] `PendingResponseTracker` import removed (line 13)
- [x] `public async get<T>()` method deleted (lines 81-92)
- [x] `npm run type-check` exits 0

---

### Task 3.3 — Remove `get<T>()` from `ClientRouter`

**File:** `src/roborockCommunication/routing/clientRouter.ts`

**Definition of Done:**

- [x] `public async get<T>()` method deleted (lines 103-109)
- [x] `npm run type-check` exits 0

---

### Task 3.4 — Remove `tryResolve()` from `ResponseBroadcaster` interface

**File:** `src/roborockCommunication/routing/listeners/responseBroadcaster.ts`

**Definition of Done:**

- [x] `tryResolve(response: ResponseMessage): void;` line deleted
- [x] `npm run type-check` exits 0

---

### Task 3.5 — Remove tracker from `V1ResponseBroadcaster`

**File:** `src/roborockCommunication/routing/listeners/v1ResponseBroadcaster.ts`

**Definition of Done:**

- [x] `tracker: V1PendingResponseTracker` constructor param removed
- [x] `V1PendingResponseTracker` import removed
- [x] `tryResolve()` method deleted
- [x] `unregister()` simplified to `this.listeners = []`
- [x] `npm run type-check` exits 0

---

### Task 3.6 — Remove tracker from `B01ResponseBroadcaster`

**File:** `src/roborockCommunication/routing/listeners/b01ResponseBroadcaster.ts`

**Definition of Done:**

- [x] `tracker: B01PendingResponseTracker` constructor param removed
- [x] `B01PendingResponseTracker` import removed
- [x] `waitFor()` method deleted
- [x] `tryResolve()` method deleted
- [x] `unregister()` simplified to `this.listeners = []`
- [x] `npm run type-check` exits 0

---

### Task 3.7 — Simplify `ResponseBroadcasterFactory`

**File:** `src/roborockCommunication/routing/listeners/responseBroadcasterFactory.ts`

**Definition of Done:**

- [x] `implements PendingResponseTracker` removed from class declaration
- [x] `v1Tracker` and `b01Tracker` fields deleted
- [x] Tracker imports (`B01PendingResponseTracker`, `V1PendingResponseTracker`, `PendingResponseTracker`) deleted
- [x] `RequestMessage` import removed if unused
- [x] `tryResolve()`, `waitFor()`, `cancelAll()`, `getTrackerForDevice()` methods deleted
- [x] Constructor updated: tracker instantiation removed, broadcaster construction updated (no tracker args)
- [x] `getBroadcasterForResponse()` kept (still used by `onMessage()`)
- [x] `npm run type-check` exits 0

---

### Task 3.8 — Remove `tryResolve()` from `LocalNetworkClient`

**File:** `src/roborockCommunication/local/localClient.ts`

**Definition of Done:**

- [x] `this.responseBroadcaster.tryResolve(response)` line deleted (line ~221)
- [x] `PendingResponseTracker` import removed (line 13)
- [x] `responseTracker: PendingResponseTracker` constructor param removed (line 34)
- [x] `super()` call updated to remove tracker arg (line 36)
- [x] `npm run type-check` exits 0

---

### Task 3.9 — Remove `tryResolve()` from `MQTTClient`

**File:** `src/roborockCommunication/mqtt/mqttClient.ts`

**Definition of Done:**

- [x] `this.responseBroadcaster.tryResolve(response)` line deleted (line ~262)
- [x] `PendingResponseTracker` import removed (line 9)
- [x] `responseTracker: PendingResponseTracker` constructor param removed (line 29)
- [x] `super()` call updated to remove tracker arg (line 31)
- [x] `npm run type-check` exits 0

---

### Task 3.10 — Update `ClientRouter` client construction

**File:** `src/roborockCommunication/routing/clientRouter.ts`

**Definition of Done:**

- [x] `MQTTClient` construction (line 28) removes `this.broadcasterFactory` as 5th arg (responseTracker)
- [x] `LocalNetworkClient` construction (lines 43-49) removes `this.broadcasterFactory` as 6th arg (responseTracker)
- [x] `npm run type-check` exits 0

---

### Task 3.11 — Delete tracker source files

**Files to delete:**

- `src/roborockCommunication/routing/services/pendingResponseTracker.ts`
- `src/roborockCommunication/routing/services/v1PendingResponseTracker.ts`
- `src/roborockCommunication/routing/services/b01PendingResponseTracker.ts`

**Definition of Done:**

- [x] All three files deleted from disk
- [x] No remaining imports of these files anywhere (`grep -r "pendingResponseTracker\|v1PendingResponseTracker\|b01PendingResponseTracker" src/`)
- [x] `npm run type-check` exits 0

---

### Task 3.12 — Delete tracker test files

**Files to delete:**

- `src/tests/roborockCommunication/routing/services/v1PendingResponseTracker.test.ts`
- `src/tests/roborockCommunication/routing/services/b01PendingResponseTracker.test.ts`

**Definition of Done:**

- [x] Both test files deleted from disk
- [x] `npm test` passes

---

### Task 3.13 — Update `responseBroadcasterFactory.test.ts`

**File:** `src/tests/roborockCommunication/routing/listeners/responseBroadcasterFactory.test.ts`

**Remove test cases:**

- `'should route tryResolve to V1 broadcaster for V1 responses'`
- `'should route tryResolve to B01 broadcaster for B01 responses'`
- `'should route waitFor to V1 tracker for V1 devices'`
- `'should route waitFor to B01 tracker for B01 devices'`
- `'should cancelAll pending requests from B01 tracker'`
- `'should fall back to V1 tracker when protocol version is not B01'`

**Definition of Done:**

- [x] All 6 test cases above removed
- [x] `RequestMessage` import removed if unused
- [x] Remaining tests pass: `npm test`

---

### Task 3.14 — Update `v1ResponseBroadcaster.test.ts`

**File:** `src/tests/roborockCommunication/routing/listeners/v1ResponseBroadcaster.test.ts`

**Definition of Done:**

- [x] `V1PendingResponseTracker` removed from imports and `beforeEach`
- [x] Any `tryResolve` test cases removed
- [x] Broadcaster construction updated: `new V1ResponseBroadcaster(logger)` (no tracker param)
- [x] `npm test` passes

---

### Task 3.15 — Update `b01ResponseBroadcaster.test.ts`

**File:** `src/tests/roborockCommunication/routing/listeners/b01ResponseBroadcaster.test.ts`

**Definition of Done:**

- [x] `B01PendingResponseTracker` removed from imports and `beforeEach`
- [x] `tryResolve` and `waitFor` test cases removed
- [x] Broadcaster construction updated: `new B01ResponseBroadcaster(logger)` (no tracker param)
- [x] `npm test` passes

---

### Task 3.16 — Create `oneShotResponseListener.test.ts`

**New file:** `src/tests/roborockCommunication/routing/listeners/oneShotResponseListener.test.ts`

**Required test cases:**

1. `should resolve when parseFn returns a value`
2. `should ignore messages where parseFn returns undefined`
3. `should reject on timeout`
4. `should be a no-op after settling`

**Definition of Done:**

- [x] All 4 test cases implemented using `vitest`
- [x] Fake timers used for timeout test (`vi.useFakeTimers()` / `vi.useRealTimers()`)
- [x] No `client.get()` or tracker references
- [x] `npm test` passes

---

### Phase 3 Gate

- [x] All tasks 3.1–3.16 complete
- [x] Zero references to `PendingResponseTracker`, `tryResolve`, `waitFor`, `cancelAll` in non-test src (`grep -r "tryResolve\|PendingResponseTracker" src/ --include="*.ts" --exclude="*.test.ts"`)
- [x] `npm run type-check` exits 0
- [x] `npm test` passes
