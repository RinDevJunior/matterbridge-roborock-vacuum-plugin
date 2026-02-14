# Matterbridge Roborock Vacuum Plugin - Code Structure

**Version:** 1.1.3-rc03
**Last Updated:** January 30, 2026
**Test Coverage:** 95.74% (959+ tests passed)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Patterns](#architecture-patterns)
3. [Dependency Tree](#dependency-tree)
4. [Directory Structure](#directory-structure)
5. [Core Components](#core-components)
6. [Platform Layer](#platform-layer)
7. [Core Domain Layer](#core-domain-layer)
8. [Service Layer](#service-layer)
9. [Communication Layer](#communication-layer)
10. [Behavior System](#behavior-system)
11. [Data Flow](#data-flow)
12. [Key Design Patterns](#key-design-patterns)
13. [Testing Strategy](#testing-strategy)

---

## Overview

This plugin integrates Roborock vacuum cleaners into the Matter ecosystem via Matterbridge. It enables control through Apple Home and other Matter-compatible applications.

**Key Technologies:**

- TypeScript 5.x targeting ESNext
- Matterbridge 3.5.3
- Vitest for unit testing
- MQTT for real-time device communication
- REST API for Roborock cloud services

**Main Entry Point:** [src/module.ts](../src/module.ts)

---

## Architecture Patterns

### 1. **Layered Architecture**

```
┌─────────────────────────────────────────┐
│   Matter Protocol Layer (Matterbridge)  │
├─────────────────────────────────────────┤
│   Platform Layer (module.ts + platform/)│
├─────────────────────────────────────────┤
│   Service Layer (services/)             │
├─────────────────────────────────────────┤
│   Core Domain Layer (core/)             │
├─────────────────────────────────────────┤
│   Behavior Layer (behaviors/)           │
├─────────────────────────────────────────┤
│   Communication Layer (roborockComm/)   │
├─────────────────────────────────────────┤
│   Roborock IoT Platform                 │
└─────────────────────────────────────────┘
```

### 2. **Hexagonal Architecture (Ports & Adapters)**

- **Ports:** Interfaces in `core/ports/` (IDeviceGateway, IAuthGateway)
- **Adapters:** Implementations in `roborockCommunication/adapters/`
- Clear separation between domain logic and infrastructure

### 3. **Dependency Injection**

- `services/ServiceContainer` manages service lifecycle
- `core/ServiceContainer` manages port adapters
- Services are lazy-loaded singletons
- Facilitates testing and modularity

### 4. **Facade Pattern**

- `RoborockService` acts as facade over specialized services
- Maintains backward compatibility
- Reduced from 923 lines to ~300 lines

---

## Dependency Tree

This tree visualizes the dependency flow starting from `src/module.ts` and reflects the latest code structure:

```
src/module.ts (RoborockMatterbridgePlatform)
│
├── Platform Layer (platform/)
│   ├── platformConfig.ts         # Validates and manages plugin configuration
│   ├── deviceRegistry.ts         # Stores registered devices and robots
│   ├── platformState.ts          # Tracks platform and startup state
│   └── platformLifecycle.ts      # Manages onStart, onConfigure, onShutdown
│
├── platformRunner.ts             # Orchestrates device updates and message routing
│   └── uses: runtimes/
│       ├── handleLocalMessage.ts
│       ├── handleCloudMessage.ts
│       └── handleHomeDataMessage.ts
│
├── services/ (Service Layer)
│   ├── serviceContainer.ts       # Main DI container for services
│   ├── roborockService.ts        # Service facade
│   ├── authenticationService.ts
│   ├── deviceManagementService.ts
│   ├── areaManagementService.ts
│   ├── messageRoutingService.ts
│   ├── pollingService.ts
│   ├── connectionService.ts
│   └── clientManager.ts          # Manages MQTT client instances
│
├── core/ (Core Domain Layer)
│   ├── ServiceContainer.ts       # Port adapter DI container
│   ├── application/              # Application layer
│   │   └── models/               # Application models (MapInfo, MapRoom, RoomMap, etc.)
│   ├── domain/                   # Domain layer
│   │   ├── entities/             # Domain entities (Device, Home, Room)
│   │   └── value-objects/        # Value objects (DeviceId, CleanMode)
│   └── ports/                    # Port interfaces
│       ├── IDeviceGateway.ts
│       └── IAuthGateway.ts
│
├── services/roborockService.ts (Facade)
│   └── Uses: services/serviceContainer.ts
│        └── Uses: core/ServiceContainer.ts
│            ├── IAuthGateway → roborockCommunication/adapters/RoborockAuthGateway
│            │      └── roborockCommunication/api/authClient.ts (RoborockAuthenticateApi)
│            └── IDeviceGateway → roborockCommunication/adapters/RoborockDeviceGateway
│                   └── roborockCommunication/routing/clientRouter.ts (ClientRouter)
│                        ├── roborockCommunication/mqtt/mqttClient.ts (MQTTClient)
│                        └── roborockCommunication/local/localClient.ts (LocalNetworkClient)
│
├── behaviors/ (Behavior Layer)
│   ├── BehaviorDeviceGeneric.ts
│   └── roborock.vacuum/
│       ├── core/                 # Core behavior logic
│       ├── handlers/             # Mode handlers
│       ├── enums/                # Behavior enums
│       └── b01/                  # Protocol-specific behaviors
│
└── roborockCommunication/ (Communication Layer)
    ├── adapters/                # Port adapter implementations
    ├── api/                     # REST API clients
    ├── enums/                   # Enumerations
    ├── helper/                  # Helper utilities
    ├── local/                   # Local network clients
    ├── models/                  # Data models and DTOs
    │   └── home/                # Home/room DTOs and mappers
    ├── mqtt/                    # MQTT communication
    ├── protocol/                # Protocol handling
    │   ├── builders/            # Message builders
    │   ├── serializers/         # Message serializers
    │   ├── deserializers/       # Message deserializers
    │   └── dispatcher/          # Message dispatchers
    └── routing/                 # Message routing
        ├── handlers/            # Message handlers
        └── listeners/           # Message listeners
```

**Key Relationships:**

- `src/module.ts` is the entry point and wires up the platform, service, and core layers.
- The `platform/` directory encapsulates platform-specific logic and state.
- The `services/` directory provides business logic and orchestrates communication between platform, core, and communication layers.
- The `core/` directory defines domain models and port interfaces, with adapters implemented in `roborockCommunication/adapters/`.
- The `roborockService.ts` acts as a facade, exposing a unified API to the rest of the platform.
- The `roborockCommunication/` directory contains all communication logic, including MQTT, local, and protocol-specific code.

### Detailed Service Dependencies

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     MODULE.TS (Entry Point)                             │
│                   RoborockMatterbridgePlatform                          │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐
│ Platform Layer   │  │ PlatformRunner   │  │  RoborockService         │
│  (platform/)     │  │                  │  │     (Facade)             │
├──────────────────┤  ├──────────────────┤  ├──────────────────────────┤
│• platformConfig  │  │• updateRobot()   │  │• authenticate()          │
│• deviceRegistry  │  │• requestHomeData │  │• listDevices()           │
│• platformState   │  │                  │  │• initMessageClient()     │
│• lifecycle       │  │  Uses runtimes/: │  │• startClean/pause/dock   │
└──────────────────┘  │  ├ handleLocal   │  │• getMapInformation()     │
                      │  ├ handleCloud   │  └────────┬─────────────────┘
                      │  └ handleHomeData│           │
                      └──────────────────┘           │
                                                     │
                                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SERVICE CONTAINER (DI)                               │
│                    services/serviceContainer.ts                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────┐    ┌──────────────────────┐                  │
│  │ Authentication       │    │ DeviceManagement     │                  │
│  │ Service              │    │ Service              │                  │
│  ├──────────────────────┤    ├──────────────────────┤                  │
│  │• authenticate2FA()   │    │• listDevices()       │                  │
│  │• authenticatePass()  │    │• getHomeData()       │                  │
│  │• requestCode()       │    │• stopService()       │                  │
│  └──────┬───────────────┘    └───────┬──────────────┘                  │
│         │                            │                                 │
│         │                            ▼                                 │
│         │                    ┌─────────────────────────────┐           │
│         │                    │  core/ServiceContainer      │           │
│         │                    │  (Port Adapter DI)          │           │
│         │                    ├─────────────────────────────┤           │
│         │                    │ IDeviceGateway →            │           │
│         │                    │   RoborockDeviceGateway     │           │
│         │                    │     └→ ClientRouter         │           │
│         │                    └─────────────────────────────┘           │
│         │                                                              │
│         ▼                                                              │
│  ┌────────────────────────────────┐                                    │
│  │ core/ports/IAuthGateway        │                                    │
│  │        ↓                       │                                    │
│  │ adapters/RoborockAuthGateway   │                                    │
│  │        ↓                       │                                    │
│  │ api/authClient.ts              │                                    │
│  └────────────────────────────────┘                                    │
│                                                                         │
│  ┌──────────────────────┐    ┌──────────────────────┐                  │
│  │ AreaManagement       │    │ MessageRouting       │                  │
│  │ Service              │    │ Service              │                  │
│  ├──────────────────────┤    ├──────────────────────┤                  │
│  │• setAreas()          │    │• getClient()         │                  │
│  │• getMapInfo()        │    │• sendRequest()       │                  │
│  │• getRoomMap()        │    │• subscribe()         │                  │
│  └──────────────────────┘    └──────────────────────┘                  │
│                                                                         │
│  ┌──────────────────────┐    ┌──────────────────────┐                  │
│  │ Connection           │    │ Polling              │                  │
│  │ Service              │    │ Service              │                  │
│  ├──────────────────────┤    ├──────────────────────┤                  │
│  │• initMessageClient() │◄───│• activateNotify()    │                  │
│  │• initLocal()         │    │• stopPolling()       │                  │
│  │• setNotify()         │    └──────────────────────┘                  │
│  └──────┬───────────────┘                                              │
│         │                                                              │
│         ▼                                                              │
│  ┌────────────────────────────────┐                                    │
│  │ services/clientManager.ts      │                                    │
│  │ • getClient(duid)              │                                    │
│  │ • createClient(device)         │                                    │
│  │ • disposeClient(duid)          │                                    │
│  └────────────┬───────────────────┘                                    │
└───────────────┼────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      COMMUNICATION LAYER                                │
│                   roborockCommunication/                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              routing/clientRouter.ts (ClientRouter)              │  │
│  │  • route(device) → MQTTClient | LocalNetworkClient               │  │
│  │  • sendRequest(device, command, params)                          │  │
│  └──────────────┬─────────────────────────────────────┬─────────────┘  │
│                 │                                     │                │
│                 ▼                                     ▼                │
│  ┌──────────────────────────┐        ┌──────────────────────────────┐ │
│  │ mqtt/mqttClient.ts       │        │ local/localClient.ts         │ │
│  │ (MQTTClient)             │        │ (LocalNetworkClient)         │ │
│  ├──────────────────────────┤        ├──────────────────────────────┤ │
│  │• Cloud MQTT connection   │        │• TCP local connection        │ │
│  │• TLS encrypted           │        │• Low latency                 │ │
│  │• Auto-reconnect          │        │• Uses local/udpClient.ts     │ │
│  │• Subscribe to topics     │        │  for discovery               │ │
│  └──────────┬───────────────┘        └──────────┬───────────────────┘ │
│             │                                   │                     │
│             └───────────────┬───────────────────┘                     │
│                             ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │           mqtt/messageProcessor.ts (MessageProcessor)            │ │
│  │  Deserialize → Validate → Route to Message Listeners             │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                             │                                         │
│                             ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                     routing/listeners/                           │ │
│  │  • simpleMessageListener.ts                                      │ │
│  │  • syncMessageListener.ts                                        │ │
│  │  • connectionStateListener.ts                                    │ │
│  │  • mapResponseListener.ts                                        │ │
│  │  • statusMessageListener.ts                                      │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     protocol/ (Protocol Layer)                   │  │
│  │                                                                  │  │
│  │  builders/              serializers/           dispatcher/      │  │
│  │  ├ L01MessageBuilder     ├ L01Serializer       ├ Q7Dispatcher   │  │
│  │  ├ A01MessageBuilder     ├ A01Serializer       ├ Q10Dispatcher  │  │
│  │  ├ B01MessageBuilder     ├ B01Serializer       ├ V01Dispatcher  │  │
│  │  └ V01MessageBuilder     └ V01Serializer       └ ...            │  │
│  │                                                                  │  │
│  │  deserializers/                                                 │  │
│  │  └ messageDeserializer.ts                                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     api/ (REST API Layer)                        │  │
│  │  • authClient.ts (RoborockAuthenticateApi)                       │  │
│  │    - sendEmailCode(), loginWithCode(), loginWithPassword()       │  │
│  │  • iotClient.ts (RoborockIoTApi)                                 │  │
│  │    - getHomeData(), getDeviceList(), getScenes()                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  models/home/ (DTOs & Mappers)                   │  │
│  │  • MapDataDto, MapRoomDto, MultipleMapDto, RoomDto               │  │
│  │  • mappers.ts (HomeModelMapper)                                  │  │
│  │    - API DTO → Application Model transformation                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

Legend:
  ──────►  Direct dependency / calls
  │       Component boundary
  ┌─────┐ Module/Component
```

---

## Directory Structure

### Root Structure

```
src/
├── module.ts                    # Main platform entry point
├── platformRunner.ts            # Orchestrates device updates
├── settings.ts                  # Plugin configuration
│
├── platform/                    # Platform layer (NEW)
│   ├── platformLifecycle.ts     # Lifecycle methods
│   ├── platformConfig.ts        # Config validation
│   ├── platformState.ts         # State management
│   └── deviceRegistry.ts        # Device/robot registry
│
├── core/                        # Core domain layer
│   ├── ServiceContainer.ts      # Port adapter DI container
│   ├── application/             # Application layer
│   │   └── models/
│   │       ├── MapInfo.ts
│   │       ├── MapRoom.ts
│   │       ├── RoomIndexMap.ts
│   │       ├── RoomMap.ts
│   │       ├── RoomMapping.ts
│   │       └── index.ts
│   ├── domain/                  # Domain layer
│   │   ├── entities/
│   │   │   ├── Device.ts
│   │   │   ├── Home.ts
│   │   │   └── Room.ts
│   │   └── value-objects/
│   │       ├── DeviceId.ts
│   │       └── CleanMode.ts
│   └── ports/                   # Port interfaces
│       ├── IDeviceGateway.ts
│       └── IAuthGateway.ts
│
├── services/                    # Service layer
│   ├── serviceContainer.ts      # Main DI container
│   ├── roborockService.ts       # Service facade
│   ├── authenticationService.ts
│   ├── deviceManagementService.ts
│   ├── areaManagementService.ts
│   ├── messageRoutingService.ts
│   ├── pollingService.ts
│   ├── connectionService.ts
│   ├── clientManager.ts
│   └── index.ts
│
├── behaviors/                   # Device behavior implementations
│   ├── BehaviorDeviceGeneric.ts # Base behavior class
│   └── roborock.vacuum/
│       ├── b01/                 # B01 protocol-specific behaviors
│       │   └── q7.ts
│       ├── core/                # Core behavior logic
│       │   ├── CleanModeSetting.ts
│       │   ├── behaviorConfig.ts
│       │   ├── cleanMode.ts
│       │   ├── cleanModeConfig.ts
│       │   ├── cleanModeUtils.ts
│       │   ├── cleanSetting.ts
│       │   ├── commonCommands.ts
│       │   ├── modeHandler.ts
│       │   ├── modeHandlerRegistry.ts
│       │   ├── modeResolver.ts
│       │   └── runModeConfig.ts
│       ├── enums/               # Behavior enumerations
│       │   ├── MopRoute.ts
│       │   ├── MopWaterFlow.ts
│       │   ├── VacuumSuctionPower.ts
│       │   └── index.ts
│       └── handlers/            # Mode-specific handlers
│           ├── cleaningModeHandler.ts
│           ├── customCleanModeHandler.ts
│           ├── defaultCleanModeHandler.ts
│           ├── goVacationHandler.ts
│           ├── presetCleanModeHandler.ts
│           └── smartPlanHandler.ts
│
├── roborockCommunication/       # Communication layer
│   ├── adapters/                # Port adapters
│   │   ├── RoborockAuthGateway.ts
│   │   └── RoborockDeviceGateway.ts
│   │
│   ├── api/                     # REST API clients
│   │   ├── authClient.ts        # Authentication API
│   │   └── iotClient.ts         # IoT API
│   │
│   ├── mqtt/                    # MQTT communication
│   │   ├── mqttClient.ts
│   │   └── messageProcessor.ts
│   │
│   ├── local/                   # Local network
│   │   ├── localClient.ts
│   │   └── udpClient.ts
│   │
│   ├── protocol/                # Protocol handling
│   │   ├── builders/
│   │   │   ├── A01MessageBodyBuilder.ts
│   │   │   ├── B01MessageBodyBuilder.ts
│   │   │   ├── L01MessageBodyBuilder.ts
│   │   │   ├── V01MessageBodyBuilder.ts
│   │   │   ├── UnknownMessageBodyBuilder.ts
│   │   │   ├── abstractMessageBodyBuilder.ts
│   │   │   └── messageBodyBuilderFactory.ts
│   │   ├── serializers/
│   │   │   ├── A01Serializer.ts
│   │   │   ├── B01Serializer.ts
│   │   │   ├── L01Serializer.ts
│   │   │   ├── V01Serializer.ts
│   │   │   ├── abstractSerializer.ts
│   │   │   ├── messageSerializer.ts
│   │   │   └── messageSerializerFactory.ts
│   │   ├── deserializers/
│   │   │   └── messageDeserializer.ts
│   │   └── dispatcher/          # Message dispatchers
│   │       ├── Q10MessageDispatcher.ts
│   │       ├── Q7MessageDispatcher.ts
│   │       ├── V10MessageDispatcher.ts
│   │       ├── abstractMessageDispatcher.ts
│   │       ├── dispatcherFactory.ts
│   │       └── protocolCalculator.ts
│   │
│   ├── routing/                 # Message routing
│   │   ├── clientRouter.ts
│   │   ├── client.ts
│   │   ├── abstractClient.ts
│   │   ├── handlers/
│   │   │   ├── abstractMessageHandler.ts
│   │   │   └── implementation/
│   │   │       └── simpleMessageHandler.ts
│   │   └── listeners/
│   │       ├── abstractConnectionListener.ts
│   │       ├── abstractMessageListener.ts
│   │       ├── abstractUDPMessageListener.ts
│   │       └── implementation/
│   │           ├── simpleMessageListener.ts
│   │           ├── syncMessageListener.ts
│   │           ├── connectionStateListener.ts
│   │           ├── chainedMessageListener.ts
│   │           ├── connectionBroadcaster.ts
│   │           ├── mapResponseListener.ts
│   │           ├── pingResponseListener.ts
│   │           └── statusMessageListener.ts
│   │
│   ├── models/                  # Data models
│   │   ├── home/                # Home/room DTOs
│   │   │   ├── MapDataDto.ts
│   │   │   ├── MapRoomDto.ts
│   │   │   ├── MultipleMapDto.ts
│   │   │   ├── RoomDto.ts
│   │   │   ├── mappers.ts       # DTO to application model mappers
│   │   │   └── index.ts
│   │   ├── apiResponse.ts
│   │   ├── authenticateFlowState.ts
│   │   ├── authenticateResponse.ts
│   │   ├── baseURL.ts
│   │   ├── batteryMessage.ts
│   │   ├── contentMessage.ts
│   │   ├── device.ts
│   │   ├── deviceCategory.ts
│   │   ├── deviceModel.ts
│   │   ├── deviceSchema.ts
│   │   ├── deviceStatus.ts
│   │   ├── dockInfo.ts
│   │   ├── dps.ts
│   │   ├── headerMessage.ts
│   │   ├── home.ts
│   │   ├── homeInfo.ts
│   │   ├── messageContext.ts
│   │   ├── messageResult.ts
│   │   ├── networkInfo.ts
│   │   ├── product.ts
│   │   ├── protocol.ts
│   │   ├── requestMessage.ts
│   │   ├── responseBody.ts
│   │   ├── responseMessage.ts
│   │   ├── scene.ts
│   │   ├── userData.ts
│   │   ├── vacuumError.ts
│   │   └── index.ts
│   │
│   ├── enums/                   # Enumerations
│   │   ├── Q10RequestCode.ts
│   │   ├── Q7RequestCode.ts
│   │   ├── additionalPropCode.ts
│   │   ├── authenticateResponseCode.ts
│   │   ├── dockType.ts
│   │   ├── operationStatusCode.ts
│   │   ├── protocolVersion.ts
│   │   ├── vacuumAndDockErrorCode.ts
│   │   └── index.ts
│   │
│   ├── helper/                  # Communication helpers
│   │   ├── B01VacuumModeResolver.ts
│   │   ├── chunkBuffer.ts
│   │   ├── cryptoHelper.ts
│   │   ├── nameDecoder.ts
│   │   └── sequence.ts
│   │
│
├── runtimes/                    # Message runtime handlers
│   ├── handleCloudMessage.ts
│   ├── handleHomeDataMessage.ts
│   └── handleLocalMessage.ts
│
├── initialData/                 # Initial data fetchers
│   ├── getBatteryStatus.ts
│   ├── getOperationalStates.ts
│   ├── getSupportedAreas.ts
│   ├── getSupportedCleanModes.ts
│   ├── getSupportedRunModes.ts
│   ├── getSupportedScenes.ts
│   ├── regionUrls.ts
│   └── index.ts
│
├── constants/                   # Constant definitions
│   ├── battery.ts
│   ├── device.ts
│   ├── distance.ts
│   ├── ids.ts
│   ├── timeouts.ts
│   ├── sensitiveDataRegexReplacements.ts
│   └── index.ts
│
├── errors/                      # Custom error classes
│   ├── AuthenticationError.ts
│   ├── BaseError.ts
│   ├── CommunicationError.ts
│   ├── ConfigurationError.ts
│   ├── DeviceError.ts
│   ├── ValidationError.ts
│   └── index.ts
│
├── model/                       # Application models
│   ├── CloudMessageModel.ts
│   ├── DockStationStatus.ts
│   └── ExperimentalFeatureSetting.ts
│
├── types/                       # TypeScript type definitions
│   ├── callbacks.ts
│   ├── communication.ts
│   ├── config.ts
│   ├── device.ts
│   ├── factories.ts
│   ├── MessagePayloads.ts
│   ├── notifyMessageTypes.ts
│   ├── roborockVacuumCleaner.ts
│   ├── state.ts
│   └── index.ts
│
├── share/                       # Shared utilities
│   ├── behaviorFactory.ts       # Behavior creation
│   ├── filterLogger.ts          # Logger with sensitive data filtering
│   ├── function.ts              # Utility functions
│   ├── helper.ts                # Helper functions
│   └── runtimeHelper.ts         # Runtime helper utilities
│
├── handlers/                    # Root-level handlers (reserved)
│
└── tests/                       # Unit tests (142+ files)
    ├── behaviors/
    ├── core/
    ├── errors/
    ├── helpers/
    ├── initialData/
    ├── model/
    ├── roborockCommunication/
    ├── runtimes/
    ├── services/
    ├── share/
    ├── testData/
    └── ...
```

---

## Core Components

### 1. **RoborockMatterbridgePlatform** ([module.ts](../src/module.ts))

**Responsibility:** Main platform class extending `MatterbridgeDynamicPlatform`

**Key Properties:**

```typescript
// Platform layer
registry: DeviceRegistry              // Device/robot storage
configManager: PlatformConfigManager  // Configuration management
lifecycle: PlatformLifecycle          // Lifecycle coordination
state: PlatformState                  // Startup state tracking

// Services
roborockService: RoborockService      // Service facade
platformRunner: PlatformRunner        // Update orchestrator
clientManager: ClientManager          // MQTT client manager
persist: LocalStorage                 // Data persistence
```

**Key Methods:**

- `onStart()` - Platform initialization (delegates to lifecycle)
- `onConfigure()` - Device configuration (delegates to lifecycle)
- `onShutdown()` - Cleanup (delegates to lifecycle)
- `startDeviceDiscovery()` - Authenticate and discover devices
- `configureDevice()` - Configure individual device

### 2. **PlatformRunner** ([platformRunner.ts](../src/platformRunner.ts))

**Responsibility:** Orchestrates device state updates from various message sources

**Key Methods:**

- `updateRobotWithPayload()` - Type-safe message routing
- `requestHomeData()` - Polls for device state updates
- `updateFromMQTTMessage()` - Processes MQTT messages

**Message Flow:**

```
MQTT/Cloud → PlatformRunner → Runtime Handlers → Robot Update
```

### 3. **RoborockVacuumCleaner Types** ([types/roborockVacuumCleaner.ts](../src/types/roborockVacuumCleaner.ts))

**Responsibility:** Type definitions for Roborock vacuum cleaner

**Key Types:**

- Device configuration types
- State types
- Map and room types
- Behavior types

---

## Platform Layer

Located in: [src/platform/](../src/platform/)

### **PlatformLifecycle** ([platformLifecycle.ts](../src/platform/platformLifecycle.ts))

**Responsibility:** Coordinates platform lifecycle events

**Key Methods:**

- `onStart()` - Initialize storage, validate config, start discovery
- `onConfigure()` - Set up periodic polling interval
- `onShutdown()` - Clean up resources, stop services

**Dependencies:**

```typescript
interface LifecycleDependencies {
  getPersistanceStorage: () => LocalStorage;
  getPlatformRunner: () => PlatformRunner | undefined;
  getRoborockService: () => RoborockService | undefined;
  startDeviceDiscovery: () => Promise<boolean>;
  onConfigureDevice: () => Promise<void>;
  clearSelect: () => Promise<void>;
  unregisterAllDevices: (delay?: number) => Promise<void>;
}
```

### **PlatformConfigManager** ([platformConfig.ts](../src/platform/platformConfig.ts))

**Responsibility:** Configuration validation and access

**Key Properties:**

- `username`, `password`, `verificationCode`
- `authenticationMethod`
- `refreshInterval`, `whiteList`, `blackList`
- `experimentalSettings`, `cleanModeSettings`
- `isServerModeEnabled`, `isMultipleMapEnabled`

### **DeviceRegistry** ([deviceRegistry.ts](../src/platform/deviceRegistry.ts))

**Responsibility:** Storage for discovered devices and robots

**Key Methods:**

- `registerDevice()` / `registerRobot()`
- `getDevice()` / `getRobot()`
- `getAllDevices()` / `getAllRobots()`
- `hasDevices()` / `size`

### **PlatformState** ([platformState.ts](../src/platform/platformState.ts))

**Responsibility:** Track platform state

**Key Properties:**

- `isStartupCompleted` - Whether startup finished successfully

---

## Core Domain Layer

Located in: [src/core/](../src/core/)

### **ServiceContainer** ([ServiceContainer.ts](../src/core/ServiceContainer.ts))

**Responsibility:** Dependency injection for port adapters

**Key Methods:**

- `initialize(userData)` - Create device gateway after auth
- `getAuthGateway()` - Get IAuthGateway instance
- `getDeviceGateway()` - Get IDeviceGateway instance
- `dispose()` - Clean up resources

### **Application Models** ([application/models/](../src/core/application/models/))

Application-layer models for room and map management:

**MapInfo.ts:**

```typescript
class MapInfo {
  readonly maps: Map<number, string>;      // Map ID → Map name
  readonly allRooms: RoomMapping[];        // All rooms across all maps

  getById(mapId: number): string | undefined;
  getByName(name: string): number | undefined;
  static fromDto(dto: MultipleMapDto): MapInfo;
}
```

**RoomMapping.ts:**

```typescript
class RoomMapping {
  readonly id: number;                     // Local room ID
  readonly globalId: number;               // Global room ID
  readonly iot_name_id: number;            // IoT name identifier
  readonly tag: number;                    // Room tag
  readonly mapId: number;                  // Associated map ID
  readonly displayName: string;            // Decoded room name
}
```

**MapRoom.ts:**

```typescript
class MapRoom {
  readonly id: number;
  readonly globalId: number;
  readonly iot_name_id: number;
  readonly tag: number;
  readonly displayName: string;
  readonly mapId: number;

  static fromDto(dto: MapRoomDto): MapRoom;
}
```

**RoomMap.ts:**

```typescript
class RoomMap {
  private readonly roomMappings: RoomMapping[];

  getRooms(): RoomMapping[];
  getRoomName(roomId: number): string | undefined;
  getRoomIdByName(roomName: string): number | undefined;

  static fromDevice(duid: string, platform: RoborockMatterbridgePlatform): Promise<RoomMap>;
  static fromDeviceDirect(device: Device, platform: RoborockMatterbridgePlatform): Promise<RoomMap>;
}
```

**RoomIndexMap.ts:**

```typescript
class RoomIndexMap {
  readonly mapInfo: MapInfo;
  readonly indexToRoomId: Map<number, number>;
  readonly roomIdToIndex: Map<number, number>;

  getRoomIdByIndex(index: number): number | undefined;
  getIndexByRoomId(roomId: number): number | undefined;
}
```

### **Domain Entities** ([domain/entities/](../src/core/domain/entities/))

**Device.ts:**

```typescript
interface DeviceEntity {
  readonly duid: string;
  readonly name: string;
  readonly model: string;
  readonly localKey: string;
  readonly status: DeviceStatus;
}
```

**Home.ts:**

```typescript
interface HomeEntity {
  readonly id: number;
  readonly name: string;
  readonly devices: DeviceEntity[];
  readonly rooms: RoomEntity[];
}
```

### **Value Objects** ([domain/value-objects/](../src/core/domain/value-objects/))

**DeviceId.ts:**

```typescript
class DeviceId {
  static create(duid: string): DeviceId;
  toString(): string;
  equals(other: DeviceId): boolean;
}
```

**CleanMode.ts:**

```typescript
class CleanMode {
  static readonly Vacuum: CleanMode;
  static readonly Mop: CleanMode;
  static readonly VacuumAndMop: CleanMode;
}
```

### **Port Interfaces** ([ports/](../src/core/ports/))

**IAuthGateway.ts:**

```typescript
interface IAuthGateway {
  requestVerificationCode(email: string): Promise<void>;
  authenticate(email: string, code: string): Promise<UserData>;
  refreshToken(userData: UserData): Promise<UserData>;
}
```

**IDeviceGateway.ts:**

```typescript
interface IDeviceGateway {
  sendCommand(deviceId: string, command: DeviceCommand): Promise<void>;
  getStatus(deviceId: string): Promise<DeviceStatus>;
  subscribe(deviceId: string, callback: StatusCallback): () => void;
}
```

---

## Service Layer

Located in: [src/services/](../src/services/)

### **ServiceContainer** ([serviceContainer.ts](../src/services/serviceContainer.ts))

**Responsibility:** Main dependency injection container

**Services Managed:**

1. AuthenticationService
2. DeviceManagementService
3. AreaManagementService
4. MessageRoutingService
5. PollingService
6. ConnectionService

**Key Methods:**

```typescript
getAuthenticationService(): AuthenticationService;
getDeviceManagementService(): DeviceManagementService;
getAreaManagementService(): AreaManagementService;
getMessageRoutingService(): MessageRoutingService;
getPollingService(): PollingService;
getConnectionService(): ConnectionService;
setUserData(userData: UserData): void;
destroy(): Promise<void>;
```

### **AuthenticationService** ([authenticationService.ts](../src/services/authenticationService.ts))

**Responsibilities:**

- User authentication flow (2FA, password)
- Token management
- Session handling

**Key Methods:**

- `authenticate2FAFlow()` - Two-factor authentication
- `authenticateWithPasswordFlow()` - Password-based auth
- `requestVerificationCode()` - Send code to email

### **DeviceManagementService** ([deviceManagementService.ts](../src/services/deviceManagementService.ts))

**Responsibilities:**

- Device discovery and listing
- Device lifecycle coordination

**Key Methods:**

- `listDevices()` - Fetch all devices
- `getHomeDataForUpdating()` - Get home data for updates
- `stopService()` - Clean up resources

### **ConnectionService** ([connectionService.ts](../src/services/connectionService.ts))

**Responsibilities:**

- MQTT client initialization
- Local network client setup
- Connection timeout handling

**Key Methods:**

- `initializeMessageClient()` - Setup MQTT connection
- `initializeMessageClientForLocal()` - Setup local connection
- `setDeviceNotify()` - Set notification callback

### **PollingService** ([pollingService.ts](../src/services/pollingService.ts))

**Responsibilities:**

- Device status polling
- Refresh interval management

**Key Methods:**

- `activateDeviceNotifyOverLocal()` - Start local polling
- `activateDeviceNotifyOverMQTT()` - Start MQTT polling
- `stopPolling()` - Stop all polling

### **AreaManagementService** ([areaManagementService.ts](../src/services/areaManagementService.ts))

**Responsibilities:**

- Room/area management
- Map data processing
- Scene management

### **MessageRoutingService** ([messageRoutingService.ts](../src/services/messageRoutingService.ts))

**Responsibilities:**

- Message subscription management
- Device command execution
- Clean mode management

---

## Communication Layer

Located in: [src/roborockCommunication/](../src/roborockCommunication/)

### Structure

```
roborockCommunication/
├── adapters/                    # Port adapter implementations
│   ├── RoborockAuthGateway.ts   # Implements IAuthGateway
│   └── RoborockDeviceGateway.ts # Implements IDeviceGateway
├── api/                         # REST API clients
│   ├── authClient.ts            # Authentication API
│   └── iotClient.ts             # IoT API
├── mqtt/                        # MQTT communication
│   ├── mqttClient.ts
│   └── messageProcessor.ts
├── local/                       # Local network communication
│   ├── localClient.ts
│   └── udpClient.ts
├── protocol/                    # Protocol handling
│   ├── builders/                # Message body builders
│   ├── serializers/             # Protocol serializers
│   ├── deserializers/           # Protocol deserializers
│   └── dispatcher/              # Message dispatchers (Q7, Q10, V01)
├── routing/                     # Message routing
│   ├── clientRouter.ts
│   ├── abstractClient.ts
│   ├── handlers/                # Message handlers
│   └── listeners/               # Message listeners
├── models/                      # Data models
│   └── home/                    # Home/room DTOs and mappers
├── enums/                       # Enumerations
└── helper/                      # Utilities
```

### **Adapters** ([adapters/](../src/roborockCommunication/adapters/))

**RoborockAuthGateway.ts:**

- Implements `IAuthGateway` interface
- Wraps `RoborockAuthenticateApi`
- Adapts REST API to domain port

**RoborockDeviceGateway.ts:**

- Implements `IDeviceGateway` interface
- Wraps `ClientRouter`
- Adapts message routing to domain port

### **API Layer** ([api/](../src/roborockCommunication/api/))

**authClient.ts (RoborockAuthenticateApi):**

- `sendEmailCode()` - Request verification code
- `loginWithCode()` - Login with verification code
- `loginWithPassword()` - Password-based login

**iotClient.ts (RoborockIoTApi):**

- `getHomeData()` - Fetch home and device data
- `getDeviceList()` - List all devices
- `getScenes()` - Get cleaning scenes

### **Client Architecture**

```
ClientRouter (facade)
    ├── MQTTClient (cloud connection)
    │   └── TLS encrypted, auto-reconnect
    └── LocalNetworkClient (LAN connection)
        └── UDP, low latency
```

### **Protocol Support**

| Protocol | Builder               | Serializer    | Dispatcher           | Description       |
| -------- | --------------------- | ------------- | -------------------- | ----------------- |
| L01      | L01MessageBodyBuilder | L01Serializer | -                    | Legacy protocol   |
| A01      | A01MessageBodyBuilder | A01Serializer | -                    | Standard protocol |
| B01      | B01MessageBodyBuilder | B01Serializer | Q7MessageDispatcher  | Extended protocol |
| V01      | V01MessageBodyBuilder | V01Serializer | V10MessageDispatcher | Latest protocol   |

**Message Dispatchers:**

- **V10MessageDispatcher** - Handles V01 protocol messages, including room mapping and map data
- **Q7MessageDispatcher** - Handles Q7-specific B01 protocol messages
- **Q10MessageDispatcher** - Handles Q10-specific messages

**DTO to Application Model Mapping:**

The communication layer uses DTOs (Data Transfer Objects) with mappers to transform API responses into application models:

```
API Response → DTO (RoomDto, MapRoomDto) → Mapper (HomeModelMapper) → Application Model (RoomMapping, MapInfo)
```

This separation ensures the domain layer is decoupled from external API changes.

---

## Behavior System

Located in: [src/behaviors/](../src/behaviors/)

### Architecture

The behavior system has been refactored from device-based behaviors (default/smart) to a modular, handler-based architecture:

```
BehaviorDeviceGeneric (base class)
    │
    └── roborock.vacuum/
        ├── core/           # Core behavior logic and configuration
        ├── handlers/       # Mode-specific handlers
        ├── enums/          # Behavior-specific enumerations
        └── b01/            # Protocol-specific behaviors
```

### **Core Behavior Components** ([core/](../src/behaviors/roborock.vacuum/core/))

**Key Files:**

- `CleanModeSetting.ts` - Clean mode configuration
- `behaviorConfig.ts` - Behavior configuration
- `cleanMode.ts` - Clean mode definitions
- `cleanModeConfig.ts` - Clean mode settings
- `cleanModeUtils.ts` - Clean mode utilities
- `cleanSetting.ts` - Clean setting management
- `commonCommands.ts` - Common device commands
- `modeHandler.ts` - Mode handler interface
- `modeHandlerRegistry.ts` - Mode handler registry
- `modeResolver.ts` - Mode resolution logic
- `runModeConfig.ts` - Run mode configuration

### **Mode Handlers** ([handlers/](../src/behaviors/roborock.vacuum/handlers/))

**Handler Types:**

- `cleaningModeHandler.ts` - Standard cleaning mode
- `customCleanModeHandler.ts` - Custom cleaning mode
- `defaultCleanModeHandler.ts` - Default cleaning mode
- `goVacationHandler.ts` - Vacation mode
- `presetCleanModeHandler.ts` - Preset cleaning modes
- `smartPlanHandler.ts` - Smart cleaning plan

**Supported Clusters:**

- RvcRunMode
- RvcOperationalState
- RvcCleanMode
- PowerSource
- ServiceArea (for room-based cleaning)

### **Protocol-Specific Behaviors** ([b01/](../src/behaviors/roborock.vacuum/b01/))

Device-specific behavior implementations:

- `q7.ts` - Roborock Q7 (B01 protocol)

---

## Shared Utilities

Located in: [src/share/](../src/share/)

Shared utilities and helper functions used across the codebase:

### **BehaviorFactory** ([behaviorFactory.ts](../src/share/behaviorFactory.ts))

**Responsibility:** Factory for creating device behaviors

**Key Functions:**

- Creates appropriate behavior instances based on device type
- Handles behavior initialization and configuration

### **FilterLogger** ([filterLogger.ts](../src/share/filterLogger.ts))

**Responsibility:** Logger with sensitive data filtering

**Key Features:**

- Filters sensitive information (passwords, tokens, keys) from logs
- Wraps Matterbridge logger with security enhancements
- Uses regex patterns from `constants/sensitiveDataRegexReplacements.ts`

### **Helper Functions** ([helper.ts](../src/share/helper.ts))

**Responsibility:** General utility functions

**Key Functions:**

- String manipulation utilities
- Data transformation helpers
- Common operations used across modules

### **Function Utilities** ([function.ts](../src/share/function.ts))

**Responsibility:** Functional programming utilities

**Key Functions:**

- Functional composition helpers
- Data processing utilities

### **Runtime Helpers** ([runtimeHelper.ts](../src/share/runtimeHelper.ts))

**Responsibility:** Runtime message processing helpers

**Key Functions:**

- Message validation and transformation
- Runtime data processing utilities
- Common message handling operations

---

## Data Flow

### 1. **Startup Flow**

```
module.ts constructor
    ↓
Create PlatformConfigManager, DeviceRegistry, PlatformState
    ↓
Create PlatformLifecycle with dependencies
    ↓
onStart() called
    ↓
PlatformLifecycle.onStart()
    ↓
startDeviceDiscovery()
    ↓
Create RoborockService (facade)
    ↓
ServiceContainer created with all services
    ↓
authenticate() → AuthenticationService
    ↓
listDevices() → DeviceManagementService
    ↓
initializeMessageClient() → ConnectionService
    ↓
configureDevice() for each device
    ↓
Create RoborockVacuumCleaner
    ↓
Register with Matterbridge
```

### 2. **Authentication Flow**

```
User Input (Email)
    ↓
RoborockService.authenticate()
    ↓
AuthenticationService.authenticate2FAFlow()
    ↓
IAuthGateway.requestVerificationCode()
    ↓
RoborockAuthGateway → RoborockAuthenticateApi
    ↓
User receives code via email
    ↓
IAuthGateway.authenticate()
    ↓
UserData stored → ServiceContainer.setUserData()
```

### 3. **Message Update Flow**

```
MQTT Message Received
    ↓
MessageProcessor.processMessage()
    ↓
Route to registered listeners
    ↓
PlatformRunner.updateRobotWithPayload()
    ↓
Runtime Handler (handleLocalMessage/handleCloudMessage)
    ↓
Update robot state
    ↓
Update Matter clusters
    ↓
Notify Matter controllers
```

### 4. **Command Execution Flow**

```
Matter Controller (Apple Home)
    ↓
Matterbridge Endpoint
    ↓
RoborockVacuumCleaner behavior handler
    ↓
RoborockService.startClean/pauseClean/etc.
    ↓
MessageRoutingService
    ↓
ClientRouter.sendRequest()
    ↓
MQTTClient/LocalNetworkClient
    ↓
Roborock Device
```

### 5. **Room/Map Data Flow (DTO → Mapper → Application Model)**

```
API Response (number[][])
    ↓
V10MessageDispatcher.getRoomMappings()
    ↓
HomeModelMapper.rawArrayToMapRoomDto() → MapRoomDto[]
    ↓
HomeModelMapper.toRoomMapping() → RoomMapping[]
    ↓
new RoomMap(roomMappings)
    ↓
Application uses RoomMap
```

**Key Transformation Steps:**

1. **API Layer**: Raw data from Roborock API (e.g., `number[][]` for room mappings)
2. **DTO Layer**: Transform to typed DTOs (`MapRoomDto`, `RoomDto`, `MultipleMapDto`)
3. **Mapper Layer**: `HomeModelMapper` transforms DTOs to application models
4. **Application Layer**: Clean models (`RoomMapping`, `MapInfo`, `RoomMap`) used in business logic

**Benefits:**

- API changes only affect DTOs and mappers
- Business logic works with clean, domain-focused models
- Clear separation of concerns
- Type safety throughout the transformation

---

## Key Design Patterns

### 1. **Hexagonal Architecture (Ports & Adapters)**

- `core/ports/` defines interfaces (ports)
- `roborockCommunication/adapters/` implements them
- Domain logic is decoupled from infrastructure

### 2. **Service Locator / Dependency Injection**

- `services/ServiceContainer` provides centralized service access
- `core/ServiceContainer` manages port adapters
- Lazy initialization for performance

### 3. **Facade Pattern**

- `RoborockService` simplifies complex service interactions
- `ClientRouter` simplifies client selection
- Clean public APIs hide complexity

### 4. **Factory Pattern**

- `behaviorFactory.ts` creates device behaviors
- `messageBodyBuilderFactory.ts` creates protocol builders
- `messageProcessorFactory.ts` creates processors

### 5. **Strategy Pattern**

- Different behaviors (Default vs Smart)
- Protocol-specific serializers
- Message builders by protocol version

### 6. **Observer Pattern**

- Message listeners observe MQTT messages
- Platform observes device state changes
- Event-driven updates

---

## Testing Strategy

### Test Coverage Summary

**Overall:** 95.74% statement coverage (959+ tests)

**Coverage by Layer:**

- Services: 90-100%
  - ConnectionService: 98.11%
  - PollingService: 100%
  - AuthenticationService: 91.83%
- Communication: 94-100%
- Behaviors: 98-100%
- Runtimes: 92.38%

### Test Organization

```
src/tests/
├── behaviors/              # Behavior tests
├── core/                   # Core domain tests
│   └── ports/              # Port interface tests
├── errors/                 # Error class tests
├── roborockCommunication/  # Communication layer tests
│   ├── adapters/           # Adapter tests
│   ├── api/                # API client tests
│   ├── broadcast/          # Message routing tests
│   └── ...
├── services/               # Service layer tests
└── testData/               # Mock data and fixtures
```

### Test Commands

```bash
npm run test               # Run all tests
npm run test -- --coverage # Run with coverage
npm run test:verbose       # Verbose output
```

---

## References

### Documentation

- [README.md](../README.md) - Main documentation
- [README_DEV.md](../README_DEV.md) - Developer guide
- [migration.md](migration.md) - Migration plan
- [to_do.md](to_do.md) - Task tracking

### Links

- **GitHub:** https://github.com/RinDevJunior/matterbridge-roborock-vacuum-plugin
- **NPM:** https://www.npmjs.com/package/matterbridge-roborock-vacuum-plugin
- **Matterbridge:** https://www.npmjs.com/package/matterbridge

---

**Document Version:** 4.0
**Last Updated:** January 30, 2026
