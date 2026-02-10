# Claude History

## 2026-02-10

### Feature: Auth Error Backoff with Selective Reconnection

**Problem:** MQTT service blocks connection due to excessive failed auth requests, and mqtt.js built-in auto-reconnect continues indefinitely after auth errors.

**Solution:**

- Keep mqtt.js auto-reconnect enabled for normal errors (network issues, timeouts, etc.)
- Implement auth error backoff mode in `MQTTClient`:
  - Track consecutive auth errors (MQTT error code 5)
  - After 5 consecutive auth errors: terminate connection, wait 60 minutes, then reconnect
  - Reset counter on successful connection
  - Properties: `consecutiveAuthErrors`, `authErrorBackoffTimeout`
- Implement `terminateConnection()` method:
  - Clears `keepConnectionAliveInterval` and `authErrorBackoffTimeout`
  - Calls `mqttClient.end(true)` to force-close and stop auto-reconnect
  - Cleans up state
- Fix `ConnectionStateListener.onConnected()`:
  - Reset `shouldReconnect = true` on successful connection
  - Restores manual reconnect capability after auth error recovery
- Added `.unref()` to intervals/timeouts for clean process exit

**Files modified:**

- `src/roborockCommunication/mqtt/mqttClient.ts`
- `src/roborockCommunication/routing/listeners/implementation/connectionStateListener.ts`
