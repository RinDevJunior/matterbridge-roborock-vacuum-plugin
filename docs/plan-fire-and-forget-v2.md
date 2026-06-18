# Fire-and-Forget: Detailed Implementation Plan

## Context

Roborock is deprecating the synchronous request-response pattern. `AbstractClient.get()` registers a pending promise via `PendingResponseTracker`, sends a request, and awaits a correlated response (10s timeout). When Roborock drops response support, every `get()` call will time out.

Goal: Replace `get()` with `query()` using `OneShotResponseListener` (registers on the existing push pipeline, resolves on first matching message). Then delete the tracker infrastructure entirely.

---

## Current State (what to understand before editing)

### `client.get()` flow (to be removed)

```
AbstractClient.get(duid, request)
  → responseTracker.waitFor(request, duid)   // registers pending promise keyed by messageId/timestamp
  → sendInternal(duid, request)
  → device push → localClient/mqttClient.onMessage()
      → responseBroadcaster.tryResolve(response)  // resolves the pending promise
      → responseBroadcaster.onMessage(response)   // dispatches to registered listeners
  → pending promise resolves → return result
```

### Key files (current paths)

- `src/roborockCommunication/routing/client.ts` — `Client` interface with `get<T>()`
- `src/roborockCommunication/routing/abstractClient.ts` — `AbstractClient` with `get<T>()` and `responseTracker` field
- `src/roborockCommunication/routing/clientRouter.ts` — `ClientRouter.get<T>()`
- `src/roborockCommunication/routing/listeners/responseBroadcaster.ts` — interface with `tryResolve()`
- `src/roborockCommunication/routing/listeners/responseBroadcasterFactory.ts` — `implements PendingResponseTracker`, has `waitFor()`, `cancelAll()`
- `src/roborockCommunication/routing/listeners/v1ResponseBroadcaster.ts` — `tryResolve()` → `V1PendingResponseTracker`
- `src/roborockCommunication/routing/listeners/b01ResponseBroadcaster.ts` — `tryResolve()` → `B01PendingResponseTracker`
- `src/roborockCommunication/routing/services/pendingResponseTracker.ts` — interface
- `src/roborockCommunication/routing/services/v1PendingResponseTracker.ts` — V1 message-id correlation
- `src/roborockCommunication/routing/services/b01PendingResponseTracker.ts` — B01 timestamp+window collection
- `src/roborockCommunication/local/localClient.ts:221` — `responseBroadcaster.tryResolve(response)` call
- `src/roborockCommunication/mqtt/mqttClient.ts:262` — `responseBroadcaster.tryResolve(response)` call
- `src/roborockCommunication/protocol/dispatcher/V10MessageDispatcher.ts` — all `client.get()` calls
- `src/roborockCommunication/protocol/dispatcher/Q10MessageDispatcher.ts` — `client.get()` in `getNetworkInfo`, `getMapInfo`, `getRoomMap`, `getCustomMessage`
- `src/roborockCommunication/protocol/dispatcher/Q7MessageDispatcher.ts` — `client.get()` in `getMapInfo`, `getRoomMap`, `getCustomMessage`
- `src/roborockCommunication/protocol/dispatcher/abstractMessageDispatcher.ts` — interface

### Template for OneShotResponseListener

`src/roborockCommunication/routing/listeners/implementation/helloResponseListener.ts` — already the one-shot pattern with `waitFor()` returning a promise that resolves on first matching message.

---

## Phase 1 — Trivial conversions (no new infrastructure)

**Goal:** Eliminate all `get()` callers that never used the response.

### 1.1 `V10MessageDispatcher.findMyRobot()` — line 103-105

```typescript
// BEFORE
public async findMyRobot(duid: string): Promise<void> {
  const request = new RequestMessage({ method: 'find_me' });
  await this.client.get(duid, request);
}

// AFTER
public async findMyRobot(duid: string): Promise<void> {
  const request = new RequestMessage({ method: 'find_me' });
  await this.client.send(duid, request);
}
```

### 1.2 `abstractMessageDispatcher.ts` — update `getDeviceStatus` return type

