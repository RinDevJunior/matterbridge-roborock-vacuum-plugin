# Fire-and-Forget Command Architecture

## Context

Roborock is deprecating the synchronous request-response pattern. Currently, data queries (`getNetworkInfo`, `getSerialNumber`, `getHomeMap`, `getMapInfo`, `getRoomMap`, `getCleanModeData`, `getCustomMessage`) use `AbstractClient.get()` — which registers a pending promise in `V1PendingResponseTracker` / `B01PendingResponseTracker`, awaits a correlated response, and times out after 10 seconds.

When Roborock drops response support, `get()` will always time out. Goal: remove the `get()` / `PendingResponseTracker` infrastructure and replace data queries with a `OneShotResponseListener` pattern that resolves on the first matching push message (already flowing through `SimpleMessageListener → responseBroadcaster.onMessage()`).

---

## Architecture

```
BEFORE (data query path)
─────────────────────────────────────────────────────────
Dispatcher.getNetworkInfo()
  → client.get() → responseTracker.waitFor() (pending promise)
  → sendInternal()
  → device push arrives → responseBroadcaster.tryResolve()
  → responseTracker resolves promise
  → return extracted result

AFTER (data query path)
─────────────────────────────────────────────────────────
Dispatcher.getNetworkInfo()
  → client.query(duid, request, parseFn)
  → create OneShotResponseListener, register on responseBroadcaster
  → sendInternal()
  → device push arrives → responseBroadcaster.onMessage()
  → listener.onMessage() → parseFn matches → listener resolves
  → return parsed result

UNCHANGED (command path and async push pipeline)
─────────────────────────────────────────────────────────
Commands: client.send() → fire-and-forget (no change)
Push: MQTTClient/LocalClient → responseBroadcaster.onMessage()
  → SimpleMessageListener → AbstractMessageHandler → PlatformRunner
  → runtimes/handlers/ → robot.updateAttribute()
```

---

## What Changes vs. What Stays

**Delete:**

- `routing/services/pendingResponseTracker.ts` (interface)
- `routing/services/v1PendingResponseTracker.ts`
- `routing/services/b01PendingResponseTracker.ts`
- `AbstractClient.get<T>()` and `responseTracker` field
- `ClientRouter.get<T>()`
- `get<T>()` from `Client` interface
- `ResponseBroadcaster.tryResolve()` from interface
- `V1ResponseBroadcaster.tryResolve()` and `B01ResponseBroadcaster.tryResolve()`
- `ResponseBroadcasterFactory.waitFor()`, `cancelAll()`, tracker construction, `PendingResponseTracker implements` clause
- `responseBroadcaster.tryResolve(response)` calls in `localClient.onMessage` and `mqttClient.onMessage`
- `PendingResponseTracker` import/param in `LocalNetworkClient` and `MQTTClient` constructors

**Create:**

- `routing/listeners/oneShotResponseListener.ts`

**Add to existing:**

- `query<T>()` on `Client` interface, `AbstractClient`, `ClientRouter`

**Keep unchanged:**

- `HelloResponseListener` — already its own one-shot pattern
- `SimpleMessageListener` → `AbstractMessageHandler` → `PlatformRunner` → `runtimes/handlers/`
- `BurstPollingManager`, `PollingService` — `getDeviceStatus` callers discard return value already
- Transport layer connection/serialization logic

---

## Phased Implementation

### Phase 1 — Trivial send() conversions (responses were never used)

For each of these, replace `client.get()` with `client.send()`:

| Location               | Method              | Evidence result was ignored                                                                              |
| ---------------------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| `V10MessageDispatcher` | `findMyRobot()`     | `await this.client.get(duid, request)` — result discarded                                                |
| `V10MessageDispatcher` | `getDeviceStatus()` | PollingService discards return; push pipeline already updates state. Convert to `send()`, return `void`. |
| `Q10MessageDispatcher` | `getNetworkInfo()`  | Logs response, returns `undefined`                                                                       |
| `Q10MessageDispatcher` | `getDeviceStatus()` | Result discarded                                                                                         |
| `Q10MessageDispatcher` | `getMapInfo()`      | Logs response, returns stub                                                                              |
| `Q10MessageDispatcher` | `getRoomMap()`      | TODO stub — just return `[]`                                                                             |
| `Q7MessageDispatcher`  | `getMapInfo()`      | Logs response, returns stub                                                                              |
| `Q7MessageDispatcher`  | `getRoomMap()`      | TODO stub — return `[]`                                                                                  |

**Update `AbstractMessageDispatcher` interface:** `getDeviceStatus(duid: string): Promise<void>`

Build + test after Phase 1.

---

