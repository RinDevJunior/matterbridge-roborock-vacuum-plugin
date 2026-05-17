# Plan: Split `cleanModeConfig.ts` into a Directory Module

> Created: 2026-04-04
> Status: Done (Session 21)
> Priority: 4 (from refactoring-recommendations.md)
> Risk: Low — pure structural refactor, no logic changes, all exported symbols preserved

---

## Context

`src/behaviors/roborock.vacuum/core/cleanModeConfig.ts` (383 LOC) is a single dense file mixing types, label maps, config data, and utility functions. It is imported by 20 files (11 production + 9 test). The goal is to split it into a directory module organized by content type, so adding a new device family or mode category touches one focused file, not the monolith.

**Note:** The recommendations doc mentions "series S/Q/P" but the actual file is not organized by device series — it organizes by **mode capability category** (Vacuum & Mop, Mop-only, Vacuum-only, Special). The plan follows the actual structure.

---

## Source File: Confirmed Sections

| Lines   | Content                                                                        | Exports                                                     |
| ------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| 1–15    | Imports + `CleanModeConfig` interface                                          | `CleanModeConfig`                                           |
| 17–63   | `CleanModeDisplayLabel` enum + `CleanModeLabel` type                           | `CleanModeDisplayLabel`, `CleanModeLabel`                   |
| 65–91   | `CleanModeLabelInfoStruct` (private) + `CleanModeLabelInfo` record             | `CleanModeLabelInfo`                                        |
| 96–192  | V+M mode entries (6) in `baseCleanModeConfigs`                                 | —                                                           |
| 193–252 | Mop-only entries (5) in `baseCleanModeConfigs`                                 | —                                                           |
| 253–301 | Vacuum-only entries (4) in `baseCleanModeConfigs`                              | `baseCleanModeConfigs`                                      |
| 307–354 | `smartPlanModeConfig`, `vacFollowedByMopModeConfig`, `vacAndMopDeepModeConfig` | 3 named consts                                              |
| 360–364 | `smartCleanModeConfigs` array                                                  | `smartCleanModeConfigs`                                     |
| 369–383 | 3 helper functions                                                             | `getModeDisplayMap`, `getModeSettingsMap`, `getModeOptions` |

---

## Target Structure

```
src/behaviors/roborock.vacuum/core/
  cleanModeConfig/           ← new directory (replaces cleanModeConfig.ts)
    index.ts                 ← re-exports + assembles baseCleanModeConfigs + smartCleanModeConfigs
    types.ts                 ← CleanModeConfig, CleanModeDisplayLabel, CleanModeLabel, CleanModeLabelInfo
    vacuumAndMop.ts          ← 6 V+M entries → export const vacuumAndMopModeConfigs
    mopOnly.ts               ← 5 mop-only entries → export const mopOnlyModeConfigs
    vacuumOnly.ts            ← 4 vacuum-only entries → export const vacuumOnlyModeConfigs
    special.ts               ← smartPlanModeConfig, vacFollowedByMopModeConfig, vacAndMopDeepModeConfig
    helpers.ts               ← getModeDisplayMap, getModeSettingsMap, getModeOptions
```

---

## File-by-File Content Plan

### `types.ts` (~90 LOC)

Move lines 1–91 verbatim:

- Imports (`RvcCleanMode` not needed here — used only in config data files and helpers)
- `CleanModeConfig` interface
- `CleanModeDisplayLabel` enum
- `CleanModeLabel` type union
- `CleanModeLabelInfoStruct` interface (keep unexported)
- `CleanModeLabelInfo` record

Own imports: `CleanSequenceType`, `MopRoute`, `MopWaterFlow`, `VacuumSuctionPower` from enums, `CleanModeSetting` from `../CleanModeSetting.js`

### `vacuumAndMop.ts` (~100 LOC)

Export `vacuumAndMopModeConfigs: CleanModeConfig[]` — the 6 V+M entries from lines 97–192.

Own imports: `RvcCleanMode` from matterbridge, `CleanSequenceType`, `MopRoute`, `MopWaterFlow`, `VacuumSuctionPower`, `CleanModeSetting`, `CleanModeDisplayLabel`, `CleanModeLabelInfo`, `CleanModeConfig` from `./types.js`

### `mopOnly.ts` (~65 LOC)

Export `mopOnlyModeConfigs: CleanModeConfig[]` — the 5 mop-only entries from lines 193–252.

Own imports: same pattern as vacuumAndMop.ts

### `vacuumOnly.ts` (~55 LOC)

Export `vacuumOnlyModeConfigs: CleanModeConfig[]` — the 4 vacuum-only entries from lines 253–301.

Own imports: same pattern

### `special.ts` (~50 LOC)

Export named consts from lines 307–354:

