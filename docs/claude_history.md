# Claude History

## 2026-01-31

### Unit Test Fixes

- Fixed 3 failing unit tests (chainedMessageListener, pingResponseListener, handleCloudMessage)
- Changed async assertions to sync for `void` return methods
- Fixed shared mock state causing test pollution
- Result: All 1232 tests passing

### Configuration Schema Alignment

- Restructured config.json to align with schema.json v1.1.3-rc05
- Updated TypeScript models with new nested structure (authentication, pluginConfiguration, advancedFeature)
- Fixed platformConfig.ts and module.ts to use new config paths
- Result: All tests passing, config properly validated

### Unit Test Coverage Improvement

- Increased module.ts coverage from 43.9% to 68.48%
- Created comprehensive tests for onConfigureDevice, device notify callbacks, error handling
- Remaining gap: startDeviceDiscovery method (lines 118-194) requires refactoring for 85%+ coverage

---

## Archive

### 2026-01-30

- Updated GitHub Actions for conditional npm tag publishing (dev/latest)
- Refactored API: send() for fire-and-forget, get() for queries
- Architecture review: validated multi-layer design
- Updated CODE_STRUCTURE.md with v4.0 changes

### 2026-01-26

- Room/Map models refactoring (5 phases)
- Separated API DTOs from application models
- Implemented DTO→Mapper→Model pattern
