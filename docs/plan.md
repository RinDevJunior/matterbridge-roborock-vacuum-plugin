## Task

Wire `featureSetDecoder` into `deviceCapabilityRegistry` so that `VacFollowedByMop` mode (mode 11) is gated dynamically on the `is_clean_then_mop_mode_supported` feature flag (bit 93 of `newFeatureSet`), while `SmartPlan` (mode 4) and `VacAndMopDeep` (mode 12) remain static model-string lookups.

---

## Approach

**Hybrid strategy** — three clean mode types, three strategies:

| Mode                       | Strategy                                                                                 | Reason                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Smart Plan (mode 4)        | Static model-string lookup — unchanged                                                   | No `DeviceFeatures` flag equivalent exists                                                                           |
| VacFollowedByMop (mode 11) | Dynamic: decode bit 93 of `newFeatureSet`; fall back to static if feature strings absent | `is_clean_then_mop_mode_supported` (python-roborock `CLEAN_THEN_MOP_MODE = 93`) is the confirmed semantic equivalent |
| VacAndMopDeep (mode 12)    | Static model-string lookup — unchanged                                                   | No `DeviceFeatures` flag equivalent exists                                                                           |

Thread `featureSet?: string` and `newFeatureSet?: string` from the `Device` DTO — which already carries them — into the two call sites that have a full `Device` in scope (`deviceConfigurator.ts` and `roborockVacuumCleaner.ts`). Registry functions accept these as **optional parameters** so all existing callers without device context continue to compile without modification.

**Acknowledged limitations (out of scope for this plan):**

- `cleanModeHandler.ts:35` (call site 3) holds only `DeviceSpecs`, which does not carry `featureSet`. Threading `Device` here requires a separate refactor. `runtimeHelper.ts` (called from it) will remain static for now. This is harmless: if dynamic gating excludes VacFollowedByMop at configuration time, Matter controllers never command it, so the static runtime resolver having a dead path causes no visible impact.
- `matterStateNames.ts:6` calls `getAllKnownModeConfigs()` at module level with no device context. This is a name-lookup table only (not mode gating) — it stays static and requires no change.

---

## Files to Modify

### 1. `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts`

**What to change:**

- Add import at the top:

  ```typescript
  import { decodeFeatureSet } from '../../../share/featureSetDecoder.js';
  ```

- Update `getExtraModes` signature:

  ```typescript
  // Before:
  export function getExtraModes(model: string): CleanModeConfig[]
  // After:
  export function getExtraModes(model: string, featureSet?: string, newFeatureSet?: string): CleanModeConfig[]
  ```

- Update `getExtraModes` body with hybrid filter logic:

  ```typescript
  const staticModes = DEVICE_EXTRA_MODES[model] ?? [];
  const hasFeatureContext = featureSet !== undefined || newFeatureSet !== undefined;
  if (!hasFeatureContext) {
      return staticModes;
  }
  const features = decodeFeatureSet(featureSet, newFeatureSet);
  return staticModes.filter((config) => {
      if (config.mode === vacFollowedByMopModeConfig.mode) {
          return features.is_clean_then_mop_mode_supported;
      }
      return true; // Smart Plan, VacAndMopDeep — static only, always pass through
  });
  ```

- Update `getAllModesForDevice` signature:

  ```typescript
  // Before:
  export function getAllModesForDevice(model: string): CleanModeConfig[]
  // After:
  export function getAllModesForDevice(model: string, featureSet?: string, newFeatureSet?: string): CleanModeConfig[]
  ```

- Update `getAllModesForDevice` body:

  ```typescript
  // Before:
  return [...getExtraModes(model), ...baseCleanModeConfigs];
  // After:
  return [...getExtraModes(model, featureSet, newFeatureSet), ...baseCleanModeConfigs];
  ```

- `hasSmartPlan` and `getAllKnownModeConfigs` — **no changes**. `hasSmartPlan` calls `getExtraModes(model)` with no feature context (correct — Smart Plan is static). `getAllKnownModeConfigs` is a name-lookup union with no device context.

**Why:** The mode number for VacFollowedByMop must be compared against `vacFollowedByMopModeConfig.mode` — the implementer must verify the exact name of this constant in the file (it may be a module-level `const`). If the constant name differs, compare `config.mode === 11` as a fallback.

---

### 2. `src/behaviors/roborock.vacuum/core/behaviorConfig.ts`

**What to change:**

- Find the exported function called `configureBehavior` (or equivalent — the one imported and called from `deviceConfigurator.ts:117`).
- Extend its parameter list with `featureSet?: string` and `newFeatureSet?: string`.
- Thread them into the `getAllModesForDevice` call (currently `getAllModesForDevice(model)`):
  ```typescript
  // Before:
  const allModes = getAllModesForDevice(model);
  // After:
  const allModes = getAllModesForDevice(model, featureSet, newFeatureSet);
  ```
- The `hasSmartPlan(model)` call on the same line does **not** change — Smart Plan is static.

---

### 3. `src/initialData/getSupportedCleanModes.ts`

**What to change:**

- Find the exported function that calls `getAllModesForDevice(model)` (currently line 23).
- Extend its parameter list with `featureSet?: string` and `newFeatureSet?: string`.
- Thread them into the call:
  ```typescript
  // Before:
  const supportedModes = getModeOptions(getAllModesForDevice(model));
  // After:
  const supportedModes = getModeOptions(getAllModesForDevice(model, featureSet, newFeatureSet));
  ```

---

### 4. `src/platform/deviceConfigurator.ts`

**What to change:**

