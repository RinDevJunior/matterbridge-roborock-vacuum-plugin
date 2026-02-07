# MQTT and Local Network Client Issues

## Investigation Date

2026-02-07

## Summary

Two critical issues identified from log analysis:

1. LocalNetworkClient does not trigger reconnection when socket disconnects
2. MQTTClient messages fail after successful reconnection due to subscription logic error

---

## Issue 1: LocalNetworkClient Does Not Trigger Reconnect

### Observed Behavior

```
[09:46:23.775] [LocalNetworkClient]: 7znOB0b8tk30fseWfEplJ socket disconnected. Had error: false
[09:46:23.776] [LocalNetworkClient]: 7znOB0b8tk30fseWfEplJ socket disconnected. Had error: false
```

After socket disconnection, no reconnection attempt is made.

### Root Cause

**File**: [src/roborockCommunication/local/localClient.ts:111-125](../src/roborockCommunication/local/localClient.ts#L111-L125)

```typescript
private async onDisconnect(hadError: boolean): Promise<void> {
  this.logger.info(`[LocalNetworkClient]: ${this.duid} socket disconnected. Had error: ${hadError}`);

  if (this.socket) {
    this.socket.destroy();
    this.socket = undefined;
  }
  if (this.pingInterval) {
    clearInterval(this.pingInterval);
  }
  if (!this.connected) {  // ⚠️ PROBLEM: Only calls onDisconnected if NOT connected
    await this.connectionListener.onDisconnected(this.duid, 'Socket disconnected. Had no error.');
  }
  this.connected = false;
}
```

**Problem**: The condition `if (!this.connected)` prevents `connectionListener.onDisconnected()` from being called when the socket was previously connected. This means:

- No reconnection logic is triggered via `ConnectionStateListener`
- The client remains disconnected permanently

**Expected**: Should always call `connectionListener.onDisconnected()` regardless of `this.connected` state, or the condition should be inverted to `if (this.connected)`.

### Impact

- Local network connections do not automatically recover from disconnections
- System must fall back to MQTT, reducing performance
- Manual restart required to restore local connection

---

## Issue 2: MQTTClient Messages Timeout After Reconnection

### Observed Behavior

```
[09:46:22.678] [error] Device mqtt-ba0511f9 disconnected from MQTTClient with message: MQTT connection closed
[09:46:22.678] [info] Device mqtt-ba0511f9 reconnected to MQTTClient with message: Attempting to reconnect to MQTT broker
[09:46:22.745] [info] Device mqtt-ba0511f9 connected to MQTTClient
[09:46:22.746] [info] onSubscribe: []
[09:46:25.225] [debug] [MQTTClient] sending message to 7znOB0b8tk30fseWfEplJ: { version: 'L01', messageId: 31843, ... }
[09:46:25.226] [debug] [MQTTClient] sent message to 7znOB0b8tk30fseWfEplJ
[09:46:35.225] [error] Message timeout for messageId: 31843, ...
```

After successful reconnection, all messages sent via MQTT timeout (no responses received).

### Root Cause

**File**: [src/roborockCommunication/mqtt/mqttClient.ts:131-141](../src/roborockCommunication/mqtt/mqttClient.ts#L131-L141)

```typescript
private async onSubscribe(err: Error | null, subscription: ISubscriptionGrant[] | undefined): Promise<void> {
  if (!err) {  // ⚠️ INVERTED LOGIC: This means "if NO error"
    this.logger.info(`[MQTTClient] onSubscribe: error: ${debugStringify(err)} ${debugStringify(subscription)}`);
    return;  // Returns early on SUCCESS, preventing subscription setup
  }

  // This code only runs when err EXISTS (subscription failed)
  this.logger.error(`[MQTTClient] Failed to subscribe: ${String(err)}`);
  this.connected = false;

  await this.connectionListener.onDisconnected(`mqtt-${this.mqttUsername}`, `Failed to subscribe to the queue: ${String(err)}`);
}
```

**Problem**: The error checking logic is inverted:

- When `err` is `null` (subscription **succeeded**), the function returns early and logs success
- When `err` exists (subscription **failed**), it logs error and disconnects
- The intended behavior is backwards

**Expected**: Should be `if (err)` to handle errors, allowing successful subscriptions to proceed.

### Impact

- MQTT messages receive no responses after reconnection
- Devices appear connected but cannot communicate
- System degrades to timeout-based failure detection (10 seconds per message)
- User commands fail silently

---

## Log Evidence Timeline

```
09:45:25.224  LocalNetworkClient working normally (message 27788 succeeds)
09:46:19.125  LocalNetworkClient sends ping (message 100714)
09:46:22.678  MQTT disconnects
09:46:22.678  MQTT starts reconnection attempt
09:46:22.745  MQTT reconnects successfully
09:46:22.746  onSubscribe with empty array [] (subscription succeeded but treated as error)
09:46:23.775  LocalNetworkClient socket disconnects
09:46:23.776  LocalNetworkClient socket disconnects (duplicate log)
09:46:25.225  System attempts to use MQTT (LocalNetworkClient down)
09:46:35.225  MQTT message timeout (no response due to broken subscription)
09:47:25.225  Subsequent MQTT messages continue to timeout
```

---

## Recommended Fixes

### Fix 1: LocalNetworkClient Reconnection

**File**: [src/roborockCommunication/local/localClient.ts:111-125](../src/roborockCommunication/local/localClient.ts#L111-L125)

Change condition to always notify on disconnect:

```typescript
private async onDisconnect(hadError: boolean): Promise<void> {
  this.logger.info(`[LocalNetworkClient]: ${this.duid} socket disconnected. Had error: ${hadError}`);

  if (this.socket) {
    this.socket.destroy();
    this.socket = undefined;
  }
  if (this.pingInterval) {
    clearInterval(this.pingInterval);
  }

  // Always notify connection listener if we were connected
  if (this.connected) {  // Changed from !this.connected
    await this.connectionListener.onDisconnected(this.duid, 'Socket disconnected. Had no error.');
  }
  this.connected = false;
}
```

### Fix 2: MQTTClient Subscription Logic

**File**: [src/roborockCommunication/mqtt/mqttClient.ts:131-141](../src/roborockCommunication/mqtt/mqttClient.ts#L131-L141)

Invert the error check:

```typescript
private async onSubscribe(err: Error | null, subscription: ISubscriptionGrant[] | undefined): Promise<void> {
  if (err) {  // Changed from !err - now correctly handles errors
    this.logger.error(`[MQTTClient] Failed to subscribe: ${String(err)}`);
    this.connected = false;
    await this.connectionListener.onDisconnected(`mqtt-${this.mqttUsername}`, `Failed to subscribe to the queue: ${String(err)}`);
    return;
  }

  // Subscription succeeded
  this.logger.info(`[MQTTClient] onSubscribe: ${debugStringify(subscription)}`);
}
```

---

## Additional Observations

### KeepAlive Mechanism

Both clients implement `keepConnectionAlive()` that triggers every 60 minutes (KEEPALIVE_INTERVAL_MS):

- **MQTTClient**: Calls `end()` then `reconnect()` on the MQTT client
- **LocalNetworkClient**: Calls `disconnect()` then `connect()`

This aggressive reconnection strategy may be contributing to connection instability, especially if combined with the broken reconnection logic.

### ConnectionStateListener Behavior

The [ConnectionStateListener](../src/roborockCommunication/routing/listeners/implementation/connectionStateListener.ts) has logic to:

- Wait 30 seconds (MANUAL_RECONNECT_DELAY_MS) for automatic MQTT reconnection
- Trigger manual reconnect if still disconnected
- Stop reconnection for auth errors or "MQTT connection offline" messages

However, this logic is never triggered for LocalNetworkClient due to Issue 1.

---

## Testing Recommendations

1. **Verify LocalNetworkClient reconnection**: Simulate socket disconnection and confirm automatic reconnection
2. **Verify MQTT subscription after reconnect**: Confirm messages receive responses after MQTT reconnects
3. **Test keepalive behavior**: Verify connections remain stable over 60+ minute periods
4. **Test network transitions**: Verify behavior when switching between networks or experiencing brief outages
