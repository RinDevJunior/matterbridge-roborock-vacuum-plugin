# Architecture Migration Plan

**Version:** 1.0
**Created:** January 23, 2026
**Target:** Clean Architecture with improved modularity

---

## Overview

This migration plan transforms the current codebase into a cleaner, more maintainable architecture while preserving backward compatibility and maintaining test coverage above 95%.

### Goals

- Improve code organization and discoverability
- Reduce coupling between layers
- Make the codebase easier to test and extend
- Follow industry-standard naming conventions

### Principles

- **Incremental changes**: Each phase is independently deployable
- **No feature regression**: All existing functionality preserved
- **Backward compatible**: Maintain public API stability
- **Test-after-complete-migration**: Update unit test after completing phase 4

---

## Migration Phases

| Phase | Focus                              | Estimated Files | Risk   |
| ----- | ---------------------------------- | --------------- | ------ |
| 1     | Naming & Folder Cleanup            | ~30             | Low    |
| 2     | Platform Layer Extraction          | ~10             | Medium |
| 3     | Communication Layer Reorganization | ~40             | Medium |
| 4     | Domain & Ports Introduction        | ~20             | Low    |

---

## Phase 1: Naming & Folder Cleanup

**Goal:** Standardize naming conventions and folder structure

**Duration:** 1 session
**Risk:** Low
**Breaking Changes:** None (internal only)

### Strategy: Create New → Migrate During Phase 2

Instead of updating all imports in Phase 1, we take an incremental approach:

1. **Create** new folders with correct names
2. **Copy** files to new locations
3. **Keep** old folders intact and functional
4. **Update imports during Phase 2** - when refactoring other classes, update imports naturally
5. **Delete** old folders after Phase 2 cleanup

This reduces effort by avoiding two passes over the same files. Import updates happen organically during Phase 2 refactoring.

### Tasks

#### 1.1 Create new `models/` folder (keep `Zmodel/`)

```bash
mkdir -p src/roborockCommunication/models
```

**Steps:**

- [x] Create `models/` folder
- [x] Copy all files from `Zmodel/` to `models/`
- [x] Copy all files from `Zmodel/` to `models/` (do NOT create a barrel `index.ts`; use explicit file imports)
- [x] **Keep `Zmodel/` intact** - don't delete yet
- [x] **Keep `roborockCommunication/index.ts` unchanged** - still exports from `Zmodel/`

> **Note:** Do NOT create barrel `index.ts` files. Use explicit file-level imports (e.g. `import { Device } from './models/device.js'`).

#### 1.2 Create new `enums/` folder (keep `Zenum/`)

```bash
mkdir -p src/roborockCommunication/enums
```

**Steps:**

- [x] Create `enums/` folder
- [x] Copy all files from `Zenum/` to `enums/`
- [x] Copy all files from `Zenum/` to `enums/` (do NOT create a barrel `index.ts`; use explicit file imports)
- [x] **Keep `Zenum/` intact** - don't delete yet
- [x] **Keep `roborockCommunication/index.ts` unchanged** - still exports from `Zenum/`

> **Note:** Do NOT create barrel `index.ts` files. Use explicit file-level imports (e.g. `import { SomeEnum } from './enums/someEnum.js'`).

#### 1.3 Track remaining old imports (for Phase 2)

Before starting Phase 2, record how many files still use old paths:

```bash
# Count files with old imports (baseline for Phase 2)
grep -r "Zmodel" src/ --include="*.ts" | wc -l
grep -r "Zenum" src/ --include="*.ts" | wc -l
```

Baseline recorded: `Zmodel` = 79, `Zenum` = 36 (recorded 2026-01-23)

This count will decrease as you refactor files in Phase 2.

### Verification Checklist

- [ ] `npm run build` succeeds
- [ ] `npm run test` passes (959+ tests)
- [ ] `npm run lint` passes
- [ ] New folders contain identical files to old folders
- [ ] Old imports continue to work where compatibility aliases exist; prefer updating imports to explicit file paths during Phase 2

### Rollback Plan

```bash
# Simply delete the new folders (no other changes were made):
rm -rf src/roborockCommunication/models
rm -rf src/roborockCommunication/enums
```

