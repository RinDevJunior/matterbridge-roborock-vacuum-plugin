## Task

Remove `DEVICE_EXTRA_MODES` and rely entirely on featureSet/newFeatureSet flags for clean mode selection.

- Mode 11 (vacFollowedByMop): keep, gated on `is_clean_then_mop_mode_supported` (bit 93 of newFeatureSet).
- Mode 4 (smartPlan): gated on `is_smart_clean_mode_set_supported` (bit 55 of newFeatureSet) — user-directed.
- Mode 12 (vacAndMopDeep): no feature flag identified → dropped until flag is found.
- `hasSmartPlan` now uses `is_smart_clean_mode_set_supported` — signature updated to accept `featureSet?` and `newFeatureSet?`.
- `getAllKnownModeConfigs` reads `DEVICE_EXTRA_MODES` → must be rewritten without it.

## Approach

Single-file change in `deviceCapabilityRegistry.ts`. Remove the static model map, rewrite three functions (`getExtraModes`, `hasSmartPlan`, `getAllKnownModeConfigs`) and clean up now-unused imports. All callers remain unchanged; `buildBehaviorConfig`, `getSupportedCleanModes`, and `getAllModesForDevice` signatures/call sites are untouched.

## Files to Modify

- `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts` — all changes are here.

## Files to Create

None.

## Implementation Steps

### 1. Remove the `DEVICE_EXTRA_MODES` constant

Delete the entire `DEVICE_EXTRA_MODES` export (currently lines 28–33):

```typescript
export const DEVICE_EXTRA_MODES: Partial<Record<string, CleanModeConfig[]>> = {
    [DeviceModel.QREVO_EDGE_5V1]: [smartPlanModeConfig, vacFollowedByMopModeConfig],
    [DeviceModel.QREVO_PLUS]:     [smartPlanModeConfig, vacFollowedByMopModeConfig],
    [DeviceModel.QREVO_MAXV]:     [smartPlanModeConfig, vacFollowedByMopModeConfig],
    [DeviceModel.Q10_S5_PLUS]:    [vacFollowedByMopModeConfig, vacAndMopDeepModeConfig],
};
```

### 2. Remove unused imports

After removing `DEVICE_EXTRA_MODES`, the following become unused and must be removed:

- `DeviceModel` (from roborockDeviceModel)
- `smartPlanModeConfig` (from cleanModeConfig/special)
- `vacAndMopDeepModeConfig` (from cleanModeConfig/special)
- `CleanModeDisplayLabel` (currently used only in `hasSmartPlan`)

Keep: `vacFollowedByMopModeConfig`, `decodeFeatureSet`, `baseCleanModeConfigs`, `CleanModeConfig`.

### 3. Rewrite `getExtraModes`

Old body reads `DEVICE_EXTRA_MODES[model]` then conditionally filters. New body — rename `model` to `_model` (unused, kept for interface compatibility with `getAllModesForDevice`):

```typescript
export function getExtraModes(_model: string, featureSet?: string, newFeatureSet?: string): CleanModeConfig[] {
    const hasFeatureContext = featureSet !== undefined || newFeatureSet !== undefined;

    if (!hasFeatureContext) {
        return [];
    }

    const features = decodeFeatureSet(featureSet, newFeatureSet);
    return features.is_clean_then_mop_mode_supported ? [vacFollowedByMopModeConfig] : [];
}
```

### 4. Rewrite `hasSmartPlan`

Gate on `is_smart_clean_mode_set_supported`. Extend signature to accept feature params:

```typescript
export function hasSmartPlan(_model: string, featureSet?: string, newFeatureSet?: string): boolean {
    const features = decodeFeatureSet(featureSet, newFeatureSet);
    return features.is_smart_clean_mode_set_supported;
}
```

### 5. Rewrite `getAllKnownModeConfigs`

Old body iterates `DEVICE_EXTRA_MODES`. New body — include `vacFollowedByMopModeConfig` directly so `matterStateNames.ts` can display its label when a device reports mode 11. SmartPlan and VacAndMopDeep are excluded (being dropped):

```typescript
export function getAllKnownModeConfigs(): CleanModeConfig[] {
    const uniqueByMode = new Map<number, CleanModeConfig>();
    for (const config of [vacFollowedByMopModeConfig, ...baseCleanModeConfigs]) {
        if (!uniqueByMode.has(config.mode)) {
            uniqueByMode.set(config.mode, config);
        }
    }
    return [...uniqueByMode.values()];
}
```

## Constraints

- Do NOT modify `getAllModesForDevice` — its signature and body stay the same.
- Do NOT modify `behaviorConfig.ts`, `behaviorFactory.ts`, `deviceConfigurator.ts`, `roborockVacuumCleaner.ts`, `getSupportedCleanModes.ts`, or `matterStateNames.ts`.
- Do NOT modify any test files — no tests reference these symbols.
- Do NOT remove the `vacFollowedByMopModeConfig` import — still needed in steps 3 and 5.
- Do NOT remove `decodeFeatureSet` import — still needed in step 3.
- Do NOT remove `baseCleanModeConfigs` import — still needed in step 5.
- Keep `CleanModeConfig` type import — appears in function return types.
- Naming: `_model` (underscore prefix) for intentionally unused parameters, per project coding standards.

## Test Strategy

No test changes required. `DEVICE_EXTRA_MODES`, `getExtraModes`, `getAllModesForDevice`, and `hasSmartPlan` have zero references in `src/tests/`.

## Status

ready
