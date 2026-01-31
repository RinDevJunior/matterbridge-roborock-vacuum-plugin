# To Do

### Configuration

- [x] Update config.json to match latest schema.json structure
- [x] Update TypeScript models (RoborockPluginPlatformConfig, ExperimentalFeatureSetting) to match new schema
- [x] Fix platformConfig.test.ts to use new config structure
- [x] Fix platformConfig.ts to read username from authentication.username
- [x] Fix module.ts to read username, region, and debug from correct locations in new config structure

### Unit Test Coverage

- [x] Improve module.ts coverage from 43.9% to 68.48%
- [ ] Reach 85% coverage target for module.ts (requires startDeviceDiscovery refactoring)
  - Current gap: Lines 118-194 (startDeviceDiscovery method)
  - Recommendation: Extract method logic or implement dependency injection for RoborockService

### GitHub Actions Publishing

- [x] Update publish workflow with conditional npm tags (dev for -rc releases, latest for stable)
