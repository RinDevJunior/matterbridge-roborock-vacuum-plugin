# To Do

## In Progress

- [ ] Investigate MQTT keepalive behavior change (rc04 stopped periodic reconnection — may cause stale connections)

## Completed

- [x] Fix version undefined in MQTT request — resolve version in `mqttClient.sendInternal` before serialization

- [x] Fix Node.js 20 compatibility: `Map.values().every()` → `[...Map.values()].every()` in platformRunner.ts

- [x] Improve Codecov patch coverage for module.ts, messageDeserializer, localClient, Q10/Q7 dispatchers, platformRunner
- [x] Create CHANGELOG for 1.1.4-rc05 release candidate
- [x] Improve Codecov patch coverage for localClient, localPingResponseListener, messageContext, messageDeserializer, Q10/Q7 dispatchers, cleanModeUtils
- [x] Fix keepConnectionAlive in MQTTClient and LocalNetworkClient — only reconnect when connection is down
- [x] Increase patch coverage for dev branch (modeResolver, cleanModeConfig, behaviorConfig, handlers, B01MapParser)
- [x] B01 map parser - room extraction from protobuf data
