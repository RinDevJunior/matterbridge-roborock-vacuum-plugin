# To Do

## Release Management

### Completed

- [x] Create release candidate 1.1.3-rc16

## Connection Issues (High Priority)

### Pending

- [ ] Fix LocalNetworkClient reconnection logic in `localClient.ts:121` - change `if (!this.connected)` to `if (this.connected)`
- [ ] Fix MQTTClient subscription error handling in `mqttClient.ts:132` - change `if (!err)` to `if (err)`
- [ ] Add unit tests for reconnection scenarios
- [ ] Add unit tests for auth error backoff scenarios
- [ ] Test network transition behavior

## State Resolution Matrix
