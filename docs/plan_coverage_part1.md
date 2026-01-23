# Branch Coverage Improvement Plan - Part 1

## Current State

Overall branch coverage is good, but several files have branch coverage below 85%. This plan focuses on improving branch coverage for the most critical files.

## Priority 1: Critical Communication Files (Branch < 75%)

### 1. `src/roborockCommunication/broadcast/model/messageContext.ts` (50% branch)
**Uncovered lines:** 35-37

**Tasks:**
- [ ] Add test for `getClientRouter()` when router is undefined
- [ ] Add test for error handling paths in context initialization
- [ ] Test edge cases for message context state transitions

### 2. `src/roborockCommunication/broadcast/model/responseMessage.ts` (50% branch)
**Uncovered line:** 30

**Tasks:**
- [ ] Add test for `isForProtocol()` method with various protocol values
- [ ] Test response message parsing with malformed data
- [ ] Add edge case tests for message validation

### 3. `src/roborockCommunication/helper/messageSerializerFactory.ts` (50% branch)
**Uncovered line:** 22

**Tasks:**
- [ ] Add test for factory returning null/undefined serializer
- [ ] Test unsupported protocol version handling
- [ ] Add edge case tests for serializer selection logic

### 4. `src/roborockCommunication/broadcast/model/responseBody.ts` (50% branch)
**Uncovered line:** 12

**Tasks:**
- [ ] Add test for response body with missing fields
- [ ] Test optional field handling
- [ ] Add validation error tests

### 5. `src/roborockCommunication/helper/messageSerializer.ts` (58.33% branch)
**Uncovered lines:** 38, 42, 46

**Tasks:**
- [ ] Add tests for different protocol version serialization paths
- [ ] Test error handling when serialization fails
- [ ] Add boundary tests for message size limits

### 6. `src/roborockCommunication/broadcast/listener/implementation/syncMessageListener.ts` (66.66% branch)
**Uncovered lines:** 27-32

**Tasks:**
- [ ] Add test for timeout scenario when waiting for sync response
- [ ] Test listener cleanup on timeout
- [ ] Add concurrent message handling tests

### 7. `src/roborockCommunication/broadcast/listener/implementation/pingResponseListener.ts` (66.66% branch)
**Uncovered lines:** Related to timeout/rejection paths

**Tasks:**
- [ ] Add more timeout edge case tests
- [ ] Test listener state after timeout
- [ ] Add cleanup verification tests

---

## Priority 2: Core Service Files (Branch 70-75%)

### 8. `src/module.ts` (70.17% branch)

**Tasks:**
- [ ] Add tests for `onConfigure()` error paths
- [ ] Test `onStart()` when authentication fails
- [ ] Add tests for `onShutdown()` cleanup scenarios
- [ ] Test configuration validation edge cases
- [ ] Add tests for experimental feature flag handling

### 9. `src/platformRunner.ts` (71.79% branch)

**Tasks:**
- [ ] Add tests for `updateRobotWithPayload()` with invalid payloads
- [ ] Test `processDeviceNotify()` with various message types
- [ ] Add error handling tests for robot update failures
- [ ] Test device lookup failures

### 10. `src/services/messageRoutingService.ts` (72% branch)
**Uncovered lines:** 50-55, 63, 116-118

**Tasks:**
- [ ] Add test for `getMessageProcessor()` when processor doesn't exist
- [ ] Test routing with invalid device IDs
- [ ] Add tests for `setMqttAlwaysOn()` state changes
- [ ] Test message routing with disconnected clients

### 11. `src/roborockCommunication/helper/messageDeserializer.ts` (72.22% branch)
**Uncovered lines:** 60, 92-93

**Tasks:**
- [ ] Add test for deserialization with unknown protocol
- [ ] Test malformed message handling
- [ ] Add tests for partial message scenarios
- [ ] Test CRC validation failures

### 12. `src/roborockService.ts` (72.72% branch)

**Tasks:**
- [ ] Add tests for `loginWithPassword()` deprecation path
- [ ] Test `requestVerificationCode()` error handling
- [ ] Add tests for `setSelectedAreas()` with invalid data
- [ ] Test service initialization failures

### 13. `src/roborockCommunication/RESTAPI/roborockIoTApi.ts` (73.21% branch)
**Uncovered lines:** 37, 53, 83, 113-114