- `smartPlanModeConfig`
- `vacFollowedByMopModeConfig`
- `vacAndMopDeepModeConfig`

Own imports: same pattern

### `helpers.ts` (~20 LOC)

Export 3 functions from lines 369–383:

- `getModeDisplayMap`
- `getModeSettingsMap`
- `getModeOptions`

Own imports: `RvcCleanMode` from matterbridge, `CleanModeConfig` from `./types.js`, `CleanModeSetting` from `../CleanModeSetting.js`

### `index.ts` (~30 LOC)

Assemble and re-export all:

```ts
export * from './types.js';
export * from './vacuumAndMop.js';
export * from './mopOnly.js';
export * from './vacuumOnly.js';
export * from './special.js';
export * from './helpers.js';

export const baseCleanModeConfigs: CleanModeConfig[] = [
  ...vacuumAndMopModeConfigs,
  ...mopOnlyModeConfigs,
  ...vacuumOnlyModeConfigs,
];

export const smartCleanModeConfigs: CleanModeConfig[] = [
  smartPlanModeConfig,
  vacFollowedByMopModeConfig,
  ...baseCleanModeConfigs,
];
```

**Critical:** `baseCleanModeConfigs` order must be V+M → Mop → Vacuum (preserves existing array order).

---

## Import Changes Required (20 files)

All are mechanical: `cleanModeConfig.js` → `cleanModeConfig/index.js`.

### Production files (11)

| File                                    | Current path suffix           | New path suffix                     |
| --------------------------------------- | ----------------------------- | ----------------------------------- |
| `core/behaviorConfig.ts`                | `./cleanModeConfig.js`        | `./cleanModeConfig/index.js`        |
| `core/cleanModeUtils.ts`                | `./cleanModeConfig.js`        | `./cleanModeConfig/index.js`        |
| `core/deviceCapabilityRegistry.ts`      | `./cleanModeConfig.js`        | `./cleanModeConfig/index.js`        |
| `core/modeResolver.ts`                  | `./cleanModeConfig.js`        | `./cleanModeConfig/index.js`        |
| `share/runtimeHelper.ts`                | `.../core/cleanModeConfig.js` | `.../core/cleanModeConfig/index.js` |
| `initialData/getSupportedCleanModes.ts` | (verify path)                 | append `/index.js`                  |
| `handlers/smartPlanHandler.ts`          | `../core/cleanModeConfig.js`  | `../core/cleanModeConfig/index.js`  |
| `handlers/defaultCleanModeHandler.ts`   | `../core/cleanModeConfig.js`  | `../core/cleanModeConfig/index.js`  |
| `handlers/customCleanModeHandler.ts`    | `../core/cleanModeConfig.js`  | `../core/cleanModeConfig/index.js`  |
| `handlers/presetCleanModeHandler.ts`    | `../core/cleanModeConfig.js`  | `../core/cleanModeConfig/index.js`  |
| `handlers/goVacationHandler.ts`         | `../core/cleanModeConfig.js`  | `../core/cleanModeConfig/index.js`  |

### Test files (9)

Same pattern — all `cleanModeConfig.js` → `cleanModeConfig/index.js` in `src/tests/`.

---

## Execution Steps

1. Create `src/behaviors/roborock.vacuum/core/cleanModeConfig/` directory
2. Create `types.ts` — move lines 1–91
3. Create `vacuumAndMop.ts` — move 6 V+M entries
4. Create `mopOnly.ts` — move 5 mop-only entries
5. Create `vacuumOnly.ts` — move 4 vacuum-only entries
6. Create `special.ts` — move 3 named configs
7. Create `helpers.ts` — move 3 helper functions
8. Create `index.ts` — re-exports + assemble `baseCleanModeConfigs` + `smartCleanModeConfigs`
9. Delete `cleanModeConfig.ts`
10. Update all 20 import files (use grep to find each, then edit)
11. `npm run build` — fix any remaining import errors
12. `npm test` — all 1912 tests must pass
13. `npm run lint -- --fix`
14. Stage all changes

---

## Verification

```bash
npm run build
npm test                                                               # 1912 tests pass
npm run lint
wc -l src/behaviors/roborock.vacuum/core/cleanModeConfig/*.ts         # each ≤ 110 LOC
grep -r "cleanModeConfig.js" src/                                     # 0 results (all updated)
```

---

## Anti-patterns to Avoid

- Do NOT change any exported symbol names or data values — pure structural move
- Do NOT add `VacuumMin` config (exists in enum but intentionally absent from arrays)
- Do NOT inline `baseCleanModeConfigs` in sub-files — assembled only in `index.ts`
- Do NOT change the order of entries in `baseCleanModeConfigs` (V+M → Mop → Vacuum)