```typescript
// BEFORE (line 10)
getDeviceStatus(duid: string): Promise<DeviceStatus | undefined>;

// AFTER
getDeviceStatus(duid: string): Promise<void>;
```

### 1.3 `V10MessageDispatcher.getDeviceStatus()` — lines 30-40

```typescript
// BEFORE
public async getDeviceStatus(duid: string): Promise<DeviceStatus | undefined> {
  const request = new RequestMessage({ method: 'get_prop', params: ['get_status'] });
  const response = await this.client.get<CloudMessageResult[]>(duid, request);
  if (response) {
    this.logger.debug('Device status: ', debugStringify(response));
    return new DeviceStatus(duid, response[0]);
  }
  return undefined;
}

// AFTER
public async getDeviceStatus(duid: string): Promise<void> {
  const request = new RequestMessage({ method: 'get_prop', params: ['get_status'] });
  await this.client.send(duid, request);
}
```

Also remove `CloudMessageResult` from imports if no longer used.

### 1.4 `Q10MessageDispatcher.getNetworkInfo()` — lines 36-40

```typescript
// BEFORE
public async getNetworkInfo(duid: string): Promise<NetworkInfo | undefined> {
  const request = new RequestMessage({ messageId: this.messageId, dps: { [Q10RequestCode.dps_request]: 1 } });
  const response = await this.client.get(duid, request);
  this.logger.notice(`Get network info: ${debugStringify(response)}`);
  return undefined;
}

// AFTER
public async getNetworkInfo(duid: string): Promise<NetworkInfo | undefined> {
  const request = new RequestMessage({ messageId: this.messageId, dps: { [Q10RequestCode.dps_request]: 1 } });
  await this.client.send(duid, request);
  return undefined;
}
```

Remove `debugStringify` from imports if no longer used.

### 1.5 `Q10MessageDispatcher.getDeviceStatus()` — lines 47-50

```typescript
// BEFORE
public async getDeviceStatus(duid: string): Promise<DeviceStatus | undefined> {
  const request = new RequestMessage({ messageId: this.messageId, dps: { [Q10RequestCode.dps_request]: 1 } });
  await this.client.get(duid, request);
  return undefined;
}

// AFTER
public async getDeviceStatus(duid: string): Promise<void> {
  const request = new RequestMessage({ messageId: this.messageId, dps: { [Q10RequestCode.dps_request]: 1 } });
  await this.client.send(duid, request);
}
```

### 1.6 `Q10MessageDispatcher.getMapInfo()` — lines 58-67

```typescript
// BEFORE
public async getMapInfo(duid: string): Promise<MapInfo> {
  const request = new RequestMessage({ ... });
  const response = await this.client.get<object>(duid, request);
  this.logger.notice(`Get map info response for Q10 device ${duid}: ${response ? debugStringify(response) : 'no response'}`);
  return new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
}

// AFTER
public async getMapInfo(duid: string): Promise<MapInfo> {
  const request = new RequestMessage({ ... });
  await this.client.send(duid, request);
  return new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
}
```

### 1.7 `Q10MessageDispatcher.getRoomMap()` — lines 70-73

```typescript
// BEFORE
public async getRoomMap(duid: string, activeMap: number): Promise<RawRoomMappingData> {
  const request = new RequestMessage({ messageId: this.messageId, dps: { [Q10RequestCode.get_prop]: 1 } });
  const response = await this.client.get<{ room_mapping: RawRoomMappingData }>(duid, request);
  return response?.room_mapping ?? [];
}

// AFTER
public async getRoomMap(duid: string, activeMap: number): Promise<RawRoomMappingData> {
  await this.client.send(duid, new RequestMessage({ messageId: this.messageId, dps: { [Q10RequestCode.get_prop]: 1 } }));
  return [];
}
```

### 1.8 `Q7MessageDispatcher.getMapInfo()` — lines 82-93

