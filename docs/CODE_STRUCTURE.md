# Matterbridge Roborock Vacuum Plugin - Code Structure

**Version:** 1.1.3-rc03
**Last Updated:** January 24, 2026
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
- Matterbridge 3.5.0
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
│   ├── handleLocalMessage.ts
│   ├── handleCloudMessage.ts
│   └── handleHomeDataMessage.ts
│
├── services/ (Service Layer)
│   ├── serviceContainer.ts       # Main DI container for services
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
│   └── ports/
│       ├── IDeviceGateway.ts
│       ├── IAuthGateway.ts
│       └── IMessageBroker.ts
│
├── roborockService.ts (Facade)
│   └── Uses: services/serviceContainer.ts
│        └── Uses: core/ServiceContainer.ts
│            ├── IAuthGateway → adapters/RoborockAuthGateway
│            │      └── api/authClient.ts (RoborockAuthenticateApi)
│            └── IDeviceGateway → adapters/RoborockDeviceGateway
│                   └── routing/clientRouter.ts (ClientRouter)
│                        ├── mqtt/mqttClient.ts (MQTTClient)
│                        └── local/localClient.ts (LocalNetworkClient)
│
├── behaviors/ (Behavior Layer)
│   ├── BehaviorDeviceGeneric.ts
│   └── roborock.vacuum/
│       └── ...
│
└── roborockCommunication/ (Communication Layer)
    ├── adapters/
    ├── api/
    ├── enums/
    ├── helper/
    ├── local/
    ├── models/
    ├── mqtt/
    ├── protocol/
    └── routing/
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
┌──────────────────────────────────────────────────────────────────────────────┐
│                            MODULE.TS (Entry Point)                           │
└─────────────────────────────────┬──────────────────────────────────----──────┘
                                  │
    ┌─────────────────────────────┼─────────────────────────────┐
    ▼                             ▼                             ▼
┌────────────────────┐    ┌────────────────────┐    ┌──────────────────────────┐
│  Platform Layer    │    │  PlatformRunner    │    │    RoborockService       │
├────────────────────┤    ├────────────────────┤    │        (Facade)          │
│ • platformConfig   │    │ • updateRobot()    │    ├──────────────────────────┤
│ • deviceRegistry   │    │ • requestHomeData  │    │ • authenticate()         │
│ • platformState    │    │ • handleMessages   │    │ • listDevices()          │
│ • platformLifecycle│    └─────────┬──────────┘    │ • initializeMessageClient│
└─────┬──────----────┘              │               │ • startClean/pauseClean  │
      │                             │               │ • getMapInformation      │
      │                   ┌─────────┴─────────┐    └─────────────┬────────────┘
      │                   ▼                   ▼                  │
      │    ┌─────────────────┐  ┌─────────────────┐          │
      │    │ handleLocal     │  │ handleCloud     │          │
      │    │ Message.ts      │  │ Message.ts      │          │
      │    └─────────────────┘  └─────────────────┘          │
      │                                                      │
      └──────────────────────┬───────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         SERVICE CONTAINER (DI)                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────┐   ┌────────────────────────┐   ┌────────────────┐│
