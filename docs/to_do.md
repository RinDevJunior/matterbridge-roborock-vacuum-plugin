# To Do

## In Progress

- [ ] Investigate MQTT keepalive behavior change (rc04 stopped periodic reconnection — may cause stale connections)
- [ ] Integrate `B01ResponseBroadcaster` into dispatcher factory / connection service for B01 devices

## Completed

- [x] Create `B01ResponseBroadcaster` and `B01PendingResponseTracker` for multi-response B01 protocol handling
- [x] Add real-data integration test to `B01PendingResponseTracker` using example log data
- [x] Add Q10RequestCode key mapping to `B01PendingResponseTracker` — numeric keys converted to named keys at resolve time
- [x] Create release candidate 1.1.4-rc06 with Buy Me a Coffee badge asset
- [x] Update CHANGELOG for 1.1.4-rc06 with staged improvements (2FA toast, snackbar severity, WSS restart prompt)

- [x] Fix version undefined in MQTT request — resolve version in `mqttClient.sendInternal` before serialization

- [x] Fix Node.js 20 compatibility: `Map.values().every()` → `[...Map.values()].every()` in platformRunner.ts

- [x] Improve Codecov patch coverage for module.ts, messageDeserializer, localClient, Q10/Q7 dispatchers, platformRunner
- [x] Create CHANGELOG for 1.1.4-rc05 release candidate
- [x] Improve Codecov patch coverage for localClient, localPingResponseListener, messageContext, messageDeserializer, Q10/Q7 dispatchers, cleanModeUtils
- [x] Fix keepConnectionAlive in MQTTClient and LocalNetworkClient — only reconnect when connection is down
- [x] Increase patch coverage for dev branch (modeResolver, cleanModeConfig, behaviorConfig, handlers, B01MapParser)
- [x] B01 map parser - room extraction from protobuf data
