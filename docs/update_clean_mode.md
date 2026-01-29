# Clean Mode Refactoring Plan

## Current State Analysis

### Files Involved

**Command Handlers (Primary Focus):**

- [src/behaviors/roborock.vacuum/default/default.ts](../src/behaviors/roborock.vacuum/default/default.ts)
- [src/behaviors/roborock.vacuum/smart/smart.ts](../src/behaviors/roborock.vacuum/smart/smart.ts)

**Mode Initialization (Phase 7):**

- [src/behaviors/roborock.vacuum/default/initialData.ts](../src/behaviors/roborock.vacuum/default/initialData.ts)
- [src/behaviors/roborock.vacuum/smart/initialData.ts](../src/behaviors/roborock.vacuum/smart/initialData.ts)

**Runtime Mode Resolution (Phase 7):**

- [src/behaviors/roborock.vacuum/default/runtimes.ts](../src/behaviors/roborock.vacuum/default/runtimes.ts)
- [src/behaviors/roborock.vacuum/smart/runtimes.ts](../src/behaviors/roborock.vacuum/smart/runtimes.ts)

### Identified Problems

1. **Code Duplication (~85% identical code)**

   - Command handler registration is nearly identical between default and smart behaviors
   - Six command handlers (SELECT_AREAS, PAUSE, RESUME, GO_HOME, IDENTIFY, STOP) are duplicated verbatim
   - Only logging prefix differs (e.g., "DefaultBehavior-" vs "BehaviorSmart-")

2. **Large Switch Statements**

   - `CHANGE_TO_MODE` handler contains 50+ lines with repetitive case blocks
   - Multiple case statements have identical logic (lines 160-177 in default.ts, 120-137 in smart.ts)
   - Difficult to identify differences between behaviors

3. **Tight Coupling**

   - Mode resolution, logging, and command execution are intertwined
   - Hard to test individual mode handling logic
   - Changes to one mode can inadvertently affect others

4. **Poor Extensibility**

   - Adding new cleaning modes requires modifying switch statements
   - No clear extension points for custom behaviors
   - Device-specific modes (like "Smart Plan") require forking entire command handler

5. **Inconsistent Abstractions**

   - Mode enums are separate but similar (VacuumSuctionPower vs VacuumSuctionPowerSmart)
   - No shared interface for mode settings
   - Duplicate helper function (`getSettingFromCleanMode`) across behaviors

6. **Fragmented Mode Configuration (Phase 7)**

   - Mode metadata scattered across multiple files:
     - `RvcCleanMode` maps (mode → label) in default.ts and smart.ts
     - `CleanSetting` maps (mode → settings) in default.ts and smart.ts
     - Mode options with tags in initialData.ts files
   - Risk of inconsistencies when mode numbers differ between files
   - Adding a mode requires updates in 4+ locations

7. **Duplicated Runtime Logic (Phase 7)**
   - `getCurrentCleanModeSmart` duplicates logic from `getCurrentCleanModeDefault`
   - Smart extends default by adding one check, but copies entire fallback logic
   - Reverse mapping (settings → mode) not aligned with forward mapping (mode → settings)

## Proposed Solution: Strategy Pattern with Registry

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Behavior Layer                         │
│  (default.ts, smart.ts)                                 │
│  - Uses ModeHandlerRegistry                             │
│  - Configures device-specific handlers                  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│            ModeHandlerRegistry                          │
│  - Maintains list of ModeHandler instances              │
│  - Routes mode changes to appropriate handler           │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              ModeHandler Interface                      │
│  - canHandle(mode, activity): boolean                   │
│  - handle(duid, mode, activity, context): Promise       │
└─────────────────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌──▼─────────┐ ┌▼──────────────┐
│ Cleaning     │ │ CleanMode  │ │ GoVacation    │
│ Handler      │ │ Handler    │ │ Handler       │
└──────────────┘ └────────────┘ └───────────────┘
```

## Implementation Plan

### Phase 1: Create Core Abstractions

#### 1.1 Create Handler Interface

**File:** `src/behaviors/roborock.vacuum/core/modeHandler.ts`

```typescript
export interface ModeHandler {
  canHandle(mode: number, activity: string): boolean;
  handle(duid: string, mode: number, activity: string, context: HandlerContext): Promise<void>;
}