---

## Phase 2: Platform Layer Extraction

**Goal:** Split `module.ts` into focused, single-responsibility modules + complete Phase 1 cleanup

**Duration:** 2-3 sessions
**Risk:** Medium
**Breaking Changes:** None (internal refactoring)

### Import Update Strategy (from Phase 1)

As you refactor files in this phase, update imports from old to new paths:

```typescript
// Before
import { Device } from '../Zmodel/device.js';

// After
import { Device } from '../models/device.js';

```

This happens naturally as you touch each file during refactoring.

### Current State

```
module.ts (500+ lines)
├── Platform lifecycle (onStart, onConfigure, onShutdown)
├── Device registration
├── Configuration handling
├── Authentication orchestration
└── State management
```

### Target State

```
src/
├── module.ts                      # Implementation (original)
├── module.updated.ts              # Migrated from module.ts. Thin entry point (~80 lines) ✓
└── platform/                      # ✓
  ├── platformLifecycle.ts       # Lifecycle methods ✓
  ├── deviceRegistry.ts          # Robot management ✓
  ├── platformConfig.ts          # Config validation ✓
  └── platformState.ts           # State management ✓
```

### Tasks

#### 2.1 Create platform folder structure ✓

```bash
mkdir -p src/platform
```

- [x] Platform folder created

#### 2.2 Extract DeviceRegistry ✓

```typescript
// src/platform/deviceRegistry.ts
export class DeviceRegistry {
  private robots: Map<string, RoborockVacuumCleaner> = new Map();
  private devices: Map<string, Device> = new Map();

  register(device: Device, robot: RoborockVacuumCleaner): void;
  unregister(duid: string): void;
  get(duid: string): RoborockVacuumCleaner | undefined;
  getAll(): RoborockVacuumCleaner[];
  clear(): void;
}
```

**Steps:**

- [x] Create `deviceRegistry.ts`
- [x] Copy robot/device Maps from `module.ts`
- [x] Update `module.updated.ts` to use DeviceRegistry
- [ ] Add unit tests (deferred)

#### 2.3 Extract PlatformConfig ✓

```typescript
// src/platform/platformConfig.ts
export class PlatformConfig {
  readonly whiteList: string[];
  readonly blackList: string[];
  readonly refreshInterval: number;
  readonly debug: boolean;
  readonly authentication: AuthPayload;
  readonly experimentalFeatures: ExperimentalFeatureSetting;

  static validate(config: unknown): PlatformConfig;
  isDeviceAllowed(duid: string): boolean;
}
```

**Steps:**

- [x] Create `platformConfig.ts`
- [x] Copy config logic from `module.ts`
- [x] Add validation logic
- [x] Wire to `module.updated.ts`
- [ ] Add unit tests (deferred)

#### 2.4 Extract PlatformLifecycle ✓

```typescript
// src/platform/platformLifecycle.ts
export class PlatformLifecycle {
  constructor(
    private platform: RoborockMatterbridgePlatform,
    private registry: DeviceRegistry,
    private config: PlatformConfig
  ) {}

  async onStart(reason?: string): Promise<void>;
  async onConfigure(): Promise<void>;
  async onShutdown(reason?: string): Promise<void>;
}
```

**Steps:**

- [x] Create `platformLifecycle.ts`
- [x] Copy lifecycle methods
- [x] Delegate from `module.updated.ts`
- [ ] Add integration tests (deferred)

#### 2.4.1 Extract PlatformState ✓

```typescript
// src/platform/platformState.ts
export class PlatformState {
  // State management for platform
}
```

**Steps:**

- [x] Create `platformState.ts`
- [x] Copy state logic from `module.ts`
- [x] Wire to `module.updated.ts`
- [ ] Add unit tests (deferred)

#### 2.5 Refactor module.ts ✓

**Status:** `module.updated.ts` created and wired to platform classes