```typescript
// BEFORE
public async getMapInfo(duid: string): Promise<MapInfo> {
  const request = new RequestMessage({ ... });
  const response = await this.client.get<object>(duid, request);
  this.logger.notice(`Get map info response for Q7 device ${duid}: ${response ? debugStringify(response) : 'no response'}`);
  return new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
}

// AFTER
public async getMapInfo(duid: string): Promise<MapInfo> {
  await this.client.send(duid, new RequestMessage({ messageId: this.messageId, dps: this.createDps(Q7RequestMethod.get_map_list, {}) }));
  return new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
}
```

### 1.9 `Q7MessageDispatcher.getRoomMap()` — lines 95-106

```typescript
// BEFORE
public async getRoomMap(duid: string, activeMap: number): Promise<RawRoomMappingData> {
  const request = new RequestMessage({ ... });
  const response = (await this.client.get<RawRoomMappingData>(duid, request)) ?? [];
  this.logger.notice(`Get room map response for Q7 device ${duid}: ...`);
  return response;
}

// AFTER
public async getRoomMap(duid: string, activeMap: number): Promise<RawRoomMappingData> {
  await this.client.send(duid, new RequestMessage({
    messageId: this.messageId,
    dps: this.createDps(Q7RequestMethod.get_room_mapping_backup_1, { map_id: activeMap, prefer_type: 1 }),
  }));
  return [];
}
```

---

## Phase 2 — Introduce `OneShotResponseListener` + `client.query()`, migrate V10 data queries

### 2.1 Create `OneShotResponseListener`

**New file:** `src/roborockCommunication/routing/listeners/oneShotResponseListener.ts`

```typescript
import { MESSAGE_TIMEOUT_MS } from '../../../constants/index.js';
import { ResponseMessage } from '../../models/responseMessage.js';
import { AbstractMessageListener } from './abstractMessageListener.js';

export class OneShotResponseListener<T> implements AbstractMessageListener {
  readonly name = 'OneShotResponseListener';

  private resolve?: (value: T) => void;
  private reject?: (error: Error) => void;
  private timer?: NodeJS.Timeout;
  private settled = false;

  constructor(
    public readonly duid: string,
    private readonly parseFn: (msg: ResponseMessage) => T | undefined,
    private readonly timeoutMs: number = MESSAGE_TIMEOUT_MS,
  ) {}

  public waitFor(): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      this.timer = setTimeout(() => {
        if (!this.settled) {
          this.settled = true;
          reject(new Error(`[OneShotResponseListener] Timeout after ${this.timeoutMs}ms for duid: ${this.duid}`));
        }
      }, this.timeoutMs);
    });
  }

  public async onMessage(message: ResponseMessage): Promise<void> {
    if (this.settled) return;
    if (message.duid !== this.duid) return;

    const result = this.parseFn(message);
    if (result === undefined) return;

    this.settled = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer.unref();
    }
    this.resolve?.(result);
  }
}
```

Notes:

- No auto-unregister — after settling, `onMessage` is a no-op (dormant in listeners array)
- Precedent: `helloResponseListener.ts` pattern

### 2.2 Add `query<T>()` to `Client` interface

**File:** `src/roborockCommunication/routing/client.ts`

```typescript
// Add after send():
query<T>(duid: string, request: RequestMessage, parseFn: (msg: ResponseMessage) => T | undefined, timeoutMs?: number): Promise<T | undefined>;
```

Import `ResponseMessage` from `'../models/index.js'`.

### 2.3 Add `query<T>()` to `AbstractClient`

**File:** `src/roborockCommunication/routing/abstractClient.ts`

Add imports:

```typescript
import { OneShotResponseListener } from './listeners/oneShotResponseListener.js';
import { ResponseMessage } from '../models/responseMessage.js';
```

Add method after `send()`:

```typescript
public async query<T>(
  duid: string,
  request: RequestMessage,
  parseFn: (msg: ResponseMessage) => T | undefined,
  timeoutMs?: number,
): Promise<T | undefined> {
  try {
    const listener = new OneShotResponseListener<T>(duid, parseFn, timeoutMs);
    this.responseBroadcaster.register(listener);
    this.sendInternal(duid, request);
    return await listener.waitFor();
  } catch (error) {
    this.logger.error(error instanceof Error ? error.message : String(error));
    return undefined;
  }
}
```

### 2.4 Add `query<T>()` to `ClientRouter`