export interface HandlerContext {
  roborockService: RoborockService;
  logger: AnsiLogger;
  cleanModeSettings?: CleanModeSettings;
  cleanSettings: Record<number, CleanModeSetting>;
  behaviorName: string;
}
```

#### 1.2 Create Registry

**File:** `src/behaviors/roborock.vacuum/core/modeHandlerRegistry.ts`

```typescript
export class ModeHandlerRegistry {
  private readonly handlers: ModeHandler[] = [];

  register(handler: ModeHandler): this {
    this.handlers.push(handler);
    return this;
  }

  async handle(duid: string, mode: number, activity: string, context: HandlerContext): Promise<void> {
    const handler = this.handlers.find(h => h.canHandle(mode, activity));
    if (handler) {
      await handler.handle(duid, mode, activity, context);
    } else {
      context.logger.notice(`${context.behaviorName}-changeToMode-Unknown:`, mode);
    }
  }
}
```

### Phase 2: Implement Specific Handlers

#### 2.1 Cleaning Mode Handler

**File:** `src/behaviors/roborock.vacuum/handlers/cleaningModeHandler.ts`

```typescript
export class CleaningModeHandler implements ModeHandler {
  canHandle(_mode: number, activity: string): boolean {
    return activity === 'Cleaning';
  }

  async handle(duid: string, _mode: number, activity: string, context: HandlerContext): Promise<void> {
    context.logger.notice(`${context.behaviorName}-ChangeRunMode to:`, activity);
    await context.roborockService.startClean(duid);
  }
}
```

#### 2.2 Go Vacation Handler

**File:** `src/behaviors/roborock.vacuum/handlers/goVacationHandler.ts`

```typescript
export class GoVacationHandler implements ModeHandler {
  canHandle(_mode: number, activity: string): boolean {
    return activity === 'Go Vacation';
  }

  async handle(duid: string, _mode: number, activity: string, context: HandlerContext): Promise<void> {
    context.logger.notice(`${context.behaviorName}-GoHome`);
    await context.roborockService.stopAndGoHome(duid);
  }
}
```

#### 2.3 Default Clean Mode Handler

**File:** `src/behaviors/roborock.vacuum/handlers/defaultCleanModeHandler.ts`

```typescript
export class DefaultCleanModeHandler implements ModeHandler {
  private readonly defaultModes = ['Mop & Vacuum: Default', 'Mop: Default', 'Vacuum: Default'];

  canHandle(_mode: number, activity: string): boolean {
    return this.defaultModes.includes(activity);
  }

  async handle(duid: string, mode: number, activity: string, context: HandlerContext): Promise<void> {
    const setting = context.cleanModeSettings
      ? (getSettingFromCleanMode(activity, context.cleanModeSettings) ?? context.cleanSettings[mode])
      : context.cleanSettings[mode];

    context.logger.notice(`${context.behaviorName}-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting ?? {})}`);

    if (setting) {
      await context.roborockService.changeCleanMode(duid, setting);
    }
  }
}
```

#### 2.4 Preset Clean Mode Handler

**File:** `src/behaviors/roborock.vacuum/handlers/presetCleanModeHandler.ts`

```typescript
export class PresetCleanModeHandler implements ModeHandler {
  private readonly presetModes = [
    'Mop & Vacuum: Quick', 'Mop & Vacuum: Max', 'Mop & Vacuum: Min', 'Mop & Vacuum: Quiet',
    'Mop: Max', 'Mop: Min', 'Mop: Quick', 'Mop: DeepClean',
    'Vacuum: Max', 'Vacuum: Min', 'Vacuum: Quiet', 'Vacuum: Quick'
  ];

  canHandle(_mode: number, activity: string): boolean {
    return this.presetModes.includes(activity);
  }

  async handle(duid: string, mode: number, activity: string, context: HandlerContext): Promise<void> {
    const setting = context.cleanSettings[mode];
    context.logger.notice(`${context.behaviorName}-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting ?? {})}`);

    if (setting) {
      await context.roborockService.changeCleanMode(duid, setting);
    }
  }
}
```

#### 2.5 Custom Clean Mode Handler

**File:** `src/behaviors/roborock.vacuum/handlers/customCleanModeHandler.ts`

```typescript
export class CustomCleanModeHandler implements ModeHandler {
  canHandle(_mode: number, activity: string): boolean {
    return activity === 'Mop & Vacuum: Custom';
  }