- At the call site (line ~117) where `configureBehavior` is called with `vacuum.specs.model`:
  ```typescript
  // Before (conceptual):
  configureBehavior(vacuum.specs.model, vacuum.duid, ...)
  // After:
  configureBehavior(vacuum.specs.model, vacuum.duid, ..., vacuum.featureSet, vacuum.newFeatureSet)
  ```
- `vacuum` is already `Device` — no additional fetching required.
- The exact parameter position depends on the current `configureBehavior` signature; the implementer must match it.

---

### 5. `src/types/roborockVacuumCleaner.ts`

**What to change:**

- At the call site (line ~144) inside `initializeDeviceConfiguration(device: Device, ...)`:
  ```typescript
  // Before:
  const cleanModes = getSupportedCleanModes(device.specs.model, configManager);
  // After:
  const cleanModes = getSupportedCleanModes(device.specs.model, configManager, device.featureSet, device.newFeatureSet);
  ```
- `device` is already `Device` — no additional fetching required.

---

## Files NOT to Modify

- `src/runtimes/handlers/cleanModeHandler.ts` — only `DeviceSpecs` in scope; out of scope for this plan
- `src/share/runtimeHelper.ts` — called from `cleanModeHandler.ts` with model string only; deferred
- `src/share/matterStateNames.ts` — module-level static call; name-lookup only, not gating
- `src/share/featureSetDecoder.ts` — already implemented; no changes needed

---

## Implementation Steps

1. **`deviceCapabilityRegistry.ts`:**
   - Add `featureSetDecoder` import.
   - Update `getExtraModes` signature and body with hybrid filter logic (check `hasFeatureContext`, call `decodeFeatureSet`, filter on `is_clean_then_mop_mode_supported` for mode 11 only).
   - Update `getAllModesForDevice` signature and body to thread optional params through to `getExtraModes`.
   - Leave `hasSmartPlan` and `getAllKnownModeConfigs` unchanged.

2. **`behaviorConfig.ts`:**
   - Add `featureSet?: string` and `newFeatureSet?: string` to the exported function that calls `getAllModesForDevice`.
   - Thread into the `getAllModesForDevice` call.

3. **`getSupportedCleanModes.ts`:**
   - Add `featureSet?: string` and `newFeatureSet?: string` to the exported function.
   - Thread into the `getAllModesForDevice` call.

4. **`deviceConfigurator.ts`:**
   - At the `configureBehavior` call site, pass `vacuum.featureSet` and `vacuum.newFeatureSet` as the last two arguments.

5. **`roborockVacuumCleaner.ts`:**
   - At the `getSupportedCleanModes` call site, pass `device.featureSet` and `device.newFeatureSet` after the existing arguments.

---

## Hybrid Filter Logic Detail

`decodeFeatureSet` (already implemented in `src/share/featureSetDecoder.ts`) wraps `BigInt` parsing in try/catch and returns all-false on parse failure. This means:

- If `featureSet` is `undefined` and `newFeatureSet` is `undefined` → `hasFeatureContext` is false → static fallback (no decoding attempted)
- If both are provided but malformed/empty → decoder returns all-false → `is_clean_then_mop_mode_supported` is `false` → VacFollowedByMop is excluded (conservative behavior)
- If only `newFeatureSet` is provided (featureSet absent) → `hasFeatureContext` is true → decode with `featureSet = undefined` (decoder handles this gracefully) → Groups A/B default to 0; Group D bit 93 drives the decision

The conservative behavior (exclude on missing/bad data) is intentional. It avoids advertising modes the device may not support.

---

## Constraints

- All new parameters must be `optional` (`?:`) — existing callers at `runtimeHelper.ts` and `matterStateNames.ts` call without device context and must continue to compile without changes
- Do not add `featureSet`/`newFeatureSet` to `DeviceSpecs` — that interface is separate from `Device`
- Do not change `hasSmartPlan` — Smart Plan is static; it calls `getExtraModes(model)` with no feature context, which is correct
- Follow existing TypeScript patterns in `deviceCapabilityRegistry.ts`: pure functions, no side effects, no DI
- All new parameters must be placed after existing required parameters to avoid breaking callers that pass positional arguments

---

## Test Strategy

Test file: `src/tests/deviceCapabilityRegistry.test.ts` (create if it does not exist alongside existing test files)

Cases to cover:

- `getExtraModes(model)` with no featureSet args → returns static modes unchanged (existing behavior for all models)
- `getExtraModes(model, featureSet, newFeatureSet)` where decoded `is_clean_then_mop_mode_supported = true` → VacFollowedByMop (mode 11) included for a model that has it in the static table (e.g., QREVO_EDGE_5V1)
- `getExtraModes(model, featureSet, newFeatureSet)` where decoded `is_clean_then_mop_mode_supported = false` → VacFollowedByMop excluded for the same model
- `getExtraModes` with malformed/empty featureSet strings → VacFollowedByMop excluded (conservative behavior)
- SmartPlan (mode 4) is always included when model has it, regardless of any featureSet value
- VacAndMopDeep (mode 12) is always included when model has it, regardless of any featureSet value
- `getAllModesForDevice` threads featureSet and newFeatureSet through to `getExtraModes` correctly
- `hasSmartPlan` returns correct value regardless of whether featureSet is provided (it uses static lookup only)

To construct a `newFeatureSet` value where bit 93 is set: nibble 23 from right (Math.floor(93/4) = 23), bit 1 within that nibble (93 % 4 = 1). A hex string with the character at position `length-1-23` set to `2` (binary `0010`) will set bit 93. Example: `'000000000000000000000002' + '0'.repeat(23)` padded appropriately. The test can alternatively call `decodeFeatureSet` directly to confirm the expected flag, then build the registry assertion separately.

---

## Status

ready