**File:** `src/roborockCommunication/routing/clientRouter.ts`

Add imports:

```typescript
import { OneShotResponseListener } from './listeners/oneShotResponseListener.js';
import { ResponseMessage } from '../models/index.js';
```

Add method after `send()`:

```typescript
public async query<T>(
  duid: string,
  request: RequestMessage,
  parseFn: (msg: ResponseMessage) => T | undefined,
  timeoutMs?: number,
): Promise<T | undefined> {
  try {
    const listener = new OneShotResponseListener<T>(duid, parseFn, timeoutMs);
    this.broadcasterFactory.register(listener);
    await this.send(duid, request);
    return await listener.waitFor();
  } catch (error) {
    this.logger.error(error instanceof Error ? error.message : String(error));
    return undefined;
  }
}
```

### 2.5 Create `parseV1Result<T>()` helper in `V10MessageDispatcher`

Add at module level (before the class), used by all V10 `parseFn`s:

```typescript
import { DpsPayload, Protocol, ResponseMessage } from '../../models/index.js';

function parseV1Result<T>(msg: ResponseMessage, messageId: number): T | undefined {
  if (!msg.body) return undefined;

  let dps = msg.get(Protocol.rpc_response) as DpsPayload;
  if (!dps) dps = msg.get(Protocol.general_response) as DpsPayload;
  if (!dps) dps = msg.get(Protocol.general_request) as DpsPayload;

  if (!dps || dps.id !== messageId) return undefined;

  const result = dps.result;
  if (!result) return undefined;

  return (Array.isArray(result) ? result[0] : result) as T;
}
```

**Note:** See `V1PendingResponseTracker.tryResolve()` lines 57-82 for the exact extraction pattern — `response.get(Protocol.rpc_response) as DpsPayload`.

### 2.6 Migrate `V10MessageDispatcher.getNetworkInfo()`

```typescript
// BEFORE
public async getNetworkInfo(duid: string): Promise<NetworkInfo | undefined> {
  const request = new RequestMessage({ method: 'get_network_info' });
  return await this.client.get(duid, request);
}

// AFTER
public async getNetworkInfo(duid: string): Promise<NetworkInfo | undefined> {
  const request = new RequestMessage({ method: 'get_network_info' });
  return await this.client.query<NetworkInfo>(
    duid,
    request,
    (msg) => parseV1Result<NetworkInfo>(msg, request.messageId),
  );
}
```

### 2.7 Migrate `V10MessageDispatcher.getSerialNumber()`

```typescript
// BEFORE
public async getSerialNumber(duid: string): Promise<string | undefined> {
  const request = new RequestMessage({ method: 'get_serial_number' });
  const response = await this.client.get<{ serial_number: string }[]>(duid, request);
  return response && response.length > 0 ? response[0].serial_number : duid;
}

// AFTER
public async getSerialNumber(duid: string): Promise<string | undefined> {
  const request = new RequestMessage({ method: 'get_serial_number' });
  const response = await this.client.query<{ serial_number: string }[]>(
    duid,
    request,
    (msg) => {
      // result IS the array — do not take result[0]
      const dps = msg.get(Protocol.rpc_response) as DpsPayload ?? msg.get(Protocol.general_response) as DpsPayload;
      if (!dps || dps.id !== request.messageId) return undefined;
      return dps.result as { serial_number: string }[];
    },
  );
  return response && response.length > 0 ? response[0].serial_number : duid;
}
```

**Note:** `parseV1Result` returns `result[0]` by default. For `getSerialNumber` the whole array is the result — use inline parseFn returning `dps.result` directly.

### 2.8 Migrate `V10MessageDispatcher.getHomeMap()`

```typescript
public async getHomeMap(duid: string): Promise<MapRoomResponse> {
  const request = new RequestMessage({ method: 'get_map_v1', secure: true });
  const response = await this.client.query<MapRoomResponse>(
    duid,
    request,
    (msg) => parseV1Result<MapRoomResponse>(msg, request.messageId),
  );
  return response ?? {};
}
```

### 2.9 Migrate `V10MessageDispatcher.getMapInfo()`

