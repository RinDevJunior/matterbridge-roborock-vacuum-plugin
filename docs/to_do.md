# To Do

## Completed Phases

| Phase | Description                                                                             | Status |
| ----- | --------------------------------------------------------------------------------------- | ------ |
| 1     | Naming & Folder Cleanup (`models/`, `enums/`)                                           | ✓      |
| 2     | Platform Layer Extraction (`platform/`)                                                 | ✓      |
| 3     | Communication Layer Reorganization (`api/`, `mqtt/`, `local/`, `protocol/`, `routing/`) | ✓      |
| 4     | Domain & Ports Introduction (`core/`, `adapters/`)                                      | ✓      |

## Remaining Tasks

### Import Migration (Deferred)

- [ ] Update imports from `Zmodel/` to `models/`
- [ ] Update imports from `Zenum/` to `enums/`
- [ ] Delete old `Zmodel/` and `Zenum/` folders

### Testing & Verification

- [x] Add unit tests for module.ts coverage (improved from 31% to 43%)
- [x] Add unit tests for platformLifecycle.ts (100% coverage achieved)
- [ ] Add unit tests for remaining platform classes (deviceRegistry, platformConfig, platformState)
- [ ] Final verification (build, test, lint)