  async handle(duid: string, mode: number, activity: string, context: HandlerContext): Promise<void> {
    const setting = context.cleanSettings[mode];
    context.logger.notice(`${context.behaviorName}-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting)}`);
    await context.roborockService.changeCleanMode(duid, setting);
  }
}
```

#### 2.6 Smart Plan Handler (Smart devices only)

**File:** `src/behaviors/roborock.vacuum/handlers/smartPlanHandler.ts`

```typescript
export class SmartPlanHandler implements ModeHandler {
  canHandle(_mode: number, activity: string): boolean {
    return activity === 'Smart Plan';
  }

  async handle(duid: string, mode: number, activity: string, context: HandlerContext): Promise<void> {
    const setting = context.cleanSettings[mode];
    context.logger.notice(`${context.behaviorName}-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting)}`);
    await context.roborockService.changeCleanMode(duid, setting);
  }
}
```

### Phase 3: Extract Common Command Registration

#### 3.1 Create Common Commands Module

**File:** `src/behaviors/roborock.vacuum/core/commonCommands.ts`

```typescript
export function registerCommonCommands(
  duid: string,
  handler: BehaviorDeviceGeneric<any>,
  logger: AnsiLogger,
  roborockService: RoborockService,
  behaviorName: string
): void {
  handler.setCommandHandler(CommandNames.SELECT_AREAS, async (newAreas: number[] | undefined) => {
    logger.notice(`${behaviorName}-selectAreas: ${newAreas}`);
    roborockService.setSelectedAreas(duid, newAreas ?? []);
  });

  handler.setCommandHandler(CommandNames.PAUSE, async () => {
    logger.notice(`${behaviorName}-Pause`);
    await roborockService.pauseClean(duid);
  });

  handler.setCommandHandler(CommandNames.RESUME, async () => {
    logger.notice(`${behaviorName}-Resume`);
    await roborockService.resumeClean(duid);
  });

  handler.setCommandHandler(CommandNames.GO_HOME, async () => {
    logger.notice(`${behaviorName}-GoHome`);
    await roborockService.stopAndGoHome(duid);
  });

  handler.setCommandHandler(CommandNames.IDENTIFY, async () => {
    logger.notice(`${behaviorName}-identify`);
    await roborockService.playSoundToLocate(duid);
  });

  handler.setCommandHandler(CommandNames.STOP, async () => {
    logger.notice(`${behaviorName}-Stop`);
    await roborockService.stopClean(duid);
  });
}
```

### Phase 4: Create Behavior Configuration Factory

#### 4.1 Create Configuration Interface

**File:** `src/behaviors/roborock.vacuum/core/behaviorConfig.ts`

```typescript
export interface BehaviorConfig {
  name: string;
  cleanModes: Record<number, string>;
  cleanSettings: Record<number, CleanModeSetting>;
  registry: ModeHandlerRegistry;
}

export function createDefaultBehaviorConfig(): BehaviorConfig {
  const registry = new ModeHandlerRegistry()
    .register(new CleaningModeHandler())
    .register(new GoVacationHandler())
    .register(new DefaultCleanModeHandler())
    .register(new PresetCleanModeHandler())
    .register(new CustomCleanModeHandler());

  return {
    name: 'DefaultBehavior',
    cleanModes: RvcCleanMode,
    cleanSettings: CleanSetting,
    registry
  };
}

export function createSmartBehaviorConfig(): BehaviorConfig {
  const registry = new ModeHandlerRegistry()
    .register(new CleaningModeHandler())
    .register(new GoVacationHandler())
    .register(new SmartPlanHandler())  // Smart-specific handler
    .register(new DefaultCleanModeHandler())
    .register(new PresetCleanModeHandler())
    .register(new CustomCleanModeHandler());

  return {
    name: 'BehaviorSmart',
    cleanModes: RvcCleanMode,  // Smart extends default modes
    cleanSettings: CleanSetting,
    registry
  };
}
```

### Phase 5: Refactor Existing Files

#### 5.1 Update default.ts

**File:** `src/behaviors/roborock.vacuum/default/default.ts`

```typescript
import { createDefaultBehaviorConfig } from '../core/behaviorConfig.js';
import { registerCommonCommands } from '../core/commonCommands.js';