```typescript
// src/module.updated.ts - After refactoring (~80 lines)
export default class RoborockMatterbridgePlatform extends MatterbridgeDynamicPlatform {
  private readonly registry: DeviceRegistry;
  private readonly config: PlatformConfig;
  private readonly lifecycle: PlatformLifecycle;

  constructor(matterbridge: Matterbridge, log: AnsiLogger, platformConfig: PlatformConfig) {
    super(matterbridge, log, platformConfig);
    this.config = PlatformConfig.validate(platformConfig);
    this.registry = new DeviceRegistry(log);
    this.lifecycle = new PlatformLifecycle(this, this.registry, this.config);
  }

  override async onStart(reason?: string) {
    return this.lifecycle.onStart(reason);
  }

  override async onConfigure() {
    return this.lifecycle.onConfigure();
  }

  override async onShutdown(reason?: string) {
    return this.lifecycle.onShutdown(reason);
  }

  // Public accessors for backward compatibility
  get robots() { return this.registry.robotsMap; }
  get devices() { return this.registry.devicesMap; }
}
```

#### 2.6 Phase 1 Cleanup (after refactoring complete)

After all Platform Layer refactoring is done, complete the Phase 1 migration:

**Steps:**

- [ ] Update any remaining imports from `Zmodel/` → `models/`
- [ ] Update any remaining imports from `Zenum/` → `enums/`
- [ ] Update remaining imports from `Zmodel/` → `models/` and `Zenum/` → `enums/` to use explicit file paths (do not add barrel files)
- [ ] Verify no old imports remain:
  ```bash
  grep -r "Zmodel" src/ --include="*.ts"
  grep -r "Zenum" src/ --include="*.ts"
  ```
- [ ] Delete old folders:
  ```bash
  rm -rf src/roborockCommunication/Zmodel
  rm -rf src/roborockCommunication/Zenum
  ```
- [ ] Final test run

Note: Avoid adding a new top-level barrel file. Update consuming files to import explicitly from the moved files, for example:

```
// Before
import { Device } from '../Zmodel/device.js'

// After
import { Device } from '../models/device.js'
```

If a small set of compatibility aliases are required temporarily, add single-file re-exports instead of full-folder barrels.

### Verification Checklist

- [ ] `module.updated.ts` reduced to <100 lines
- [ ] All lifecycle methods work correctly
- [ ] Device registration/unregistration works
- [ ] All tests pass
- [ ] Plugin works in Matterbridge
- [ ] No references to `Zmodel/` or `Zenum/` remain
- [ ] Old folders deleted

---

## Phase 3: Communication Layer Reorganization

**Goal:** Reorganize `roborockCommunication/` for better separation of concerns

**Duration:** 3-4 sessions
**Risk:** Medium
**Breaking Changes:** None (internal refactoring)
**Status:** File copying COMPLETED, import updates PENDING

### Current State (after Phase 2)

```

roborockCommunication/
├── RESTAPI/ # Mixed concerns
├── broadcast/ # MQTT + Local + Models + Listeners
├── builder/ # Protocol builders
├── helper/ # Mixed utilities
├── serializer/ # Protocol serializers
├── models/ # Data models (migrated in Phase 1-2)
└── enums/ # Enums (migrated in Phase 1-2)

```

### Target State

```

roborockCommunication/
├── api/ # REST API clients ✓
│ ├── authClient.ts # Authentication API ✓
│ ├── iotClient.ts # IoT API ✓
│ (use explicit file imports)
├── mqtt/ # MQTT communication ✓
│ ├── mqttClient.ts ✓
│ ├── messageProcessor.ts ✓
│ (use explicit file imports)
├── local/ # Local network communication ✓
│ ├── localClient.ts ✓
│ ├── udpClient.ts ✓
│ (use explicit file imports)
├── protocol/ # Protocol handling ✓
│ ├── serializers/ ✓
│ ├── builders/ ✓
│ ├── deserializers/ ✓
│ (use explicit file imports)
├── routing/ # Message routing ✓
│ ├── clientRouter.ts ✓
│ ├── listeners/ ✓
│ (use explicit file imports)
├── models/ # Data models (from Phase 1)
├── enums/ # Enums (from Phase 1)
└── (no top-level barrel; use explicit imports)

```

### Tasks

#### 3.1 Create new folder structure ✓

```bash
mkdir -p src/roborockCommunication/{api,mqtt,local,protocol,routing}
mkdir -p src/roborockCommunication/protocol/{serializers,builders,deserializers}
mkdir -p src/roborockCommunication/routing/listeners
```

