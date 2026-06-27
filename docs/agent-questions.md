## Task
Identify all major business areas in the codebase so we can write one wiki page per domain.
We already have docs for: authentication flow, status update flow, room/map sync flow, and a high-level code structure overview.
We need to discover every remaining business domain with enough detail to describe its purpose, entry point, main actors, and data models.

## Questions

### Q1
What is the exact startup/initialization sequence?
Specifically: what happens inside `module.ts` `onStart()`, `onConfigure()`, and `onShutdown()`?
List every major action in order (e.g., "creates ServiceContainer", "calls discoverDevices", "registers device with Matterbridge", etc.) and which class/method is responsible for each step.
Relevant area: `src/module.ts`, `src/platform/deviceDiscovery.ts`, `src/platform/deviceConfigurator.ts`

### Q2
What is the device command execution flow?
When Apple Home (or any Matter controller) sends a command (e.g., "start cleaning", "pause", "dock", "change clean mode"), what is the full call chain from the Matter cluster handler down to the MQTT/local packet? Include:
- Which behavior class/handler receives the Matter command
- How `CleanCommand` / `CleanSelection` discriminated unions are used
- How `RoborockService` or `MessageRoutingService` converts the command to a Roborock protocol message
- Which protocol (V1/B01/Q7/Q10) and request code is used for each command type
Relevant area: `src/behaviors/`, `src/runtimes/`, `src/services/messageRoutingService.ts`, `src/roborockCommunication/`

### Q3
What are all the clean modes and how is the "clean mode" business domain structured?
List:
- All supported clean modes (vacuum only, mop only, vac+mop, smart plan, vac-followed-by-mop, etc.) with their numeric IDs
- The `CleanModeConfig` type shape (fields in `types.ts` inside `cleanModeConfig/`)
- How `deviceCapabilityRegistry.ts` decides which modes a device supports (model string vs feature flags)
- How `getSupportedCleanModes.ts` (in `initialData/`) maps device modes to Matter `RvcCleanMode` cluster entries
- How `cleanModeHandler.ts` (in `runtimes/handlers/`) applies a mode change to Matter cluster attributes
Relevant area: `src/behaviors/roborock.vacuum/core/cleanModeConfig/`, `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts`, `src/initialData/getSupportedCleanModes.ts`, `src/runtimes/handlers/cleanModeHandler.ts`

### Q4
What is the MQTT / local-network communication domain?
Describe:
- How `ClientRouter` decides between MQTT and local (what criteria?)
- How the MQTT connection is established (broker URL, TLS, credentials, topic structure)
- How the local UDP discovery works (`udpClient.ts`) and what "local network client" means
- How `ConnectionService` and `ClientManager` manage multiple device connections
- The message lifecycle: serialization → send → receive → deserialization → dispatch to listeners
- How reconnection / keepalive is handled
Relevant area: `src/roborockCommunication/mqtt/`, `src/roborockCommunication/local/`, `src/roborockCommunication/routing/clientRouter.ts`, `src/services/connectionService.ts`, `src/services/clientManager.ts`

### Q5
What is the Roborock protocol domain (wire format)?
Describe:
- The message structure for each protocol version (L01, A01, B01, V01): header fields, body layout, encryption
- What "Q7", "Q10", "V10" dispatcher names mean and how `protocolCalculator.ts` picks a dispatcher
- How `cryptoHelper.ts` is used (what keys, what algorithm)
- The DPS (data point) key scheme — what `dps` is and how it maps to message fields
- How `messageDeserializer.ts` works at a high level
Relevant area: `src/roborockCommunication/protocol/`, `src/roborockCommunication/helper/cryptoHelper.ts`, `src/roborockCommunication/models/dps.ts`

### Q6
What is the device discovery and filtering domain?
Describe:
- How `deviceDiscovery.ts` fetches devices from the Roborock cloud API
- What "home data" is (the `Home` entity, its structure, how it relates to devices and rooms)
- How whitelist/blacklist filtering works (config fields, which function applies them)
- How unsupported device models are excluded
- How `DeviceRegistry` stores the result and what "robot" vs "device" means in that registry
Relevant area: `src/platform/deviceDiscovery.ts`, `src/platform/deviceRegistry.ts`, `src/roborockCommunication/api/iotClient.ts`, `src/roborockCommunication/models/home.ts`