export function setDefaultCommandHandler(
  duid: string,
  handler: BehaviorDeviceGeneric<DefaultEndpointCommands>,
  logger: AnsiLogger,
  roborockService: RoborockService,
  cleanModeSettings: CleanModeSettings | undefined,
): void {
  const config = createDefaultBehaviorConfig();

  // Register CHANGE_TO_MODE with registry
  handler.setCommandHandler(CommandNames.CHANGE_TO_MODE, async (newMode: number) => {
    const activity = RvcRunMode[newMode] || config.cleanModes[newMode];
    const context: HandlerContext = {
      roborockService,
      logger,
      cleanModeSettings,
      cleanSettings: config.cleanSettings,
      behaviorName: config.name
    };
    await config.registry.handle(duid, newMode, activity, context);
  });

  // Register common commands
  registerCommonCommands(duid, handler, logger, roborockService, config.name);
}
```

#### 5.2 Update smart.ts

**File:** `src/behaviors/roborock.vacuum/smart/smart.ts`

```typescript
import { createSmartBehaviorConfig } from '../core/behaviorConfig.js';
import { registerCommonCommands } from '../core/commonCommands.js';

export function setCommandHandlerSmart(
  duid: string,
  handler: BehaviorDeviceGeneric<EndpointCommandsSmart>,
  logger: AnsiLogger,
  roborockService: RoborockService,
  cleanModeSettings: CleanModeSettings | undefined,
): void {
  const config = createSmartBehaviorConfig();

  // Register CHANGE_TO_MODE with registry
  handler.setCommandHandler(CommandNames.CHANGE_TO_MODE, async (newMode: number) => {
    const activity = RvcRunMode[newMode] || config.cleanModes[newMode];
    const context: HandlerContext = {
      roborockService,
      logger,
      cleanModeSettings,
      cleanSettings: config.cleanSettings,
      behaviorName: config.name
    };
    await config.registry.handle(duid, newMode, activity, context);
  });

  // Register common commands
  registerCommonCommands(duid, handler, logger, roborockService, config.name);
}
```

### Phase 6: Move Shared Utilities

#### 6.1 Extract getSettingFromCleanMode

**File:** `src/behaviors/roborock.vacuum/core/cleanModeUtils.ts`

Move `getSettingFromCleanMode` function from default.ts to a shared utility file.

### Phase 7: Refactor InitialData and Runtime Mode Resolution

This phase eliminates duplication in mode initialization and runtime mode detection by creating a single source of truth for all mode-related configuration.

#### 7.1 Create Unified Mode Configuration

**File:** `src/behaviors/roborock.vacuum/core/modeConfig.ts`

```typescript
import { RvcCleanMode } from 'matterbridge/matter/clusters';
import { CleanModeSetting } from '../default/default.js';

/**
 * Complete mode configuration including display name, settings, and Matter tags.
 */
export interface ModeConfig {
  mode: number;
  label: string;
  setting: CleanModeSetting;
  modeTags: { value: number }[];
}

/**
 * Base clean mode configurations shared across all device types.
 */
export const baseCleanModeConfigs: ModeConfig[] = [
  {
    mode: 5,
    label: 'Mop & Vacuum: Default',
    setting: { suctionPower: 102, waterFlow: 202, distance_off: 0, mopRoute: 300 },
    modeTags: [
      { value: RvcCleanMode.ModeTag.Mop },
      { value: RvcCleanMode.ModeTag.Vacuum },
      { value: RvcCleanMode.ModeTag.Auto }
    ]
  },
  {
    mode: 6,
    label: 'Mop & Vacuum: Quick',
    setting: { suctionPower: 102, waterFlow: 202, distance_off: 0, mopRoute: 304 },
    modeTags: [
      { value: RvcCleanMode.ModeTag.Mop },
      { value: RvcCleanMode.ModeTag.Vacuum },
      { value: RvcCleanMode.ModeTag.Quick }
    ]
  },
  // ... all other modes
];

/**
 * Smart device-specific mode configurations.
 */
export const smartCleanModeConfigs: ModeConfig[] = [
  {
    mode: 4,
    label: 'Smart Plan',
    setting: { suctionPower: 0, waterFlow: 0, distance_off: 0, mopRoute: 306 },
    modeTags: [
      { value: RvcCleanMode.ModeTag.Mop },
      { value: RvcCleanMode.ModeTag.Vacuum },
      { value: RvcCleanMode.ModeTag.Auto }
    ]
  },
  ...baseCleanModeConfigs
];