### Phase 2 — Introduce `OneShotResponseListener` + `client.query()`, migrate real data queries

#### 2.1 Create `OneShotResponseListener`

File: `src/roborockCommunication/routing/listeners/oneShotResponseListener.ts`

```typescript
// Implements AbstractMessageListener
// duid: string
// name: 'OneShotResponseListener'
// parseFn: (msg: ResponseMessage) => T | undefined
// timeoutMs: number (default: MESSAGE_TIMEOUT_MS)
//
// waitFor(): Promise<T | undefined>
//   - Resolves with parseFn result on first message where parseFn returns non-undefined
//   - Rejects with Error on timeout
//   - After settling, onMessage() is a no-op (settled flag)
//
// onMessage(message: ResponseMessage): Promise<void>
//   - If settled: return
//   - Try parseFn(message); if non-undefined, resolve
```

No auto-unregister: after settling, `onMessage` is a no-op. Stays dormant in the listeners array.
Precedent: `src/roborockCommunication/routing/listeners/implementation/helloResponseListener.ts`

#### 2.2 Add `query<T>()` to `Client` interface and implementations

**`Client` interface** (`routing/client.ts`):

```typescript
query<T>(duid: string, request: RequestMessage, parseFn: (msg: ResponseMessage) => T | undefined, timeoutMs?: number): Promise<T | undefined>;
```

**`AbstractClient`** (`routing/abstractClient.ts`):

```typescript
public async query<T>(duid, request, parseFn, timeoutMs?): Promise<T | undefined> {
  const listener = new OneShotResponseListener<T>(duid, parseFn, timeoutMs);
  this.responseBroadcaster.register(listener);
  this.sendInternal(duid, request);
  return listener.waitFor();
}
```

**`ClientRouter`** (`routing/clientRouter.ts`):

```typescript
public async query<T>(duid, request, parseFn, timeoutMs?): Promise<T | undefined> {
  const listener = new OneShotResponseListener<T>(duid, parseFn, timeoutMs);
  this.broadcasterFactory.register(listener);
  await this.send(duid, request);
  return listener.waitFor();
}
```

#### 2.3 Create V1 result extraction helper

Module-level helper in `V10MessageDispatcher.ts`, reused across all V10 `parseFn`s:

```typescript
function parseV1Result<T>(msg: ResponseMessage, messageId: number): T | undefined {
  // Extract dps from Protocol.rpc_response, Protocol.general_response, or Protocol.general_request
  // Check dps.id === messageId
  // Return dps.result[0] as T or dps.result as T
}
```

#### 2.4 Migrate V10 data queries

Replace each `this.client.get(...)` with `this.client.query(duid, request, parseFn)`:

- **`getNetworkInfo()`**: parseFn extracts `result[0]` as `NetworkInfo` where `dps.id === request.messageId`
- **`getSerialNumber()`**: parseFn extracts `result` as `{ serial_number: string }[]`
- **`getHomeMap()`**: parseFn extracts result as `MapRoomResponse`
- **`getMapInfo()`**: parseFn extracts `result[0]` as `MultipleMapDto`
- **`getRoomMap()`**: parseFn extracts result as `RawRoomMappingData`
- **`getCustomMessage<T>()`**: `this.client.query(duid, def, genericParseFn)`
- **`getCleanModeData()`**: three sequential `query()` calls (structure unchanged)

#### 2.5 Fix `changeCleanMode` guard in V10

Remove the `getCustomMessage('get_custom_mode')` read-before-write. Replace with unconditional sends (F&F makes redundant sends harmless):

```typescript
// Always attempt to exit smart mode first (no-op on device if not in smart mode)
if (mopRoute && mopRoute !== smartMopRoute) {
  await this.client.send(duid, new RequestMessage({ method: 'set_mop_mode', params: [customMopRoute] }));
}
// Then set target settings
if (suctionPower && suctionPower !== 0) { ... set_custom_mode }
if (waterFlow && waterFlow !== 0) { ... set_water_box_custom_mode }
if (mopRoute && mopRoute !== 0) { ... set_mop_mode }
```

#### 2.6 Migrate Q7/Q10 `getCustomMessage()`

Replace `this.client.get()` with `this.client.query()`. Use a generic B01 parseFn to extract data from flat `dps` keyed by code.

Build + test after Phase 2.

---

### Phase 3 — Remove tracker infrastructure

**3.1** Remove `get<T>()` from `Client` interface (`routing/client.ts`)

**3.2** Remove `get<T>()` and `responseTracker` field from `AbstractClient` (`routing/abstractClient.ts`)

**3.3** Remove `get<T>()` from `ClientRouter` (`routing/clientRouter.ts`)