#### 3.2 Copy REST API files ✓

```
RESTAPI/roborockAuthenticateApi.ts → api/authClient.ts
RESTAPI/roborockIoTApi.ts → api/iotClient.ts
```

**Steps:**

- [x] Create `api/` folder
- [x] Copy and rename files
- [ ] Update imports
- [ ] Do NOT create a barrel export; update imports explicitly to file paths
- [ ] Update tests

#### 3.3 Copy MQTT files ✓

```
broadcast/client/MQTTClient.ts → mqtt/mqttClient.ts
broadcast/messageProcessor.ts → mqtt/messageProcessor.ts
```

**Steps:**

- [x] Create `mqtt/` folder
- [x] Copy files
- [ ] Update imports
- [ ] Do NOT create a barrel export; update imports explicitly to file paths
- [ ] Update tests

#### 3.4 Copy Local network files ✓

```
broadcast/client/LocalNetworkClient.ts → local/localClient.ts
broadcast/client/LocalNetworkUDPClient.ts → local/udpClient.ts
```

**Steps:**

- [x] Create `local/` folder
- [x] Copy files
- [ ] Update imports
- [ ] Do NOT create a barrel export; update imports explicitly to file paths
- [ ] Update tests

#### 3.5 Consolidate protocol handling ✓

```
serializer/*.ts → protocol/serializers/
builder/*.ts → protocol/builders/
helper/messageDeserializer.ts → protocol/deserializers/
helper/messageSerializer.ts → protocol/serializers/
```

**Steps:**

- [x] Create `protocol/` subfolders
- [x] Copy serializers
- [x] Copy builders
- [x] Copy deserializers
- [ ] Do NOT create barrel exports; update imports to explicit file paths
- [ ] Update all imports

#### 3.6 Copy routing module ✓

```
broadcast/clientRouter.ts → routing/clientRouter.ts
broadcast/listener/ → routing/listeners/
broadcast/abstractClient.ts → routing/abstractClient.ts
```

**Steps:**

- [x] Create `routing/` folder
- [x] Copy routing files
- [x] Copy listeners
- [ ] Update imports
- [ ] Do NOT create barrel exports; update imports to explicit file paths

#### 3.7 Top-level exports and deprecation aliases

Do NOT create a new top-level barrel `index.ts`. Prefer explicit imports across the codebase. If a short-lived compatibility alias is required, add single-file re-exports (for example a single `broadcast/compat.ts`) rather than full-folder barrel files.

Example (explicit import):

```ts
import { MQTTClient } from './roborockCommunication/mqtt/mqttClient.js'

export { MQTTClient } from '../mqtt/mqttClient.js';

```

### Verification Checklist

- [ ] All imports updated
- [ ] All tests pass
- [ ] No circular dependencies
- [ ] Plugin works in Matterbridge
- [ ] Build size similar or smaller

---

## Phase 4: Domain & Ports Introduction

**Goal:** Introduce domain models and port interfaces for better abstraction

**Duration:** 2-3 sessions
**Risk:** Low
**Breaking Changes:** None (additive only)

### Target Structure

```

src/
├── core/ # NEW - Domain layer
│ ├── domain/
│ │ ├── entities/
│ │ │ ├── Device.ts
│ │ │ ├── Home.ts
│ │ │ ├── Room.ts
│ │ │ └── (no index.ts — use explicit imports)
│ │ └── value-objects/
│ │ ├── DeviceId.ts
│ │ ├── CleanMode.ts
│ │ └── (no index.ts — use explicit imports)
│ └── ports/
│ ├── IDeviceGateway.ts
│ ├── IAuthGateway.ts
│ ├── IMessageBroker.ts
│ └── (no index.ts — use explicit imports)
└── ... (existing structure)

```

### Tasks

#### 4.1 Create core domain entities

```typescript
// src/core/domain/entities/Device.ts
export interface DeviceEntity {
  readonly duid: string;
  readonly name: string;
  readonly model: string;
  readonly localKey: string;
  readonly status: DeviceStatus;
  readonly name: string;
  readonly devices: DeviceEntity[];
  readonly rooms: RoomEntity[];
}
```