/**
 * Helper functions to extract different views of the configuration.
 */
export function getModeDisplayMap(configs: ModeConfig[]): Record<number, string> {
  return Object.fromEntries(configs.map(c => [c.mode, c.label]));
}

export function getModeSettingsMap(configs: ModeConfig[]): Record<number, CleanModeSetting> {
  return Object.fromEntries(configs.map(c => [c.mode, c.setting]));
}

export function getModeOptions(configs: ModeConfig[]): RvcCleanMode.ModeOption[] {
  return configs.map(c => ({
    mode: c.mode,
    label: c.label,
    modeTags: c.modeTags
  }));
}
```

#### 7.2 Refactor Runtime Mode Resolution

**File:** `src/behaviors/roborock.vacuum/core/modeResolver.ts`

```typescript
import { CleanModeSetting } from '../default/default.js';
import { ModeConfig } from './modeConfig.js';

/**
 * Resolve current clean mode from device settings using mode configurations.
 * Supports both default and smart device types through configuration injection.
 */
export class ModeResolver {
  private readonly settingsToModeMap: Map<string, number>;
  private readonly customCheckFn?: (setting: CleanModeSetting) => number | undefined;

  constructor(
    configs: ModeConfig[],
    customCheckFn?: (setting: CleanModeSetting) => number | undefined
  ) {
    // Build reverse lookup map: settings -> mode number
    this.settingsToModeMap = new Map(
      configs.map(c => [this.serializeSetting(c.setting), c.mode])
    );
    this.customCheckFn = customCheckFn;
  }

  /**
   * Determine current mode from device settings.
   */
  resolve(setting: CleanModeSetting): number | undefined {
    if (!setting || typeof setting !== 'object') {
      return undefined;
    }

    // Check custom mode logic first (e.g., smart mode detection)
    if (this.customCheckFn) {
      const customResult = this.customCheckFn(setting);
      if (customResult !== undefined) {
        return customResult;
      }
    }

    // Try exact match
    const serialized = this.serializeSetting(setting);
    const exactMatch = this.settingsToModeMap.get(serialized);
    if (exactMatch !== undefined) {
      return exactMatch;
    }

    // Fallback logic for partial matches
    return this.resolveFallback(setting);
  }

  private serializeSetting(setting: CleanModeSetting): string {
    return `${setting.suctionPower}:${setting.waterFlow}:${setting.mopRoute}`;
  }

  private resolveFallback(setting: CleanModeSetting): number | undefined {
    // Mop-only mode
    if (setting.suctionPower === 105) return 31; // 'Mop Default'

    // Vacuum-only mode
    if (setting.waterFlow === 200) return 66; // 'Vacuum Default'

    // Mop & Vacuum mode
    if (setting.suctionPower !== 105 && setting.waterFlow !== 200) return 5; // 'Mop & Vacuum Default'

    return undefined;
  }
}

/**
 * Create resolver for default devices.
 */
export function createDefaultModeResolver(configs: ModeConfig[]): ModeResolver {
  return new ModeResolver(
    configs,
    (setting) => {
      // Check for custom mode
      if (setting.suctionPower === 106 || setting.waterFlow === 204 || setting.mopRoute === 302) {
        return 10; // 'Mop & Vacuum: Custom'
      }
      return undefined;
    }
  );
}

/**
 * Create resolver for smart devices.
 */
export function createSmartModeResolver(configs: ModeConfig[]): ModeResolver {
  return new ModeResolver(
    configs,
    (setting) => {
      // Check for smart mode first
      if (setting.suctionPower === 110 || setting.waterFlow === 209 || setting.mopRoute === 306) {
        return 4; // 'Smart Plan'
      }
      // Check for custom mode
      if (setting.suctionPower === 106 || setting.waterFlow === 204 || setting.mopRoute === 302) {
        return 10; // 'Mop & Vacuum: Custom'
      }
      return undefined;
    }
  );
}
```

#### 7.3 Update default/initialData.ts

**File:** `src/behaviors/roborock.vacuum/default/initialData.ts`

```typescript
import { RvcRunMode } from 'matterbridge/matter/clusters';
import { baseCleanModeConfigs, getModeOptions } from '../core/modeConfig.js';
import { ExperimentalFeatureSetting } from '../../../model/ExperimentalFeatureSetting.js';