```typescript
public async getMapInfo(duid: string): Promise<MapInfo> {
  const request = new RequestMessage({ method: 'get_multi_maps_list' });
  const response = await this.client.query<MultipleMapDto>(
    duid,
    request,
    (msg) => parseV1Result<MultipleMapDto>(msg, request.messageId),
  );
  return new MapInfo(
    response ?? { max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] },
  );
}
```

**Note:** Current code takes `response[0]` from `MultipleMapDto[]`. `parseV1Result` already returns `result[0]`, so the type is `MultipleMapDto` (not `MultipleMapDto[]`).

### 2.10 Migrate `V10MessageDispatcher.getRoomMap()`

```typescript
public async getRoomMap(duid: string, activeMap: number): Promise<RawRoomMappingData> {
  const request = new RequestMessage({ method: 'get_room_mapping' });
  const response = await this.client.query<RawRoomMappingData>(
    duid,
    request,
    (msg) => {
      const dps = msg.get(Protocol.rpc_response) as DpsPayload ?? msg.get(Protocol.general_response) as DpsPayload;
      if (!dps || dps.id !== request.messageId) return undefined;
      return dps.result as RawRoomMappingData;
    },
  );
  return response ?? [];
}
```

### 2.11 Migrate `V10MessageDispatcher.getCustomMessage<T>()`

```typescript
// BEFORE
public getCustomMessage<T = unknown>(duid: string, def: RequestMessage): Promise<T> {
  return this.client.get(duid, def) as Promise<T>;
}

// AFTER
public async getCustomMessage<T = unknown>(duid: string, def: RequestMessage): Promise<T> {
  const result = await this.client.query<T>(
    duid,
    def,
    (msg) => parseV1Result<T>(msg, def.messageId),
  );
  return result as T;
}
```

### 2.12 `V10MessageDispatcher.getCleanModeData()` — no change needed

Calls `this.getCustomMessage()` which is already migrated in 2.11. No direct edits required.

### 2.13 Fix `V10MessageDispatcher.changeCleanMode()` read-before-write

```typescript
// BEFORE (lines 157-169) — reads current mode before writing
const currentMopMode = await this.getCustomMessage<number>(duid, new RequestMessage({ method: 'get_custom_mode' }));
const smartMopMode = VacuumSuctionPower.Smart;
const smartMopRoute = MopRoute.Smart;
const customMopMode = VacuumSuctionPower.Custom;
const customMopRoute = MopRoute.Custom;

if (currentMopMode == smartMopMode && mopRoute == smartMopRoute) return;
if (currentMopMode == customMopMode && mopRoute == customMopRoute) return;

if (currentMopMode == smartMopMode) {
  await this.client.send(duid, new RequestMessage({ method: 'set_mop_mode', params: [customMopRoute] }));
}

// AFTER — unconditional exit-smart-mode send (no-op on device if already custom)
const smartMopRoute = MopRoute.Smart;
const customMopRoute = MopRoute.Custom;

if (mopRoute && mopRoute !== smartMopRoute) {
  await this.client.send(duid, new RequestMessage({ method: 'set_mop_mode', params: [customMopRoute] }));
}
```

Remove `VacuumSuctionPower` import if no longer used elsewhere. Keep the rest of `changeCleanMode()` unchanged.

### 2.14 Migrate `Q10MessageDispatcher.getCustomMessage<T>()`

```typescript
// BEFORE
public async getCustomMessage<T = unknown>(duid: string, def: RequestMessage): Promise<T> {
  const request = new RequestMessage({ ...def, messageId: this.messageId });
  return this.client.get(duid, request) as Promise<T>;
}

// AFTER
public async getCustomMessage<T = unknown>(duid: string, def: RequestMessage): Promise<T> {
  const request = new RequestMessage({ ...def, messageId: this.messageId });
  const result = await this.client.query<T>(duid, request, (msg) => {
    if (!msg.body) return undefined;
    const data = msg.body.data;
    if (!data) return undefined;
    const values = Object.values(data);
    return values.length > 0 ? (values[0] as T) : undefined;
  });
  return result as T;
}
```