**3.4** Remove `tryResolve()` from `ResponseBroadcaster` interface (`routing/listeners/responseBroadcaster.ts`)

**3.5** Remove `tryResolve()` from `V1ResponseBroadcaster` and `B01ResponseBroadcaster` (including tracker field)

**3.6** Simplify `ResponseBroadcasterFactory`:

- Remove `implements PendingResponseTracker`
- Remove `waitFor()`, `cancelAll()`, tracker construction, tracker fields and imports

**3.7** Remove `responseBroadcaster.tryResolve(response)` from:

- `LocalNetworkClient.onMessage` (line ~221)
- `MQTTClient.onMessage` (line ~262)

**3.8** Remove `responseTracker: PendingResponseTracker` param from `LocalNetworkClient`, `MQTTClient`, and `ClientRouter` construction.

**3.9** Delete files:

- `routing/services/pendingResponseTracker.ts`
- `routing/services/v1PendingResponseTracker.ts`
- `routing/services/b01PendingResponseTracker.ts`

**3.10** Update tests:

- **Delete**: `src/tests/roborockCommunication/routing/services/v1PendingResponseTracker.test.ts`
- **Delete**: `src/tests/roborockCommunication/routing/services/b01PendingResponseTracker.test.ts`
- **Update**: `responseBroadcasterFactory.test.ts` — remove `waitFor`, `cancelAll`, `tryResolve` cases
- **Update**: `v1ResponseBroadcaster.test.ts` — remove `tryResolve` tests
- **Update**: `b01ResponseBroadcaster.test.ts` — remove `tryResolve` tests
- **Create**: `src/tests/roborockCommunication/routing/listeners/oneShotResponseListener.test.ts`
  - Resolves when parseFn returns a value
  - Ignores messages where parseFn returns `undefined`
  - Rejects on timeout
  - Is a no-op after settling (subsequent `onMessage` calls ignored)

Build + test after Phase 3.

---

## Critical Files

| File                                              | Phase | Action                                                                                      |
| ------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------- |
| `routing/client.ts`                               | 2+3   | Add `query<T>()`, remove `get<T>()`                                                         |
| `routing/abstractClient.ts`                       | 2+3   | Add `query()`, remove `get()` + `responseTracker`                                           |
| `routing/clientRouter.ts`                         | 2+3   | Add `query()`, remove `get<T>()`, remove tracker param in construction                      |
| `routing/listeners/oneShotResponseListener.ts`    | 2     | **Create**                                                                                  |
| `routing/listeners/responseBroadcaster.ts`        | 3     | Remove `tryResolve()`                                                                       |
| `routing/listeners/responseBroadcasterFactory.ts` | 3     | Remove tracker/waitFor/cancelAll/implements                                                 |
| `routing/listeners/v1ResponseBroadcaster.ts`      | 3     | Remove `tryResolve()`, tracker field                                                        |
| `routing/listeners/b01ResponseBroadcaster.ts`     | 3     | Remove `tryResolve()`, tracker field                                                        |
| `routing/services/pendingResponseTracker.ts`      | 3     | **Delete**                                                                                  |
| `routing/services/v1PendingResponseTracker.ts`    | 3     | **Delete**                                                                                  |
| `routing/services/b01PendingResponseTracker.ts`   | 3     | **Delete**                                                                                  |
| `local/localClient.ts`                            | 3     | Remove `tryResolve` call, remove `responseTracker` param                                    |
| `mqtt/mqttClient.ts`                              | 3     | Remove `tryResolve` call, remove `responseTracker` param                                    |
| `dispatcher/abstractMessageDispatcher.ts`         | 1     | `getDeviceStatus() → Promise<void>`                                                         |
| `dispatcher/V10MessageDispatcher.ts`              | 1+2   | findMyRobot→send, getDeviceStatus→send, all query migrations, changeCleanMode guard removal |
| `dispatcher/Q10MessageDispatcher.ts`              | 1+2   | getNetworkInfo/getDeviceStatus/getMapInfo/getRoomMap→send, getCustomMessage→query           |
| `dispatcher/Q7MessageDispatcher.ts`               | 1+2   | getMapInfo/getRoomMap→send (return []), getCustomMessage→query                              |
| `constants/timeouts.ts`                           | 2     | Rename `MESSAGE_TIMEOUT_MS` → `QUERY_TIMEOUT_MS` (optional)                                 |

---

## Verification

After **each phase**:

```
npm run build    # must exit 0
npm test         # all tests must pass
```

End-to-end (after Phase 3): Plugin connects, polls device state via push pipeline, and issues commands without awaiting tracker resolution. No timeout errors in logs.