export function getDefaultSupportedRunModes(): RvcRunMode.ModeOption[] {
  return [
    {
      label: 'Idle',
      mode: 1,
      modeTags: [{ value: RvcRunMode.ModeTag.Idle }],
    },
    {
      label: 'Cleaning',
      mode: 2,
      modeTags: [{ value: RvcRunMode.ModeTag.Cleaning }],
    },
    {
      label: 'Mapping',
      mode: 3,
      modeTags: [{ value: RvcRunMode.ModeTag.Mapping }],
    },
  ];
}

export function getDefaultSupportedCleanModes(
  enableExperimentalFeature: ExperimentalFeatureSetting | undefined
): RvcCleanMode.ModeOption[] {
  const modes = getModeOptions(baseCleanModeConfigs);

  // Add vacation mode if enabled
  if (enableExperimentalFeature?.advancedFeature?.useVacationModeToSendVacuumToDock ?? false) {
    modes.push({
      label: 'Go Vacation',
      mode: 99,
      modeTags: [
        { value: RvcCleanMode.ModeTag.Mop },
        { value: RvcCleanMode.ModeTag.Vacuum },
        { value: RvcCleanMode.ModeTag.Vacation }
      ],
    });
  }

  return modes;
}
```

#### 7.4 Update smart/initialData.ts

**File:** `src/behaviors/roborock.vacuum/smart/initialData.ts`

```typescript
import { smartCleanModeConfigs, getModeOptions } from '../core/modeConfig.js';
import { getDefaultSupportedCleanModes } from '../default/initialData.js';
import { ExperimentalFeatureSetting } from '../../../model/ExperimentalFeatureSetting.js';

export function getSupportedCleanModesSmart(
  experimentalFeatureSetting: ExperimentalFeatureSetting | undefined
): RvcCleanMode.ModeOption[] {
  const smartModes = getModeOptions(smartCleanModeConfigs);

  // Add vacation mode if enabled
  if (experimentalFeatureSetting?.advancedFeature?.useVacationModeToSendVacuumToDock ?? false) {
    smartModes.push({
      label: 'Go Vacation',
      mode: 99,
      modeTags: [
        { value: RvcCleanMode.ModeTag.Mop },
        { value: RvcCleanMode.ModeTag.Vacuum },
        { value: RvcCleanMode.ModeTag.Vacation }
      ],
    });
  }

  return smartModes;
}
```

#### 7.5 Update default/runtimes.ts

**File:** `src/behaviors/roborock.vacuum/default/runtimes.ts`

```typescript
import { CleanModeSetting } from './default.js';
import { baseCleanModeConfigs } from '../core/modeConfig.js';
import { createDefaultModeResolver } from '../core/modeResolver.js';

const defaultResolver = createDefaultModeResolver(baseCleanModeConfigs);

export function getCurrentCleanModeDefault(setting: CleanModeSetting): number | undefined {
  return defaultResolver.resolve(setting);
}
```

#### 7.6 Update smart/runtimes.ts

**File:** `src/behaviors/roborock.vacuum/smart/runtimes.ts`

```typescript
import { CleanModeSetting } from '../default/default.js';
import { smartCleanModeConfigs } from '../core/modeConfig.js';
import { createSmartModeResolver } from '../core/modeResolver.js';

const smartResolver = createSmartModeResolver(smartCleanModeConfigs);

