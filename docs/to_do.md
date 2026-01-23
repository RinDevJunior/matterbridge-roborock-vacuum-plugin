# To Do

## Completed Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Naming & Folder Cleanup (`models/`, `enums/`) | ✓ |
| 2 | Platform Layer Extraction (`platform/`) | ✓ |
| 3 | Communication Layer Reorganization (`api/`, `mqtt/`, `local/`, `protocol/`, `routing/`) | ✓ |
| 4 | Domain & Ports Introduction (`core/`, `adapters/`) | ✓ |

## Remaining Tasks

### Import Migration (Deferred)
- [ ] Update imports from `Zmodel/` to `models/`
- [ ] Update imports from `Zenum/` to `enums/`
- [ ] Delete old `Zmodel/` and `Zenum/` folders

### Testing & Verification
- [ ] Add unit tests for platform classes
- [ ] Final verification (build, test, lint)
