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

## Authentication Gaps

### Pending

- [ ] Clear `verificationCode` from config on auth failure (behavior 2 gap)
- [ ] Call `validateAuthentication()` before auth attempt in `DeviceDiscovery.discoverDevices()` or `RoborockService.authenticate()` (behavior 3 gap)
- [ ] Add integration test for `forceAuthentication` reset in `module.ts` after successful auth (behavior 1 coverage gap)

## State Resolution Matrix