**Note:** Verify this parseFn against actual B01 push message structure. See `B01PendingResponseTracker.mergeData()` / `mapDataKeys()` for the pushed data shape.

### 2.15 Migrate `Q7MessageDispatcher.getCustomMessage<T>()`

```typescript
// BEFORE
public async getCustomMessage<T = unknown>(duid: string, def: RequestMessage): Promise<T> {
  const request = new RequestMessage({ ...def, messageId: this.messageId });
  return this.client.get(duid, request) as Promise<T>;
}

// AFTER
public async getCustomMessage<T = unknown>(duid: string, def: RequestMessage): Promise<T> {
  const request = new RequestMessage({ ...def, messageId: this.messageId });
  const result = await this.client.query<T>(duid, request, (msg) => {
    if (!msg.body) return undefined;
    const data = msg.body.data;
    if (!data) return undefined;
    const values = Object.values(data);
    return values.length > 0 ? (values[0] as T) : undefined;
  });
  return result as T;
}
```

---

## Phase 3 — Delete tracker infrastructure

### 3.1 Remove `get<T>()` from `Client` interface

**File:** `src/roborockCommunication/routing/client.ts`

- Delete: `get<T>(duid: string, request: RequestMessage): Promise<T | undefined>;`

### 3.2 Remove `get<T>()` and `responseTracker` from `AbstractClient`

**File:** `src/roborockCommunication/routing/abstractClient.ts`

- Delete `private readonly responseTracker: PendingResponseTracker` constructor param (line 30)
- Delete `import { PendingResponseTracker } from './services/pendingResponseTracker.js';` (line 13)
- Delete `public async get<T>()` method (lines 81-92)

### 3.3 Remove `get<T>()` from `ClientRouter`

**File:** `src/roborockCommunication/routing/clientRouter.ts`

- Delete `public async get<T>()` method (lines 103-109)

### 3.4 Remove `tryResolve()` from `ResponseBroadcaster` interface

**File:** `src/roborockCommunication/routing/listeners/responseBroadcaster.ts`

- Delete: `tryResolve(response: ResponseMessage): void;`

### 3.5 Remove tracker from `V1ResponseBroadcaster`

**File:** `src/roborockCommunication/routing/listeners/v1ResponseBroadcaster.ts`

- Delete `private readonly tracker: V1PendingResponseTracker` constructor param
- Delete `import { V1PendingResponseTracker }` import
- Delete `public tryResolve()` method (lines 27-29)
- Update `unregister()`: remove `this.tracker.cancelAll()` — just `this.listeners = []`

### 3.6 Remove tracker from `B01ResponseBroadcaster`

**File:** `src/roborockCommunication/routing/listeners/b01ResponseBroadcaster.ts`

- Delete `private readonly tracker: B01PendingResponseTracker` constructor param
- Delete `import { B01PendingResponseTracker }` import
- Delete `public waitFor()` method (lines 27-29)
- Delete `public tryResolve()` method (lines 31-33)
- Update `unregister()`: remove tracker call — just `this.listeners = []`

### 3.7 Simplify `ResponseBroadcasterFactory`

**File:** `src/roborockCommunication/routing/listeners/responseBroadcasterFactory.ts`

- Remove `implements PendingResponseTracker` from class declaration
- Delete `private readonly v1Tracker` and `private readonly b01Tracker` fields
- Delete imports: `B01PendingResponseTracker`, `V1PendingResponseTracker`, `PendingResponseTracker`, `RequestMessage`
- Delete methods: `tryResolve()`, `waitFor()`, `cancelAll()`, `getTrackerForDevice()`
- Update constructor: remove tracker instantiation (lines 26-27), remove tracker args from broadcaster construction (lines 28-29)
- Keep `getBroadcasterForResponse()` — still used by `onMessage()` (line 48)

### 3.8 Remove `tryResolve()` call from `localClient.ts`

**File:** `src/roborockCommunication/local/localClient.ts`

- Delete line 221: `this.responseBroadcaster.tryResolve(response);`
- Remove `PendingResponseTracker` import (line 13)
- Remove `responseTracker: PendingResponseTracker` constructor param (line 34)
- Update `super()` call to remove tracker arg (line 36)