export function getCurrentCleanModeSmart(setting: CleanModeSetting): number | undefined {
  return smartResolver.resolve(setting);
}
```

#### 7.7 Benefits of Phase 7

1. **Single Source of Truth**

   - All mode metadata (number, label, settings, tags) defined in one place
   - Eliminates inconsistencies between command handlers, initializers, and resolvers

2. **Eliminates Duplication**

   - No more separate `RvcCleanMode` maps, `CleanSetting` maps, and mode option arrays
   - `getCurrentCleanModeSmart` no longer duplicates `getCurrentCleanModeDefault` logic

3. **Type Safety**

   - `ModeConfig` interface ensures all mode aspects are defined together
   - Impossible to have mismatched mode numbers between different files

4. **Easier Maintenance**

   - Adding a new mode requires updating only `modeConfig.ts`
   - All derived data structures (maps, options, resolvers) update automatically

5. **Better Testability**
   - Mode resolver can be unit tested with synthetic configurations
   - No need to mock multiple interconnected files

#### 7.8 File Structure After Phase 7

```
src/behaviors/roborock.vacuum/
├── core/
│   ├── modeHandler.ts              ← Handler interface
│   ├── modeHandlerRegistry.ts      ← Registry for routing mode changes
│   ├── commonCommands.ts           ← Shared command registration
│   ├── behaviorConfig.ts           ← Behavior configuration factory
│   ├── modeConfig.ts               ← NEW: Single source for mode metadata
│   ├── modeResolver.ts             ← NEW: Runtime mode detection
│   └── cleanModeUtils.ts           ← Shared utilities (getSettingFromCleanMode)
├── handlers/
│   ├── cleaningModeHandler.ts
│   ├── goVacationHandler.ts
│   ├── defaultCleanModeHandler.ts
│   ├── presetCleanModeHandler.ts
│   ├── customCleanModeHandler.ts
│   └── smartPlanHandler.ts
├── default/
│   ├── default.ts                  ← REFACTORED: Uses core infrastructure
│   ├── initialData.ts              ← REFACTORED: Uses modeConfig
│   └── runtimes.ts                 ← REFACTORED: Uses modeResolver
└── smart/
    ├── smart.ts                    ← REFACTORED: Uses core infrastructure
    ├── initialData.ts              ← REFACTORED: Uses modeConfig
    └── runtimes.ts                 ← REFACTORED: Uses modeResolver
```

## Implementation Steps

### Step 1: Create Core Infrastructure

1. Create `src/behaviors/roborock.vacuum/core/` directory
2. Implement `modeHandler.ts` (interface)
3. Implement `modeHandlerRegistry.ts`
4. Write unit tests for registry

### Step 2: Create Handlers

1. Create `src/behaviors/roborock.vacuum/handlers/` directory
2. Implement each handler (6 handlers total)
3. Write unit tests for each handler

### Step 3: Extract Common Commands

1. Implement `commonCommands.ts`
2. Write unit tests for common command registration

### Step 4: Create Configuration

1. Implement `behaviorConfig.ts`
2. Add factory functions for default and smart configs
3. Write unit tests for configurations

### Step 5: Refactor Existing Files

1. Update `default.ts` to use new infrastructure
2. Update `smart.ts` to use new infrastructure
3. Verify all existing tests still pass

### Step 6: Cleanup

1. Remove duplicate code
2. Move `getSettingFromCleanMode` to shared utils
3. Update documentation
4. Run full test suite

### Step 7: Refactor InitialData and Runtime Resolution

1. Create unified mode configuration in `modeConfig.ts`
2. Implement `ModeResolver` class in `modeResolver.ts`
3. Update `default/initialData.ts` to use shared config
4. Update `smart/initialData.ts` to use shared config
5. Update `default/runtimes.ts` to use resolver
6. Update `smart/runtimes.ts` to use resolver
7. Write unit tests for mode configuration and resolver
8. Verify all existing tests still pass

## Testing Strategy

### Unit Tests Required

1. **ModeHandlerRegistry Tests**

   - Registry can register handlers
   - Registry routes to correct handler
   - Registry handles unknown modes gracefully

2. **Individual Handler Tests**

   - Each handler correctly identifies its modes
   - Each handler calls correct service methods
   - Each handler logs appropriately

3. **Common Commands Tests**

   - All six commands are registered
   - Commands delegate to roborockService correctly
   - Commands log with correct behavior name

4. **Configuration Tests**

   - Default config includes correct handlers
   - Smart config includes SmartPlanHandler
   - Configs have correct mode mappings

5. **Integration Tests**

   - Default behavior works end-to-end
   - Smart behavior works end-to-end
   - Custom clean mode settings are applied correctly

6. **Mode Configuration Tests**

   - All mode configs have required properties
   - Mode numbers are unique
   - Helper functions generate correct maps and options

7. **Mode Resolver Tests**
   - Resolver finds exact matches for all configured modes
   - Resolver handles custom mode detection correctly
   - Smart resolver detects smart mode settings
   - Fallback logic works for partial matches
   - Invalid settings return undefined

### Test Files Structure

```
src/test/
  ├── behaviors/
  │   ├── core/
  │   │   ├── modeHandlerRegistry.test.ts
  │   │   ├── commonCommands.test.ts
  │   │   ├── behaviorConfig.test.ts
  │   │   ├── modeConfig.test.ts          ← NEW
  │   │   └── modeResolver.test.ts        ← NEW
  │   ├── handlers/
  │   │   ├── cleaningModeHandler.test.ts
  │   │   ├── goVacationHandler.test.ts
  │   │   ├── defaultCleanModeHandler.test.ts
  │   │   ├── presetCleanModeHandler.test.ts
  │   │   ├── customCleanModeHandler.test.ts
  │   │   └── smartPlanHandler.test.ts
  │   ├── default/
  │   │   ├── initialData.test.ts         ← UPDATED
  │   │   └── runtimes.test.ts            ← UPDATED
  │   ├── smart/
  │   │   ├── initialData.test.ts         ← UPDATED
  │   │   └── runtimes.test.ts            ← UPDATED
  │   └── integration/
  │       ├── defaultBehavior.test.ts
  │       └── smartBehavior.test.ts
