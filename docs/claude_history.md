# Claude History

## 2026-02-07

### Investigation: MQTT and Local Network Client Issues

- Analyzed log file `docs/Untitled-1.log` showing connection issues
- Identified two critical bugs:
  1. **LocalNetworkClient**: Does not trigger reconnect due to inverted condition in `onDisconnect()` (line 121)
  2. **MQTTClient**: Messages timeout after reconnection due to inverted error check in `onSubscribe()` (line 132)
- Created detailed investigation report: [mqtt-client-issue.md](mqtt-client-issue.md)
- Files analyzed:
  - `src/roborockCommunication/mqtt/mqttClient.ts`
  - `src/roborockCommunication/local/localClient.ts`
  - `src/services/connectionService.ts`
  - `src/roborockCommunication/routing/abstractClient.ts`
  - `src/roborockCommunication/routing/listeners/implementation/connectionStateListener.ts`
  - `src/constants/timeouts.ts`