### 3.9 Remove `tryResolve()` call from `mqttClient.ts`

**File:** `src/roborockCommunication/mqtt/mqttClient.ts`

- Delete line 262: `this.responseBroadcaster.tryResolve(response);`
- Remove `PendingResponseTracker` import (line 9)
- Remove `responseTracker: PendingResponseTracker` constructor param (line 29)
- Update `super()` call to remove tracker arg (line 31)

### 3.10 Update `ClientRouter` client construction

**File:** `src/roborockCommunication/routing/clientRouter.ts`

- `MQTTClient` constructor call (line 28): remove `this.broadcasterFactory` as 5th arg
- `LocalNetworkClient` constructor call (lines 43-49): remove `this.broadcasterFactory` as 6th arg

### 3.11 Delete tracker files

- `src/roborockCommunication/routing/services/pendingResponseTracker.ts`
- `src/roborockCommunication/routing/services/v1PendingResponseTracker.ts`
- `src/roborockCommunication/routing/services/b01PendingResponseTracker.ts`

---

## Phase 3 — Test Updates

### 3.12 Delete test files

- `src/tests/roborockCommunication/routing/services/v1PendingResponseTracker.test.ts`
- `src/tests/roborockCommunication/routing/services/b01PendingResponseTracker.test.ts`

### 3.13 Update `responseBroadcasterFactory.test.ts`

**File:** `src/tests/roborockCommunication/routing/listeners/responseBroadcasterFactory.test.ts`

Remove these test cases (lines 102-226):

- `'should route tryResolve to V1 broadcaster for V1 responses'`
- `'should route tryResolve to B01 broadcaster for B01 responses'`
- `'should route waitFor to V1 tracker for V1 devices'`
- `'should route waitFor to B01 tracker for B01 devices'`
- `'should cancelAll pending requests from B01 tracker'`
- `'should fall back to V1 tracker when protocol version is not B01'`

Remove `RequestMessage` import if no longer needed.

### 3.14 Update `v1ResponseBroadcaster.test.ts`

**File:** `src/tests/roborockCommunication/routing/listeners/v1ResponseBroadcaster.test.ts`

- Remove `V1PendingResponseTracker` from imports and `beforeEach`
- Remove any `tryResolve` test cases
- Update broadcaster construction: `new V1ResponseBroadcaster(logger)` (no tracker param)

### 3.15 Update `b01ResponseBroadcaster.test.ts`

**File:** `src/tests/roborockCommunication/routing/listeners/b01ResponseBroadcaster.test.ts`

- Remove `B01PendingResponseTracker` from imports and `beforeEach`
- Remove `tryResolve`, `waitFor` test cases
- Update broadcaster construction: `new B01ResponseBroadcaster(logger)` (no tracker param)

### 3.16 Create `oneShotResponseListener.test.ts`

**New file:** `src/tests/roborockCommunication/routing/listeners/oneShotResponseListener.test.ts`

Four test cases:

1. **resolves when parseFn returns a value** — create listener, call `onMessage()` with matching msg, assert `waitFor()` resolves with parsed value
2. **ignores messages where parseFn returns undefined** — parseFn returns `undefined`, assert listener stays pending
3. **rejects on timeout** — use `vi.useFakeTimers()`, advance past `MESSAGE_TIMEOUT_MS`, assert `waitFor()` rejects with timeout error
4. **is a no-op after settling** — resolve once, call `onMessage()` again, assert parseFn called only once / no double-resolve

---

## Critical Dependency Order

Execute in this sequence — each step must type-check before the next:

1. **Phase 1** (1.1–1.9): `get()` → `send()` conversions + `getDeviceStatus` return type
2. **Phase 2** (2.1): create `OneShotResponseListener`
3. **Phase 2** (2.2–2.4): add `query()` to `Client`, `AbstractClient`, `ClientRouter`
4. **Phase 2** (2.5–2.15): migrate all remaining `get()` callers in dispatchers
5. **Phase 3** (3.1–3.11): remove tracker infrastructure
6. **Phase 3** (3.12–3.16): test file updates

Verify after each phase: `npm run type-check`

---

