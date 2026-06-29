# To Do

## Completed

- [x] Release candidate `1.1.7-rc04` created
- [x] Fix `ChargingError` (status code 9) to properly set `operationalError = FailedToFindChargingDock`
- [x] Investigate feature gaps (reference vs current plugin) — gaps analysis complete
- [x] Implement `src/share/featureSetDecoder.ts` — pure decoder for DeviceFeatures capability flags
- [x] Wire `hasSmartPlan` to `is_smart_clean_mode_set_supported` feature flag — SmartPlan mode 4 now dynamically gated
- [x] Wiki documentation fixes — updated 6 files to reflect feature-flag-driven architecture
- [x] Wiki gap fill — created 5 new pages (Runtime-Handlers-Pipeline, Message-Listeners-Architecture, Message-Dispatchers-Protocol-Routing, Feature-Flags-Device-Capabilities, Room-Map-Data-Pipeline); expanded 6 existing pages; updated Home.md index

## Pending

### Implementation Tasks

### Open Feature Gaps

- [ ] **Gap 1** — `selectAreas` all-selected normalization (low-medium, needs API confirmation)
- [ ] **Gap 3** — Firmware-version-aware device capability selection (low, complex; could leverage featureSetDecoder)
- [ ] **Gap 4** — `roomNames` config override for manual room name assignment (low, ready to implement when user reports)