**Steps:**

- [x] Create `core/domain/entities/` folder
- [x] Define Device entity
- [x] Define Home entity
- [x] Define Room entity
- [x] Do NOT create barrel exports; use explicit file exports/imports

#### 4.2 Create value objects

```typescript
// src/core/domain/value-objects/DeviceId.ts
export class DeviceId {
  private constructor(private readonly value: string) {}

  static create(duid: string): DeviceId {
    if (!duid || duid.length < 5) {
      throw new ValidationError('Invalid device ID');
    }
    return new DeviceId(duid);
  }

  toString(): string {
    return this.value;
  }
}
  static readonly Mop = new CleanMode('mop');
  static readonly VacuumAndMop = new CleanMode('vacuum_and_mop');

  private constructor(readonly value: string) {}
}
```

**Steps:**

- [x] Create `core/domain/value-objects/` folder
- [x] Define DeviceId value object
- [x] Define CleanMode value object
- [ ] Add unit tests

#### 4.3 Define port interfaces

```typescript
// src/core/ports/IDeviceGateway.ts
export interface IDeviceGateway {
  sendCommand(deviceId: string, command: DeviceCommand): Promise<void>;
  getStatus(deviceId: string): Promise<DeviceStatus>;
  subscribe(deviceId: string, callback: StatusCallback): () => void;
}

// src/core/ports/IAuthGateway.ts
export interface IAuthGateway {
  requestVerificationCode(email: string): Promise<void>;
  authenticate(email: string, code: string): Promise<UserData>;
  refreshToken(userData: UserData): Promise<UserData>;
  disconnect(): Promise<void>;
  publish(topic: string, message: Buffer): Promise<void>;
  subscribe(topic: string, handler: MessageHandler): () => void;
}
```

**Steps:**

- [x] Create `core/ports/` folder
- [x] Define IDeviceGateway
- [x] Define IAuthGateway
- [x] Define IMessageBroker
- [x] Do NOT create barrel exports; use explicit file exports/imports

#### 4.4 Implement port adapters (gradual)

```typescript
// src/roborockCommunication/adapters/RoborockDeviceGateway.ts
export class RoborockDeviceGateway implements IDeviceGateway {
  constructor(
    private readonly clientRouter: ClientRouter,
    private readonly messageProcessor: MessageProcessor
    await this.clientRouter.send(deviceId, command.toRequest());
  }
```

- [ ] Inject adapters in ServiceContainer
- [ ] Gradually migrate services to use ports
- [ ] Add integration tests

### Verification Checklist

- [ ] At least one adapter implemented
- [ ] All tests pass
- [ ] Documentation updated

## Post-Migration Tasks

### Documentation Updates

- [ ] Add architecture decision records (ADRs)

### Code Quality

- [ ] Run full lint check
- [ ] Update ESLint rules if needed
- [ ] Verify no circular dependencies

### Performance Verification

- [ ] Compare build times
- [ ] Compare bundle size
- [ ] Test startup time in Matterbridge

---

## Rollback Strategy

Each phase can be rolled back independently:

```bash
# View migration commits
git log --oneline --grep="migration"

# Rollback specific phase
git revert <commit-range>

# Or reset to pre-migration state
```

### Phase Dependencies

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
  │            │           │
  └── Can be   └── Can be  └── Can be
      reverted     reverted    reverted
      alone        alone       alone
```

---

## Success Metrics

| Metric                | Before   | Target     |
| --------------------- | -------- | ---------- |
| `module.ts` lines     | 500+     | <100       |
| Test coverage         | 95%+     | 95%+       |
| Circular dependencies | ?        | 0          |
| Build time            | baseline | ≤ baseline |
| Files with >300 lines | ?        | ≤ 5        |

---

## Timeline Estimate

| Phase     | Estimation      |
| --------- | --------------- |
| Phase 2   | 3-4 hours       |
| Phase 3   | 4-6 hours       |
| Phase 4   | 2-3 hours       |
| **Total** | **10-15 hours** |

---

## Notes

- Each phase should be completed in a separate branch
- Create PR for each phase with full test coverage
- Get code review before merging
- Tag releases after each phase: `v1.1.3-migration-phase-N`
