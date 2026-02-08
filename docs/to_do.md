# To Do

## Unit Tests

- [x] Create unit tests for TwoFactorAuthStrategy
- [x] Create unit tests for VerificationCodeService
- [x] Create unit tests for PasswordAuthStrategy
- [x] Create unit tests for UserDataRepository

## Connection Issues (High Priority)

### Bug Fixes Required

- [ ] Fix LocalNetworkClient reconnection logic in `localClient.ts:121` - change `if (!this.connected)` to `if (this.connected)`
- [ ] Fix MQTTClient subscription error handling in `mqttClient.ts:132` - change `if (!err)` to `if (err)`
- [ ] Add unit tests for reconnection scenarios
- [ ] Test network transition behavior

### Documentation

- [x] Create investigation report for connection issues (mqtt-client-issue.md)

## State Resolution Matrix