### Q7
What is the Matterbridge device registration domain?
Describe:
- What a "robot" is in `DeviceRegistry` context (is it a `MatterbridgeDevice`/endpoint?)
- How `deviceConfigurator.ts` creates and registers a device with Matterbridge
- Which Matter clusters are added to each device endpoint and why (RvcRunMode, RvcCleanMode, RvcOperationalState, PowerSource, ServiceArea)
- How `BehaviorDeviceGeneric` and `behaviorFactory.ts` configure cluster defaults and command handlers
- How `RoborockVacuumCleaner` (from `types/roborockVacuumCleaner.ts`) relates to the Matterbridge endpoint
Relevant area: `src/platform/deviceConfigurator.ts`, `src/behaviors/BehaviorDeviceGeneric.ts`, `src/share/behaviorFactory.ts`, `src/types/roborockVacuumCleaner.ts`

### Q8
What is the polling and real-time connection management domain?
Describe:
- How `PollingService` schedules polls — what timer intervals exist and which config fields control them
- What "burst polling" is: how `BurstPollingManager` works, when it starts/stops, what frequency it uses
- The "watchdog" logic: when cloud polling is triggered vs skipped (the `hasRealTimeConnection` + `lastUpdateAt` check)
- How `platformRunner.ts` `requestHomeData()` fetches and dispatches home data
- The relationship between real-time push (MQTT/local) and the polling fallback
Relevant area: `src/services/pollingService.ts`, `src/platformRunner.ts`, `src/platform/deviceRegistry.ts` (for `lastUpdateAt`/`hasRealTimeConnection`)

### Q9
What is the scene / routine domain?
Describe:
- What Roborock "scenes" are (the `scene.ts` model) and how they differ from room cleaning
- How `getSupportedRoutines.ts` maps scenes to Matter `ServiceArea.Area` entries
- How a routine is triggered from Matter (is it a special `CleanCommand`/`CleanSelection` variant?)
- Whether scenes are editable/configurable from the plugin or read-only
Relevant area: `src/roborockCommunication/models/scene.ts`, `src/initialData/getSupportedRoutines.ts`, `src/model/CleanCommand.ts`

### Q10
What is the error handling and error reporting domain?
Describe:
- The `VacuumStatus`/`VacuumErrorCode` → `RvcOperationalState.ErrorState` mapping (full table if available)
- How `DockStationStatus` bit-fields map to dock errors
- How `errorStateHandler.ts` updates the Matter cluster on error
- How errors are surfaced to the user (logs, email notifications, Matter error states)
- How `emailNotificationService.ts` works and when it fires
Relevant area: `src/model/VacuumStatus.ts`, `src/model/DockStationStatus.ts`, `src/runtimes/handlers/errorStateHandler.ts`, `src/services/emailNotificationService.ts`

### Q11
What is the configuration domain?
Describe:
- All top-level config sections in `RoborockPluginPlatformConfig` (authentication, pluginConfiguration, advancedFeature) and every notable field in each
- What `MatterOverrideSettings`, `CleanModeSettings`, `EmailNotificationSettings` contain
- How `platformConfig.ts` (`PlatformConfigManager`) validates and exposes config
- The JSON schema file (if any) that defines the config shape for the Matterbridge UI
- What `clearStorageOnStartup` does and when it's used
Relevant area: `src/model/RoborockPluginPlatformConfig.ts`, `src/platform/platformConfig.ts`, project root schema file (e.g. `matterbridge-roborock-vacuum-plugin.schema.json` or similar)

### Q12
What is the CLI tool domain?
Describe:
- The full list of CLI commands and what each does at the business level
- How the CLI authenticates (does it reuse `AuthenticationService` or have its own path?)
- How the CLI connects to a device (reuses `ClientRouter`?)
- What the CLI session file contains and where it is stored
- Primary use case: is it for end users, developers, or debugging?
Relevant area: `src/cli/`, `src/cli/main.ts`, `src/cli/session.ts`, `src/cli/connection.ts`

### Q13
Are there any other business areas not yet covered?
Scan the following and report anything not captured by Q1–Q12:
- `src/initialData/` — any fetchers not yet mentioned
- `src/share/stateResolver.ts` and `src/share/matterStateNames.ts` — what do they do?
- `src/share/filterLogger.ts` — how sensitive data filtering works
- `src/runtimes/handleHomeDataMessage.ts`, `handleCloudMessage.ts`, `handleLocalMessage.ts` — top-level logic of each
- `src/roborockCommunication/models/dockInfo.ts` — what is dock info?
- Any domain in the tests that implies a business area not yet captured
Relevant area: `src/initialData/`, `src/share/`, `src/runtimes/`, `src/roborockCommunication/models/`

## Status
pending