**Tasks:**
- [ ] Add test for axios-retry configuration failure (line 37)
- [ ] Test request interceptor error path (line 53)
- [ ] Add tests for `getHomeWithProducts()` v3 API fallback (line 83)
- [ ] Test `getHomev3()` result missing scenario (lines 113-114)

### 14. `src/services/connectionService.ts` (73.91% branch)
**Uncovered lines:** 44, 55, 100, 115

**Tasks:**
- [ ] Add test for connection retry exhaustion
- [ ] Test connection state transitions
- [ ] Add tests for cleanup during active connection
- [ ] Test reconnection logic edge cases

---

## Priority 3: Client and Listener Files (Branch 75-82%)

### 15. `src/roborockCommunication/broadcast/client/MQTTClient.ts` (75% branch)
**Uncovered lines:** 83, 110, 120-121

**Tasks:**
- [ ] Add test for `onConnect()` with null result
- [ ] Test `subscribeToQueue()` when not connected
- [ ] Add tests for `onSubscribe()` error handling
- [ ] Test keepalive reconnection logic

### 16. `src/roborockCommunication/broadcast/client/LocalNetworkClient.ts` (75.47% branch)
**Uncovered lines:** 113, 230, 241-242

**Tasks:**
- [ ] Add test for socket connection timeout
- [ ] Test `disconnect()` when already disconnected
- [ ] Add tests for partial message assembly
- [ ] Test error recovery scenarios

### 17. `src/behaviors/roborock.vacuum/default/default.ts` (76.11% branch)

**Tasks:**
- [ ] Add tests for unsupported clean mode handling
- [ ] Test mode change failures
- [ ] Add tests for state update edge cases
- [ ] Test behavior initialization with missing config

### 18. `src/runtimes/handleCloudMessage.ts` (77.5% branch)
**Uncovered lines:** Multiple conditional paths

**Tasks:**
- [ ] Add tests for unknown message types
- [ ] Test message processing with missing fields
- [ ] Add error propagation tests
- [ ] Test concurrent message handling

### 19. `src/services/deviceManagementService.ts` (81.08% branch)
**Uncovered lines:** 351-352, 363-364

**Tasks:**
- [ ] Add test for device cleanup failure
- [ ] Test `disconnect()` error handling
- [ ] Add tests for device state inconsistencies
- [ ] Test concurrent device operations

### 20. `src/roborockCommunication/broadcast/abstractClient.ts` (81.81% branch)
**Uncovered lines:** 57, 72, 99-115

**Tasks:**
- [ ] Add test for `send()` when not connected
- [ ] Test `get()` timeout scenarios
- [ ] Add tests for listener registration edge cases
- [ ] Test client state after errors

---

## Implementation Guidelines

### Test Structure
Each test file should follow this pattern:
```typescript
describe('ClassName', () => {
  describe('methodName', () => {
    it('should handle normal case', () => { ... });
    it('should handle edge case X', () => { ... });
    it('should throw when Y', () => { ... });
  });
});
```

### Branch Coverage Focus Areas
1. **Error paths**: Ensure all `catch` blocks and error conditions are tested
2. **Null/undefined checks**: Test both truthy and falsy branches
3. **Early returns**: Cover guard clauses and validation checks
4. **Optional parameters**: Test with and without optional values
5. **Conditional logic**: Test all branches of `if/else` and ternary operators

### Testing Async Code
- Use `vi.useFakeTimers()` for timeout-related tests
- Always clean up timers with `vi.useRealTimers()` in `afterEach`
- Use `async/await` with `rejects.toThrow()` for error tests

### Mocking Strategy
- Mock external dependencies (axios, mqtt, dgram)
- Use `vi.spyOn()` for partial mocking
- Reset mocks in `beforeEach` or `afterEach`

---

## Success Criteria

- [ ] All Priority 1 files reach 85%+ branch coverage
- [ ] All Priority 2 files reach 80%+ branch coverage
- [ ] All Priority 3 files reach 85%+ branch coverage
- [ ] No regression in existing test coverage
- [ ] All new tests pass consistently

---

## Estimated Effort

| Priority | Files | Estimated Tests | Complexity |
|----------|-------|-----------------|------------|
| 1        | 7     | 25-35           | Medium     |
| 2        | 7     | 40-50           | High       |
| 3        | 6     | 30-40           | Medium     |

**Total estimated new tests:** 95-125 tests
