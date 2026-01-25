# Current Architecture

This document tracks the current folder structure. During migration, folders will be marked as `(deprecated)` to indicate they should be deleted after migration is complete.

## Migration Status Legend

- **Active** - Current production code
- **(deprecated)** - Scheduled for removal after migration
- **(new)** - Newly created during migration

---

## Source Structure (`src/`)

```
src/
├── module.ts                          # Active - Platform entry point
├── platformRunner.ts                  # Active - Platform runtime
├── roborockService.ts                 # Active - Main service facade
├── roborockVacuumCleaner.ts           # Active - Device representation
├── helper.ts                          # Active - Utility functions
│
├── behaviors/                         # Active - Device behavior implementations
│   └── roborock.vacuum/
│       ├── default/
│       │   └── default.ts
│       └── smart/
│           └── smart.ts
│       └── BehaviorDeviceGeneric.ts
│
├── constants/                         # Active - Application constants
│   ├── index.ts
│   └── timeouts.ts
│
├── errors/                            # Active - Custom error types
│   └── index.ts
│
├── initialData/                       # Active - Initial/static data
│   ├── index.ts
│   ├── regionUrls.ts
│   ├── supportedAreas.ts
│   ├── supportedScenes.ts
│   └── supportedVacuums.ts
│
├── model/                             # Active - Application models
│   ├── ExperimentalFeatureSetting.ts
│   └── PluginConfig.ts
│
├── roborockCommunication/             # Active - Communication layer
│   │
│   ├── index.ts                       # Active - Module exports
│   │
│   ├── RESTAPI/                       # Active - REST API clients
│   │   ├── roborockAuthenticateApi.ts
│   │   └── roborockIoTApi.ts
│   │
│   ├── Zenum/                         # (deprecated) → enums/
│   │   ├── cleaningMode.ts
│   │   ├── deviceStatus.ts
│   │   ├── errorCode.ts
│   │   ├── fanSpeed.ts
│   │   ├── mapFlag.ts
│   │   ├── mopMode.ts
│   │   ├── mopRoute.ts
│   │   ├── protocol.ts
│   │   ├── state.ts
│   │   └── waterLevel.ts
│   │
│   ├── Zmodel/                        # (deprecated) → models/
│   │   ├── apiResponse.ts
│   │   ├── deviceStatusNotify.ts
│   │   ├── homeData.ts
│   │   ├── loginData.ts
│   │   ├── roborockMessage.ts
│   │   ├── scene.ts
│   │   ├── userData.ts
│   │   └── verificationCodeResponse.ts
│   │
│   ├── broadcast/                     # Active - Real-time communication
│   │   ├── abstractClient.ts
│   │   ├── clientRouter.ts
│   │   │
│   │   ├── client/                    # Active - Client implementations
│   │   │   ├── LocalNetworkClient.ts
│   │   │   ├── LocalNetworkUDPClient.ts
│   │   │   └── MQTTClient.ts
│   │   │
│   │   ├── handler/                   # Active - Message handlers
│   │   │   ├── connectionListenerHandler.ts
│   │   │   └── messageListenerHandler.ts
│   │   │
│   │   ├── listener/                  # Active - Event listeners
│   │   │   ├── baseMessageListener.ts
│   │   │   └── implementation/
│   │   │       ├── chainedConnectionListener.ts
│   │   │       ├── pingResponseListener.ts
│   │   │       └── syncMessageListener.ts
│   │   │
│   │   └── model/                     # Active - Communication models
│   │       ├── contentMessage.ts
│   │       ├── messageContext.ts
│   │       ├── requestMessage.ts
│   │       ├── responseBody.ts
│   │       └── responseMessage.ts
│   │
│   ├── builder/                       # Active - Message builders
│   │   ├── localMessageBuilder.ts
│   │   └── mqttMessageBuilder.ts
│   │
│   ├── helper/                        # Active - Communication helpers
│   │   ├── cryptoHelper.ts
│   │   ├── messageDeserializer.ts
│   │   ├── messageSerializer.ts
│   │   ├── messageSerializerFactory.ts
│   │   └── nameDecoder.ts
│   │
│   └── serializer/                    # Active - Protocol serializers
│       ├── A01Serializer.ts
│       ├── B01Serializer.ts
│       ├── L01Serializer.ts
│       ├── Serializer.ts
│       └── V01Serializer.ts
│
├── runtimes/                          # Active - Message processing runtimes
│   ├── handleCloudMessage.ts
│   ├── handleHomeDataMessage.ts
│   └── handleLocalMessage.ts
│
├── services/                          # Active - Application services
│   ├── areaManagementService.ts
│   ├── authenticationService.ts
│   ├── clientManager.ts
│   ├── connectionService.ts
│   ├── deviceManagementService.ts
│   ├── messageRoutingService.ts
│   ├── pollingService.ts
│   └── serviceContainer.ts
│
├── share/                             # Active - Shared utilities
│   └── function.ts
│
├── tests/                             # Active - Test files (mirrors src structure)
│   └── ... (test files)
│
└── types/                             # Active - TypeScript type definitions
    └── matterbridge.d.ts
```

---

## Migration Tracking

### Phase 1: Naming & Folder Cleanup

| Old Path                            | New Path                            | Status  |
| ----------------------------------- | ----------------------------------- | ------- |
| `src/roborockCommunication/Zmodel/` | `src/roborockCommunication/models/` | Pending |
| `src/roborockCommunication/Zenum/`  | `src/roborockCommunication/enums/`  | Pending |
| `src/tests/.../Zmodel/`             | `src/tests/.../models/`             | Pending |
| `src/tests/.../Zenum/`              | `src/tests/.../enums/`              | Pending |

### Phase 2: Platform Layer Extraction

| Action   | Path                                | Status  |
| -------- | ----------------------------------- | ------- |
| Extract  | `src/platform/platformPlugin.ts`    | Pending |
| Extract  | `src/platform/platformConfig.ts`    | Pending |
| Extract  | `src/platform/platformLifecycle.ts` | Pending |
| Refactor | `src/module.ts` (thin facade)       | Pending |

### Phase 3: Communication Layer Reorganization

| Old Path                                | New Path                            | Status  |
| --------------------------------------- | ----------------------------------- | ------- |
| `src/roborockCommunication/RESTAPI/`    | `src/infrastructure/api/`           | Pending |
| `src/roborockCommunication/broadcast/`  | `src/infrastructure/clients/`       | Pending |
| `src/roborockCommunication/serializer/` | `src/infrastructure/serialization/` | Pending |

### Phase 4: Domain & Ports Introduction

| Action | Path                       | Status  |
| ------ | -------------------------- | ------- |
| Create | `src/domain/entities/`     | Pending |
| Create | `src/domain/valueObjects/` | Pending |
| Create | `src/ports/inbound/`       | Pending |
| Create | `src/ports/outbound/`      | Pending |

---

## Cleanup Script

After each migration phase is complete, run this command to find deprecated folders:

```bash
# Find all folders marked as deprecated in this document
grep -E "\(deprecated\)" docs/architecture.md | grep -oE "src/[^ ]*"
```

After verifying tests pass and the new structure works:

```bash
# Example: Remove deprecated Zmodel folder after Phase 1
rm -rf src/roborockCommunication/Zmodel
rm -rf src/roborockCommunication/Zenum
rm -rf src/tests/roborockCommunication/Zmodel
rm -rf src/tests/roborockCommunication/Zenum
```

---

## Notes

- Always run `npm run build && npm test` before and after deleting deprecated folders
- Update this document after each migration step
- Keep deprecated folders until all imports are migrated and tests pass
