# To Do

## Completed

- [x] Release candidate `1.1.7-rc04` created
- [x] Fix `ChargingError` (status code 9) to properly set `operationalError = FailedToFindChargingDock`
- [x] Investigate feature gaps (reference vs current plugin) — gaps analysis complete
- [x] Implement `src/share/featureSetDecoder.ts` — pure decoder for DeviceFeatures capability flags

## Pending

### Implementation Tasks

### Open Feature Gaps

- [ ] **Gap 1** — `selectAreas` all-selected normalization (low-medium, needs API confirmation)
- [ ] **Gap 3** — Firmware-version-aware device capability selection (low, complex; could leverage featureSetDecoder)
- [ ] **Gap 4** — `roomNames` config override for manual room name assignment (low, ready to implement when user reports)
