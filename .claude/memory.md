# Project Shared Memory

This file is read by all agents at the start of each session and updated when new knowledge is discovered.
It is version-controlled — commit and push changes so teammates can pull the latest knowledge.

**Pruning rule:** Each section is capped at 10 bullet points. When adding a new entry that would exceed the cap, remove the oldest entry in that section first.

---

## Architecture Insights

<!-- Patterns and relationships discovered during analysis -->

- Room data (supportedAreas, roomIndexMap) is in-memory only inside `AreaManagementService` private Maps keyed by duid — no file/db persistence.
- `getSupportedAreas` is called from 3 sites: `areaManagementService.getMapInfo`, `areaManagementService.getRoomMap`, `mapInfoListener.updateAreas`.
- Room name resolution in `processValidData` (getSupportedAreas.ts:109-113): priority is `iot_name` → secondary lookup by `iot_name_id` → `Unknown Room ${randomInt(1000,9999)}`.
- `deviceCapabilityRegistry.ts` is a clean-mode-only registry. After DEVICE_EXTRA_MODES removal: `getExtraModes(_model, featureSet?, newFeatureSet?)` returns `[]` when no feature context, else `[vacFollowedByMopModeConfig]` only if `is_clean_then_mop_mode_supported`. `hasSmartPlan(_model, featureSet?, newFeatureSet?)` now decodes feature flags and returns `features.is_smart_clean_mode_set_supported`. `getAllKnownModeConfigs` hardcodes `[vacFollowedByMopModeConfig, ...baseCleanModeConfigs]`. SmartPlan (mode 4) is now gated by feature flag; VacAndMopDeep (mode 12) remains dropped until feature flags are identified.
- Feature-gated mode wiring: `deviceConfigurator.ts` passes `vacuum.featureSet, vacuum.newFeatureSet` to `configureBehavior`; `behaviorFactory.ts` threads them to `buildBehaviorConfig`; `buildBehaviorConfig` threads to `getAllModesForDevice`. Similarly, `roborockVacuumCleaner.ts` passes `device.featureSet, device.newFeatureSet` to `getSupportedCleanModes`. Both Device instances reach registry functions with feature context for dynamic filtering.
- `cleanModeHandler.ts:35` has only `DeviceSpecs` in scope (no Device, no featureSet) — out of scope for this wiring phase. `matterStateNames.ts:6` calls `getAllKnownModeConfigs()` at module level (pure name lookup, not gating) — no change needed.
- SmartPlan (mode 4) and VacAndMopDeep (mode 12) are intentionally dropped — no feature flags found in DeviceFeatures for them. Decision: drop rather than gate by model string, pending discovery of real flags.

## Known Patterns

<!-- Coding patterns established in this project -->

- Per-device override pattern: array of objects with a key field (`serialNumber`) + value field (`productName`), gated by a boolean flag in `advancedFeature.settings`. See `DeviceProductNameOverride` in `RoborockPluginPlatformConfig.ts:58`.
- New config sections in schema use JSON Schema `if/then` blocks under `advancedFeature.allOf` to conditionally expose sub-fields.

## Decisions Made

<!-- Architectural and design decisions with rationale -->

- `featureSetDecoder.ts` placed in `src/share/` (pure utility, no DI, no side effects) — not in `roborockCommunication/helper/` which is scoped to communication internals.
- `DeviceFeatures` interface includes all 7 source groups (A–G) + 3 raw fields; Groups E/F/G always decode to `false` in `decodeFeatureSet` (require other data sources not available in its signature).
- `newFeatureInfo` raw diagnostic field typed as `bigint` (featureSet is a 64-bit integer exceeding Number.MAX_SAFE_INTEGER).
- `extractNibbleBit(hexStr, bitIndex)` helper: nibblePos = Math.floor(bitIndex/4), bitPos = bitIndex%4, char from hexStr[length-1-nibblePos]; module-private (not exported).
- Group C mask `2147483648` (2^31) and `1073741824` (2^30) use `!== 0` comparison to handle JS signed-32-bit bitwise operator behavior.

## Common Pitfalls

<!-- Things to avoid — bugs found, anti-patterns, footguns -->

- `RoborockPluginPlatformConfig` is set via `config as RoborockPluginPlatformConfig` cast in `module.ts:31` — no runtime schema validation. New fields added to the type must also be added to the schema and given defaults.
- `buildBehaviorConfig(model, featureSet?, newFeatureSet?)` caches by model key only (not feature params). This is acceptable because the same device model receives the same feature set across its lifetime; but if a future requirement needs per-feature caching, update the cache key to include featureSet/newFeatureSet hash.
- `decodeFeatureSet` returns all-false on invalid `featureSet` string (try/catch wraps `BigInt()` parse); Group D (nibble extraction) gracefully handles out-of-range or non-hex characters by returning false.

## Module Notes

<!-- Notes about specific modules, non-obvious behaviors -->

- `RoomMapping` stable key candidates: `id` (number), composite `${id}-${iot_map_id}` (string, matches `roomInfos` Map key), `iot_name_id` (string).
- `RANDOM_ROOM_MIN=1000`, `RANDOM_ROOM_MAX=9999` — fallback name suffix is non-deterministic 4-digit int, changes on every startup.
- `AreaManagementService.clearAll()` wipes all in-memory area data including room names.

## Open Questions

<!-- Unresolved questions for the team -->

- Does our TypeScript plugin call `APP_GET_INIT_STATUS`? If so, are `newFeatureInfo`/`newFeatureInfoStr`/`featureInfo` captured and stored?

## featureSet / newFeatureSet (python-roborock reference)

- Python ref: `feature_set` (str) and `new_feature_set` (str) are in `HomeDataDevice` (`containers.py:298-299`), received from home data API.
- `featureSet` → decoded as 64-bit int (`new_feature_info`); lower 32 bits and upper 32 bits each gate different feature groups.
- `newFeatureSet` → decoded as hex string (`new_feature_info_str`); bits extracted by nibble index from right end.
- Third source: `feature_info` (int array) comes from `APP_GET_INIT_STATUS` RPC — independent of home data fields.
- All three decoded together by `DeviceFeatures.from_feature_flags()` in `device_features.py:560-640`.
- Our TypeScript plugin: `featureSet`/`newFeatureSet` are typed on `Device` interface (`models/device.ts:38-39`) but NEVER READ — dead fields at runtime.
- Our capability gating is static model-string lookup only (`deviceCapabilityRegistry.ts`) — no dynamic feature-flag decoding.
- `NewFeatureStrBit` enum: 79 distinct members, integer values 32–120 (with gaps). `TIDYUP_ZONES = MECHANICAL_ARM_MODE = 89` (alias).
- `DeviceFeatures` dataclass: 7 source groups (robot_new_features, upper_32_bits, new_feature_str_mask, new_feature_str_bit, robot_features, model_whitelist/blacklist, product_features) + 3 raw `int`/`str`/`list[int]` diagnostic fields.
- No `BigInt` or `parseInt(...,16)` anywhere in `src/` before featureSetDecoder — that file is now the first hex-parsing code.
- Recommended location for `featureSetDecoder.ts`: `src/share/` (pure utility, no DI, no side effects — matches all existing share/ files).
- `featureSetDecoder.ts` is implemented: `buildAllFalse()` private helper returns the all-false default object; `decodeFeatureSet` wraps `BigInt(featureSet)` in try/catch and returns `buildAllFalse()` on parse failure. Group D bit 89 is intentionally decoded twice (both `is_mechanical_arm_mode_supported` and `is_tidyup_zones_supported`).