## Files Changed Summary

| File                                                         | Action                                                                              | Phase |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ----- |
| `routing/client.ts`                                          | Add `query<T>()`, remove `get<T>()`                                                 | 2+3   |
| `routing/abstractClient.ts`                                  | Add `query()`, remove `get()` + `responseTracker`                                   | 2+3   |
| `routing/clientRouter.ts`                                    | Add `query()`, remove `get<T>()`, update client construction                        | 2+3   |
| `routing/listeners/oneShotResponseListener.ts`               | **CREATE**                                                                          | 2     |
| `routing/listeners/responseBroadcaster.ts`                   | Remove `tryResolve()`                                                               | 3     |
| `routing/listeners/responseBroadcasterFactory.ts`            | Remove tracker/waitFor/cancelAll/implements                                         | 3     |
| `routing/listeners/v1ResponseBroadcaster.ts`                 | Remove `tryResolve()`, tracker field                                                | 3     |
| `routing/listeners/b01ResponseBroadcaster.ts`                | Remove `tryResolve()`, `waitFor()`, tracker field                                   | 3     |
| `routing/services/pendingResponseTracker.ts`                 | **DELETE**                                                                          | 3     |
| `routing/services/v1PendingResponseTracker.ts`               | **DELETE**                                                                          | 3     |
| `routing/services/b01PendingResponseTracker.ts`              | **DELETE**                                                                          | 3     |
| `local/localClient.ts`                                       | Remove `tryResolve` call, remove tracker param                                      | 3     |
| `mqtt/mqttClient.ts`                                         | Remove `tryResolve` call, remove tracker param                                      | 3     |
| `protocol/dispatcher/abstractMessageDispatcher.ts`           | `getDeviceStatus()` → `Promise<void>`                                               | 1     |
| `protocol/dispatcher/V10MessageDispatcher.ts`                | findMyRobot→send, getDeviceStatus→send, all query() migrations, changeCleanMode fix | 1+2   |
| `protocol/dispatcher/Q10MessageDispatcher.ts`                | getNetworkInfo/getDeviceStatus/getMapInfo/getRoomMap→send, getCustomMessage→query   | 1+2   |
| `protocol/dispatcher/Q7MessageDispatcher.ts`                 | getMapInfo/getRoomMap→send+[], getCustomMessage→query                               | 1+2   |
| `tests/routing/listeners/responseBroadcasterFactory.test.ts` | Remove tracker test cases                                                           | 3     |
| `tests/routing/listeners/v1ResponseBroadcaster.test.ts`      | Remove tryResolve tests, update construction                                        | 3     |
| `tests/routing/listeners/b01ResponseBroadcaster.test.ts`     | Remove tryResolve/waitFor tests, update construction                                | 3     |
| `tests/routing/services/v1PendingResponseTracker.test.ts`    | **DELETE**                                                                          | 3     |
| `tests/routing/services/b01PendingResponseTracker.test.ts`   | **DELETE**                                                                          | 3     |
| `tests/routing/listeners/oneShotResponseListener.test.ts`    | **CREATE** (4 test cases)                                                           | 3     |

All paths relative to `src/roborockCommunication/`.

---

## Implementation Notes

1. **`parseV1Result` return shape**: Returns `result[0]` for single-item arrays (standard V1). For `getSerialNumber` the whole array is the result — use inline parseFn returning `dps.result` directly.

2. **`ResponseMessage.get(Protocol.xxx)`**: See `V1PendingResponseTracker.tryResolve()` lines 57-82 for the exact extraction pattern.

3. **`ResponseBroadcasterFactory.getBroadcasterForResponse()`**: Currently called by both `tryResolve()` and `onMessage()`. After removing `tryResolve()`, keep this method — `onMessage()` still uses it.

4. **`debugStringify` import cleanup**: Q10 and Q7 dispatchers import `debugStringify` only for removed log lines. Remove if nothing else uses it.

5. **B01 parseFn**: The Q10/Q7 `getCustomMessage` parseFn is a best estimate. Verify against actual B01 push message format by inspecting `B01PendingResponseTracker.mergeData()` / `mapDataKeys()`.
