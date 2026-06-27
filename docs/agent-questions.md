## Task

Remove `DEVICE_EXTRA_MODES` from the plugin and make clean mode selection rely entirely on `featureSet` and `newFeatureSet` capability flags decoded by `decodeFeatureSet`.

## Questions

### Q1

What is the exact current content of `DEVICE_EXTRA_MODES` in `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts`? List every model key and the array of mode config names or objects it maps to. Also show the full `getExtraModes` and `getAllModesForDevice` function bodies so we can see exactly how `DEVICE_EXTRA_MODES` is consumed and filtered.
Relevant area: `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts`

### Q2

What are the full exported names of every clean mode config currently defined in the codebase (e.g. `smartPlanModeConfig`, `vacFollowedByMopModeConfig`, `vacAndMopDeepModeConfig`) and in which file are they defined? Also show the numeric mode value for each.
Relevant area: `src/behaviors/roborock.vacuum/core/` or wherever CleanModeConfig objects are defined

### Q3

What fields on the `DeviceFeatures` interface (in `src/share/featureSetDecoder.ts` or wherever it is declared) correspond to:

- Smart Plan (mode 4)
- VacFollowedByMop (mode 11)
- VacAndMopDeep (mode 12)

List the exact boolean property names that map to each mode. If a mode has no corresponding flag, state that explicitly.
Relevant area: `src/share/featureSetDecoder.ts`

### Q4

Show the full call chain from device init through to the registry. Specifically:

- Where in `deviceConfigurator.ts` or `behaviorFactory.ts` is `getAllModesForDevice` (or `getExtraModes`) called with `featureSet`/`newFeatureSet`?
- Where in `roborockVacuumCleaner.ts` or `getSupportedCleanModes.ts` is the registry called with feature args?
- What is the signature of `decodeFeatureSet` and where is it imported at each call site?
  Relevant area: `src/platform/deviceConfigurator.ts`, `src/share/behaviorFactory.ts`, `src/types/roborockVacuumCleaner.ts`, `src/initialData/getSupportedCleanModes.ts`

### Q5

Show the full `hasSmartPlan` function body and explain whether it reads from `DEVICE_EXTRA_MODES` or a separate data structure. If separate, what is that structure?
Relevant area: `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts`

### Q6

Are there any test files that import or reference `DEVICE_EXTRA_MODES`, `getExtraModes`, `getAllModesForDevice`, or `hasSmartPlan`? List all such files and which symbols they use.
Relevant area: `src/tests/`

## Status

answered
