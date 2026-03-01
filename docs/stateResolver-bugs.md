# stateResolver.ts — Matrix Audit Bugs

Audit: `src/share/stateResolver.ts` vs `misc/state_resolution_matrix.md` (2026-03-01)

---

## Bug 1 — Row 31: InError base runMode is Idle, should be Cleaning

**File:** `src/share/function.ts` → `state_to_matter_state()`

**Matrix:** InError (12) base → Cleaning (16385) + Error (3)
**Actual:** InError (12) falls to `default` case → Idle + Error

`OperationStatusCode.InError` is not listed in the Cleaning group of `state_to_matter_state`. Fix: add it.

```typescript
// In state_to_matter_state(), add InError to the Cleaning group:
case OperationStatusCode.InError:  // add this line
case OperationStatusCode.RemoteControl:
// ...
  return RvcRunMode.ModeTag.Cleaning;
```

---

## Bug 2 — Rows 23 & 29: isLocating not handled in generic modifier chain

**File:** `src/share/stateResolver.ts` — generic modifier chain

**Matrix:**
- Row 23: ManualMode (7) + `isLocating=T` → Cleaning + UpdatingMaps (70)
- Row 29: SpotCleaning (11) + `isLocating=T` → Cleaning + UpdatingMaps (70)

**Actual:** `isLocating` is only checked inside the `status === Cleaning (5)` special block.
`applyInReturningModifier`, `applyIsExploringModifier`, `applyInFreshStateModifier` do not check `isLocating`.
Result: Cleaning + Running (wrong).

Fix: add `applyIsLocatingModifier` to the generic modifier chain, or extend `applyIsExploringModifier` to also handle `isLocating`.

---

## Bug 3 — Row 30: SpotCleaning + isExploring gives Mapping+Running, should be Cleaning+UpdatingMaps

**File:** `src/share/stateResolver.ts` → `applyIsExploringModifier`

**Matrix:** SpotCleaning (11) + `isExploring=T` → Cleaning (16385) + UpdatingMaps (70)
**Actual:** `applyIsExploringModifier` sets `runMode = Mapping`, preserves operationalState → Mapping + Running

SpotCleaning with `isExploring` should behave like Cleaning (5) Priority 1 — change operationalState to UpdatingMaps, keep runMode = Cleaning — not change runMode to Mapping.

Note: all other statuses with `isExploring` correctly change runMode to Mapping. SpotCleaning is the only exception per the matrix.

Fix: handle SpotCleaning + `isExploring` the same as Cleaning + `isExploring` (Cleaning+UpdatingMaps), either by extending the Cleaning special block or adding a SpotCleaning special block.

---

## Low-risk Gap — Charging (8) not in Priority 0

**Matrix:** Row 24 — Charging (8): all flags ignored → Idle + Docked
**Code:** Charging goes through generic path. `applyInReturningModifier` does NOT skip Charging.

If `inReturning=T` with Charging (invalid state per matrix), code returns Cleaning + SeekingCharger instead of Idle + Docked. Matrix marks this as an invalid state combination so it should not occur in practice, but no defensive guard exists.

Fix (optional): add Charging as Priority 0 override in `resolveDeviceState`.