```

## Benefits

### Immediate Benefits

- ✅ **85% less code duplication** - Six command handlers extracted to single location
- ✅ **Smaller functions** - Switch statement reduced from 50+ lines to ~10 lines
- ✅ **Better testability** - Each handler can be unit tested in isolation
- ✅ **Clear separation of concerns** - Mode resolution, logging, execution are decoupled
- ✅ **Single source of truth** - All mode metadata consolidated in one configuration file (Phase 7)
- ✅ **Consistent mode data** - Impossible to have mismatched mode numbers across files (Phase 7)

### Long-term Benefits

- ✅ **Easy to extend** - Add new modes by creating new handler class
- ✅ **Type-safe** - TypeScript ensures correct handler implementation
- ✅ **Maintainable** - Changes to one mode don't affect others
- ✅ **Reusable** - Handlers can be shared across device types
- ✅ **Observable** - Easy to add metrics, tracing, or debugging

### Future Extensibility

- Add new device types without modifying existing code
- Support device-specific mode variations through handler composition
- Enable runtime configuration of mode mappings
- Support A/B testing of different cleaning strategies

## Migration Risk Assessment

### Low Risk

- New code is additive, not modifying existing logic
- Existing tests will catch regression issues
- Changes can be rolled out incrementally

### Mitigation Strategies

1. Keep existing files during transition
2. Add comprehensive unit tests before refactoring
3. Use feature flags to gradually enable new code
4. Test with real devices in staging environment

## Timeline Estimate

- **Phase 1-2:** Core abstractions and handlers (2-3 days)
- **Phase 3-4:** Common commands and configuration (1-2 days)
- **Phase 5:** Refactor existing files (1 day)
- **Phase 6:** Cleanup and testing (1-2 days)
- **Phase 7:** Refactor initialData and runtimes (1-2 days)

**Total:** 6-10 days of development time

## Success Criteria

1. All existing unit tests pass
2. Code coverage remains ≥ current level
3. No behavioral changes in production
4. New unit tests for all handlers and core components
5. Documentation updated to reflect new architecture
6. At least 50% reduction in code duplication metrics
7. Single source of truth for all mode configurations (Phase 7)
8. Mode initialization and runtime resolution use shared configuration (Phase 7)
9. No duplicate mode metadata across files (Phase 7)

## Future Considerations

### Potential Enhancements

1. **Command queue** - Serialize mode changes to prevent race conditions
2. **Mode validation** - Validate mode transitions before execution
3. **Telemetry** - Add metrics for mode change frequency and success rates
4. **Caching** - Cache mode settings to reduce configuration lookups
5. **Event sourcing** - Log all mode changes for debugging and analytics

### Additional Refactoring Opportunities

1. Extract RoborockService method calls to command objects
2. Create builder pattern for HandlerContext
3. Add middleware support for cross-cutting concerns (logging, metrics, validation)
4. Implement undo/redo for mode changes
5. Add support for mode change animations or notifications

## References

- [Strategy Pattern - Refactoring Guru](https://refactoring.guru/design-patterns/strategy)
- [Registry Pattern - Martin Fowler](https://martinfowler.com/eaaCatalog/registry.html)
- [Clean Code Principles - Robert C. Martin](https://www.oreilly.com/library/view/clean-code-a/9780136083238/)