│  │ AuthenticationService  │   │ DeviceManagementSvc    │   │ AreaManagement ││
│  │ • 2FA, password, token │   │ • listDevices, connect │   │ • setAreas     ││
│  │   refresh              │   │ • getHomeData          │   │ • getMapInfo   ││
│  └─────────┬──────────────┘   └─────────┬──────────────┘   └───────┬────────┘│
│            │                            │                           │         │
│            ▼                            ▼                           ▼         │
│  ┌──────────────────────┐   ┌────────────────────────┐   ┌──────────────────┐│
│  │ core/ports/IAuthGatew│   │ roborockCommunication/ │   │ MessageRouting   ││
│  │ ay.ts (Port)         │   │ api/iotClient.ts       │   │ Service          ││
│  └─────────┬────────────┘   └────────────────────────┘   └─────────┬────────┘│
│            │                                                │                │
│            ▼                                                ▼                │
│  ┌─────────────────────────────┐   ┌────────────────────┐   ┌──────────────┐ │
│  │ adapters/RoborockAuthGatewa │   │ PollingService     │◄──│ ConnectionSvc│ │
│  │ y.ts (Adapter)              │   │ • activateNotify   │   │ • initMQTT   │ │
│  └─────────┬──────────────────┘   │ • stopPolling       │   │ • initLocal  │ │
│            │                      └────────────────────┘   └───────┬────────┘ │
│            ▼                                              │                │
│  ┌─────────────────────────────┐                     ┌────▼─────────────┐ │
│  │ api/authClient.ts           │                     │ clientManager.ts │ │
│  │ (RoborockAuthenticateApi)   │                     └──────┬───────────┘ │
│  └─────────────────────────────┘                            │             │
│                                                             │             │
└──────────────────────────────────────────────────────────────┼────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         COMMUNICATION LAYER                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                    routing/clientRouter.ts (ClientRouter)            │    │
│  └────────────────────────────┬─────────────────────────────────────────┘    │
│                               │                                               │
│           ┌───────────────────┼───────────────────┐                          │
│           ▼                   ▼                   ▼                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐               │
│  │ mqtt/mqttClient │  │ local/localClien│  │ local/udpClient │               │
│  │ .ts (MQTTClient)│  │ t.ts            │  │ .ts             │               │
│  │ • Cloud MQTT    │  │ • TCP Local     │  │ • UDP Local     │               │
│  │ • TLS encrypted │  │ • Low latency   │  │ • Discovery     │               │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘               │
│           │                    │                    │                        │
│           └────────────────────┼────────────────────┘                        │
│                                ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                mqtt/messageProcessor.ts (MessageProcessor)           │    │
│  │  • Deserialize → Validate → Route to Listeners                       │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                        Protocol Layer                               │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │    │
│  │  │ L01Protocol │  │ A01Protocol │  │ B01Protocol │  │ V01Protocol │  │    │
│  │  │ • Builder   │  │ • Builder   │  │ • Builder   │  │ • Builder   │  │    │
│  │  │ • Serializer│  │ • Serializer│  │ • Serializer│  │ • Serializer│  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

### Root Structure

```
src/
├── module.ts                    # Main platform entry point
├── platformRunner.ts            # Orchestrates device updates
├── roborockService.ts           # Service facade
├── roborockVacuumCleaner.ts     # RVC (Robot Vacuum Cleaner) class
├── behaviorFactory.ts           # Behavior creation
├── filterLogger.ts              # Logger with sensitive data filtering
├── helper.ts                    # Utility functions
├── notifyMessageTypes.ts        # Message type enums
├── settings.ts                  # Plugin configuration
│
├── platform/                    # Platform layer (NEW)
│   ├── platformLifecycle.ts     # Lifecycle methods
│   ├── platformConfig.ts        # Config validation
│   ├── platformState.ts         # State management
│   └── deviceRegistry.ts        # Device/robot registry
│
├── core/                        # Core domain layer (NEW)
│   ├── ServiceContainer.ts      # Port adapter DI container
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── Device.ts
│   │   │   ├── Home.ts
│   │   │   └── Room.ts
│   │   └── value-objects/
│   │       ├── DeviceId.ts
│   │       └── CleanMode.ts
│   └── ports/
│       ├── IDeviceGateway.ts
│       ├── IAuthGateway.ts
│       └── IMessageBroker.ts
│
├── services/                    # Service layer
│   ├── serviceContainer.ts      # Main DI container
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
│   ├── BehaviorDeviceGeneric.ts
│   └── roborock.vacuum/
│       ├── default/
│       │   ├── default.ts
│       │   ├── initialData.ts
│       │   └── runtimes.ts
│       └── smart/
│           ├── smart.ts
│           ├── initialData.ts
│           └── runtimes.ts
│
├── roborockCommunication/       # Communication layer
│   ├── adapters/                # Port adapters (NEW)
│   │   ├── RoborockAuthGateway.ts
│   │   └── RoborockDeviceGateway.ts
│   │
│   ├── api/                     # REST API clients (NEW location)
│   │   ├── authClient.ts        # Authentication API
│   │   └── iotClient.ts         # IoT API
│   │
│   ├── mqtt/                    # MQTT communication (NEW location)
│   │   ├── mqttClient.ts
│   │   └── messageProcessor.ts
│   │
│   ├── local/                   # Local network (NEW location)
│   │   ├── localClient.ts
│   │   └── udpClient.ts
│   │
│   ├── protocol/                # Protocol handling (NEW location)
│   │   ├── builders/
│   │   │   ├── A01MessageBodyBuilder.ts
│   │   │   ├── B01MessageBodyBuilder.ts
│   │   │   ├── L01MessageBodyBuilder.ts
│   │   │   ├── V01MessageBodyBuilder.ts
│   │   │   └── UnknownMessageBodyBuilder.ts
│   │   ├── serializers/
│   │   │   ├── A01Serializer.ts
│   │   │   ├── B01Serializer.ts
│   │   │   ├── L01Serializer.ts
│   │   │   ├── V01Serializer.ts
│   │   │   ├── Serializer.ts
│   │   │   └── messageSerializer.ts
│   │   └── deserializers/
│   │       └── messageDeserializer.ts
│   │
│   ├── routing/                 # Message routing (NEW location)
│   │   ├── clientRouter.ts
│   │   ├── abstractClient.ts
│   │   └── listeners/
│   │       └── implementation/
│   │           ├── simpleMessageListener.ts
│   │           ├── syncMessageListener.ts
│   │           ├── connectionStateListener.ts
│   │           ├── chainedMessageListener.ts
│   │           └── chainedConnectionListener.ts
│   │
│   ├── models/                  # Data models (NEW location)
│   │   ├── device.ts
│   │   ├── home.ts
│   │   ├── room.ts
│   │   ├── userData.ts
│   │   ├── requestMessage.ts
│   │   ├── responseMessage.ts
│   │   └── index.ts
│   │
│   ├── enums/                   # Enumerations (NEW location)
│   │   ├── protocolVersion.ts
│   │   ├── operationStatusCode.ts
│   │   └── index.ts
│   │
│   ├── helper/                  # Communication helpers
│   │   ├── messageBodyBuilderFactory.ts
│   │   ├── messageProcessorFactory.ts
│   │   └── cryptoHelper.ts
│   │
│   ├── RESTAPI/                 # Legacy location (deprecated)
│   ├── broadcast/               # Legacy location (deprecated)
│   ├── builder/                 # Legacy location (deprecated)
│   ├── serializer/              # Legacy location (deprecated)
│   ├── Zenum/                   # Legacy location (deprecated)
│   └── Zmodel/                  # Legacy location (deprecated)
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
│   ├── DockingStationStatus.ts
│   ├── ExperimentalFeatureSetting.ts
│   ├── RoomIndexMap.ts
│   └── RoomMap.ts
│
├── types/                       # TypeScript type definitions
│   ├── callbacks.ts
│   ├── communication.ts
│   ├── config.ts
│   ├── device.ts
│   ├── factories.ts
│   ├── MessagePayloads.ts
│   ├── state.ts
│   └── index.ts
│
├── share/                       # Shared utilities
│   ├── function.ts
│   └── runtimeHelper.ts
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

### 3. **RoborockVacuumCleaner** ([roborockVacuumCleaner.ts](../src/roborockVacuumCleaner.ts))

**Responsibility:** Represents a single Roborock device in Matter ecosystem

**Key Features:**

- Extends Matterbridge endpoint
- Manages device-specific behaviors
- Handles Matter cluster interactions
- Tracks device state and configuration

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

### Structure (After Migration)

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
│   ├── builders/
│   ├── serializers/
│   └── deserializers/
├── routing/                     # Message routing
│   ├── clientRouter.ts
│   ├── abstractClient.ts
│   └── listeners/
├── models/                      # Data models
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

| Protocol | Builder               | Serializer    | Description       |
| -------- | --------------------- | ------------- | ----------------- |
| L01      | L01MessageBodyBuilder | L01Serializer | Legacy protocol   |
| A01      | A01MessageBodyBuilder | A01Serializer | Standard protocol |
| B01      | B01MessageBodyBuilder | B01Serializer | Extended protocol |
| V01      | V01MessageBodyBuilder | V01Serializer | Latest protocol   |

---

## Behavior System

Located in: [src/behaviors/](../src/behaviors/)

### Architecture

```
BehaviorDeviceGeneric (base class)
    │
    ├── DefaultBehavior (default vacuum behavior)
    └── SmartBehavior (advanced vacuum behavior)
```

### **DefaultBehavior** ([default/default.ts](../src/behaviors/roborock.vacuum/default/default.ts))

**Features:**

- Basic cleaning operations (start, pause, dock)
- Battery status monitoring
- Operational state management

**Supported Clusters:**

- RvcRunMode
- RvcOperationalState
- RvcCleanMode
- PowerSource

### **SmartBehavior** ([smart/smart.ts](../src/behaviors/roborock.vacuum/smart/smart.ts))

**Additional Features:**

- ServiceArea cluster support
- Room-based cleaning
- Multi-area cleaning
- Map-based navigation

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

**Document Version:** 3.0
**Last Updated:** January 24, 2026
