# Matterbridge Roborock Vacuum Plugin - Code Structure

**Version:** 1.1.1-rc14  
**Last Updated:** January 13, 2026  
**Test Coverage:** 95.74% (873 tests passed)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Patterns](#architecture-patterns)
3. [Directory Structure](#directory-structure)
4. [Core Components](#core-components)
5. [Service Layer](#service-layer)
6. [Communication Layer](#communication-layer)
7. [Behavior System](#behavior-system)
8. [Data Flow](#data-flow)
9. [Key Design Patterns](#key-design-patterns)
10. [Testing Strategy](#testing-strategy)

---

## Overview

This plugin integrates Roborock vacuum cleaners into the Matter ecosystem via Matterbridge. It enables control through Apple Home and other Matter-compatible applications.

**Key Technologies:**

- TypeScript 5.x targeting ESNext
- Matterbridge 3.4.6
- Vitest for unit testing
- MQTT for real-time device communication
- REST API for Roborock cloud services

**Main Entry Point:** [src/module.ts](../src/module.ts)

---

## Architecture Patterns

### 1. **Layered Architecture**

```
┌─────────────────────────────────────────┐
│   Matter Protocol Layer (Matterbridge) │
├─────────────────────────────────────────┤
│   Platform Layer (module.ts)           │
├─────────────────────────────────────────┤
│   Service Layer (Services)              │
├─────────────────────────────────────────┤
│   Behavior Layer (Device Behaviors)     │
├─────────────────────────────────────────┤
│   Communication Layer (MQTT + REST)     │
├─────────────────────────────────────────┤
│   Roborock IoT Platform                 │
└─────────────────────────────────────────┘
```

### 2. **Dependency Injection**

- `ServiceContainer` manages service lifecycle
- Services are lazy-loaded singletons
- Facilitates testing and modularity

### 3. **Facade Pattern**

- `RoborockService` acts as facade over specialized services
- Maintains backward compatibility
- Reduced from 923 lines to ~300 lines

### 4. **Factory Pattern**

- `behaviorFactory.ts` creates device-specific behaviors
- `messageBodyBuilderFactory.ts` creates protocol-specific builders
- `messageProcessorFactory.ts` routes messages based on protocol

---

## Directory Structure

### Root Structure

```
src/
├── module.ts                    # Main platform entry point
├── platformRunner.ts            # Orchestrates device updates
├── roborockService.ts           # Service facade
├── behaviorFactory.ts           # Behavior creation
├── helper.ts                    # Utility functions
├── notifyMessageTypes.ts        # Message type enums
├── settings.ts                  # Plugin configuration
├── rvc.ts                       # RVC (Robot Vacuum Cleaner) class
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
├── constants/                   # Constant definitions
│   ├── battery.ts
│   ├── device.ts
│   ├── distance.ts
│   ├── ids.ts
│   ├── index.ts
│   └── timeouts.ts
├── errors/                      # Custom error classes
│   ├── AuthenticationError.ts
│   ├── BaseError.ts
│   ├── CommunicationError.ts
│   ├── ConfigurationError.ts
│   ├── DeviceError.ts
│   ├── ValidationError.ts
│   └── index.ts
├── initialData/                 # Initial data fetchers
│   ├── getBatteryStatus.ts
│   ├── getOperationalStates.ts
│   ├── getSupportedAreas.ts
│   ├── getSupportedCleanModes.ts
│   ├── getSupportedRunModes.ts
│   ├── getSupportedScenes.ts
│   ├── index.ts
│   └── regionUrls.ts
├── model/                       # Data models
│   ├── CloudMessageModel.ts
│   ├── DockingStationStatus.ts
│   ├── ExperimentalFeatureSetting.ts
│   ├── RoomIndexMap.ts
│   └── RoomMap.ts
├── roborockCommunication/       # Communication layer
│   ├── RESTAPI/
│   │   ├── roborockAuthenticateApi.ts
│   │   └── roborockIoTApi.ts
│   ├── broadcast/
│   │   ├── abstractClient.ts
│   │   ├── clientRouter.ts
│   │   ├── messageProcessor.ts
│   │   ├── model/
│   │   ├── client/
│   │   │   ├── MQTTClient.ts
│   │   │   └── LocalNetworkClient.ts
│   │   └── listener/
│   │       ├── abstractConnectionListener.ts
│   │       ├── abstractMessageHandler.ts
│   │       ├── abstractMessageListener.ts
│   │       ├── index.ts
│   │       └── implementation/
│   │           ├── chainedConnectionListener.ts
│   │           ├── chainedMessageListener.ts
│   │           ├── connectionStateListener.ts
│   │           ├── mapResponseListener.ts
│   │           ├── pingResponseListener.ts
│   │           ├── simpleMessageListener.ts
│   │           ├── statusMessageListener.ts
│   │           └── syncMessageListener.ts
│   ├── builder/
│   │   ├── A01MessageBodyBuilder.ts
│   │   ├── B01MessageBodyBuilder.ts
│   │   ├── L01MessageBodyBuilder.ts
│   │   ├── V01MessageBodyBuilder.ts
│   │   └── UnknownMessageBodyBuilder.ts
│   ├── helper/
│   │   ├── chunkBuffer.ts
│   │   ├── cryptoHelper.ts
│   │   ├── messageBodyBuilderFactory.ts
│   │   ├── messageDeserializer.ts
│   │   ├── messageProcessorFactory.ts
│   │   ├── messageSerializer.ts
│   │   ├── nameDecoder.ts
│   │   └── sequence.ts
│   ├── serializer/
│   │   ├── A01Serializer.ts
│   │   ├── B01Serializer.ts
│   │   ├── L01Serializer.ts
│   │   ├── V01Serializer.ts
│   │   └── Serializer.ts
│   ├── Zenum/
│   └── Zmodel/
├── runtimes/                    # Message runtime handlers
│   ├── handleCloudMessage.ts
│   ├── handleHomeDataMessage.ts
│   └── handleLocalMessage.ts
├── services/                    # Service layer
│   ├── areaManagementService.ts
│   ├── authenticationService.ts
│   ├── clientManager.ts
│   ├── connectionService.ts
│   ├── deviceManagementService.ts
│   ├── index.ts
│   ├── messageRoutingService.ts
│   ├── pollingService.ts
│   └── serviceContainer.ts
├── share/                       # Shared utilities
│   ├── function.ts
│   └── runtimeHelper.ts
├── tests/                       # Unit tests
│   ├── behaviors/
│   ├── errors/
│   ├── helpers/
│   ├── initialData/
│   ├── model/
│   ├── roborockCommunication/
│   ├── runtimes/
│   ├── services/
│   ├── share/
│   ├── testData/
│   ├── helper.test.ts
│   ├── platform.region.test.ts
│   ├── platformRunner*.test.ts
│   └── roborockService*.test.ts
├── types/                       # TypeScript type definitions
│   ├── MessagePayloads.ts
│   ├── callbacks.ts
│   ├── communication.ts
│   ├── config.ts
│   ├── device.ts
│   ├── factories.ts
│   ├── index.ts
│   └── state.ts
```

### Key Configuration Files

- **package.json** - Project metadata, dependencies, scripts
- **tsconfig.json** - TypeScript configuration (ES2022 target)
- **vitest.config.ts** - Vitest test configuration
- **eslint.config.js** - ESLint rules
- **prettier.config.js** - Code formatting rules

---

## Core Components

### 1. **RoborockMatterbridgePlatform** ([module.ts](../src/module.ts))

**Responsibility:** Main platform class extending `MatterbridgeDynamicPlatform`

**Key Properties:**

```typescript
robots: Map<string, RoborockVacuumCleaner>  // Active robot devices
devices: Map<string, Device>                 // Device metadata
roborockService: RoborockService            // Service facade
platformRunner: PlatformRunner              // Update orchestrator
clientManager: ClientManager                // MQTT client manager
```

**Key Methods:**

- `onStart()` - Platform initialization
- `onConfigure()` - Device configuration
- `onShutdown()` - Cleanup
- `registerDevice()` - Register new robot
- `unregisterDevice()` - Remove robot

### 2. **PlatformRunner** ([platformRunner.ts](../src/platformRunner.ts))

**Responsibility:** Orchestrates device state updates from various message sources

**Key Methods:**

- `updateRobot()` - Routes messages to appropriate handlers
- `requestHomeData()` - Polls for device state updates
- `updateFromMQTTMessage()` - Processes MQTT messages

**Message Flow:**

```
MQTT/Cloud → PlatformRunner → Runtime Handlers → Robot Update
```

### 3. **RoborockVacuumCleaner** ([rvc.ts](../src/rvc.ts))

**Responsibility:** Represents a single Roborock device in Matter ecosystem

**Key Features:**

- Extends Matterbridge endpoint
- Manages device-specific behaviors
- Handles Matter cluster interactions
- Tracks device state and configuration

---

## Service Layer

Located in: [src/services/](../src/services/)

**File Naming Convention:** All service files use camelCase naming (e.g., `authenticationService.ts`, `deviceManagementService.ts`)

### **ServiceContainer** ([serviceContainer.ts](../src/services/serviceContainer.ts))

**Responsibility:** Dependency injection container

**Services Managed:**

1. AuthenticationService
2. DeviceManagementService
3. AreaManagementService
4. MessageRoutingService
5. ConnectionService (NEW - extracted from DeviceManagementService)
6. PollingService (NEW - extracted from DeviceManagementService)

**Configuration:**

```typescript
interface ServiceContainerConfig {
  baseUrl: string;              // API endpoint
  refreshInterval: number;      // Polling interval
  authenticateApiFactory?: ...  // Auth API factory
  iotApiFactory?: ...          // IoT API factory
}
```

### **1. AuthenticationService** ([authenticationService.ts](../src/services/authenticationService.ts))

**Responsibilities:**

- User authentication flow
- Token management
- Session handling
- Email verification code handling

**Key Methods:**

- `requestVerificationCode()` - Send code to email
- `loginWithVerificationCode()` - Authenticate with code
- `getUserData()` - Get current user data

**Rate Limiting:** 60 seconds between verification code requests

### **2. DeviceManagementService** ([deviceManagementService.ts](../src/services/deviceManagementService.ts))

**Responsibilities:**

- Device discovery and listing
- Delegates connection management to ConnectionService
- Delegates polling to PollingService
- Device lifecycle coordination

**Key Methods:**

- `listDevices()` - Fetch all devices for user
- `connectDevice()` - Initiate device connection
- `shutdownDevice()` - Cleanup device resources

**Refactoring:**

- Previously 506 lines, now more focused
- Connection logic extracted to ConnectionService
- Polling logic extracted to PollingService

### **3. AreaManagementService** ([areaManagementService.ts](../src/services/areaManagementService.ts))

**Responsibilities:**

- Room/area management
- Map data processing
- Area-based cleaning coordination

**Key Methods:**

- `getRoomIndexMap()` - Get room ID to index mapping
- `processAreaData()` - Process map information

### **4. MessageRoutingService** ([messageRoutingService.ts](../src/services/messageRoutingService.ts))

**Responsibilities:**

- Message subscription management
- Notification routing
- Event handler registration

**Key Methods:**

- `subscribeToMessages()` - Subscribe to device messages
- `unsubscribeFromMessages()` - Cleanup subscriptions
- `routeMessage()` - Route incoming messages

### **5. ClientManager** ([clientManager.ts](../src/services/clientManager.ts))

**Responsibilities:**

- MQTT client lifecycle management
- Client instance caching
- Client cleanup

**Key Methods:**

- `get()` - Get or create client instance
- `shutdown()` - Close all clients

### **6. ConnectionService** ([connectionService.ts](../src/services/connectionService.ts))

**Responsibilities:**

- MQTT client initialization and connection
- Local network client registration
- Connection timeout handling
- Message listener setup

**Key Methods:**

- `initializeMessageClient()` - Setup MQTT connection
- `registerLocalClient()` - Setup local network connection
- `waitForConnection()` - Connection timeout handling
- `setDeviceNotify()` - Set device notification callback

**Connection Management:**

- Max 10 connection attempts
- 100ms delay between attempts
- Automatic timeout error handling

**Coverage:** 98.11%

### **7. PollingService** ([pollingService.ts](../src/services/pollingService.ts))

**Responsibilities:**

- Device status polling over local and MQTT
- Refresh interval management
- Polling lifecycle (start/stop)
- Status update notifications

**Key Methods:**

- `activateDeviceNotifyOverLocal()` - Start local polling
- `activateDeviceNotifyOverMQTT()` - Start MQTT polling
- `stopPolling()` - Stop all polling for device

**Polling Strategy:**

- Local network: 2x refresh interval
- MQTT: 1x refresh interval
- Automatic cleanup on errors

**Coverage:** 100%

---

## Communication Layer

Located in: [src/roborockCommunication/](../src/roborockCommunication/)

### Structure

```
roborockCommunication/
├── RESTAPI/           # REST API clients
│   ├── roborockAuthenticateApi.ts
│   └── roborockIoTApi.ts
│
├── broadcast/         # MQTT communication
│   ├── client/        # Client implementations
│   │   ├── MQTTClient.ts
│   │   └── LocalNetworkClient.ts
│   ├── listener/      # Message listeners
│   │   ├── abstractConnectionListener.ts
│   │   ├── abstractMessageHandler.ts
│   │   ├── abstractMessageListener.ts
│   │   ├── index.ts
│   │   └── implementation/
│   │       ├── chainedConnectionListener.ts
│   │       ├── chainedMessageListener.ts
│   │       ├── connectionStateListener.ts
│   │       ├── mapResponseListener.ts
│   │       ├── pingResponseListener.ts
│   │       ├── simpleMessageListener.ts
│   │       ├── statusMessageListener.ts
│   │       └── syncMessageListener.ts
│   ├── model/        # Message models
│   ├── abstractClient.ts
│   ├── clientRouter.ts
│   └── messageProcessor.ts
│
├── builder/           # Message builders
│   ├── A01MessageBodyBuilder.ts
│   ├── B01MessageBodyBuilder.ts
│   ├── L01MessageBodyBuilder.ts
│   ├── V01MessageBodyBuilder.ts
│   └── UnknownMessageBodyBuilder.ts
│
├── helper/            # Communication helpers
│   ├── chunkBuffer.ts
│   ├── cryptoHelper.ts
│   ├── messageBodyBuilderFactory.ts
│   ├── messageDeserializer.ts
│   ├── messageProcessorFactory.ts
│   ├── messageSerializer.ts
│   ├── nameDecoder.ts
│   └── sequence.ts
│
├── serializer/        # Protocol serializers
│   ├── A01Serializer.ts
│   ├── B01Serializer.ts
│   ├── L01Serializer.ts
│   ├── V01Serializer.ts
│   └── Serializer.ts
│
├── Zenum/             # Enumerations
└── Zmodel/            # Data models
```

### **REST API Layer**

#### **RoborockAuthenticateApi** ([roborockAuthenticateApi.ts](../src/roborockCommunication/RESTAPI/roborockAuthenticateApi.ts))

**Purpose:** Handle authentication with Roborock cloud

**Key Methods:**

- `sendEmailCode()` - Request verification code
- `requestCode()` - Alternative code request
- `loginWithCode()` - Login with verification code

**Response Codes:**

- `200` - Success
- `1001` - Invalid credentials
- `1002` - Rate limited

#### **RoborockIoTApi** ([roborockIoTApi.ts](../src/roborockCommunication/RESTAPI/roborockIoTApi.ts))

**Purpose:** Interact with device IoT endpoints

**Key Methods:**

- `getHomeData()` - Fetch home and device data
- `getDeviceList()` - List all devices
- `executeCommand()` - Send commands to devices

### **MQTT Broadcast Layer**

#### **Client Architecture**

```
ClientRouter (facade)
    ├── MQTTClient (cloud connection)
    └── LocalNetworkClient (LAN connection)
```

#### **ClientRouter** ([clientRouter.ts](../src/roborockCommunication/broadcast/clientRouter.ts))

**Purpose:** Route messages to appropriate client (MQTT or local)

**Key Methods:**

- `sendRequest()` - Send command to device
- `registerDevice()` - Register device with client
- `isConnected()` - Check connection status

#### **MQTTClient** ([MQTTClient.ts](../src/roborockCommunication/broadcast/client/MQTTClient.ts))

**Purpose:** Cloud-based MQTT communication

**Features:**

- TLS encrypted connection
- Automatic reconnection
- Message queuing
- Protocol version handling

#### **LocalNetworkClient** ([LocalNetworkClient.ts](../src/roborockCommunication/broadcast/client/LocalNetworkClient.ts))

**Purpose:** Direct UDP communication over LAN

**Features:**

- Lower latency than cloud
- No internet dependency
- Local network discovery

#### **MessageProcessor** ([messageProcessor.ts](../src/roborockCommunication/broadcast/messageProcessor.ts))

**Purpose:** Process incoming MQTT messages

**Processing Flow:**

```
Raw Message → Deserialize → Validate → Route to Listeners
```

**Key Methods:**

- `processMessage()` - Main processing entry
- `registerListener()` - Add message listener
- `unregisterListener()` - Remove listener

### **Message Listeners**

Located in: [broadcast/listener/implementation/](../src/roborockCommunication/broadcast/listener/implementation/)

**Listener Types:**

1. **SimpleMessageListener** - Basic message handling
2. **SyncMessageListener** - Synchronous message waiting
3. **ConnectionStateListener** - Connection events
4. **ChainedMessageListener** - Multiple listeners in sequence
5. **ChainedConnectionListener** - Multiple connection listeners

### **Protocol Support**

**Serializers:** [serializer/](../src/roborockCommunication/serializer/)

- **A01Serializer** - Protocol version A01
- **B01Serializer** - Protocol version B01
- **L01Serializer** - Protocol version L01
- **V01Serializer** - Protocol version V01

**Builders:** [builder/](../src/roborockCommunication/builder/)

- **A01MessageBodyBuilder**
- **B01MessageBodyBuilder**
- **L01MessageBodyBuilder**
- **UnknownMessageBodyBuilder**
- **V01MessageBodyBuilder**

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

### **BehaviorDeviceGeneric** ([BehaviorDeviceGeneric.ts](../src/behaviors/BehaviorDeviceGeneric.ts))

**Purpose:** Abstract base class for device behaviors

**Key Responsibilities:**

- Define common behavior interface
- Provide shared utility methods
- Enforce behavior contract

### **DefaultBehavior** ([default/default.ts](../src/behaviors/roborock.vacuum/default/default.ts))

**Purpose:** Standard vacuum control behavior

**Features:**

- Basic cleaning operations (start, pause, dock)
- Battery status monitoring
- Operational state management
- Error handling

**Supported Clusters:**

- RvcRunMode
- RvcOperationalState
- RvcCleanMode
- PowerSource

**Key Files:**

- [default.ts](../src/behaviors/roborock.vacuum/default/default.ts) - Main behavior
- [initialData.ts](../src/behaviors/roborock.vacuum/default/initialData.ts) - Initial data setup
- [runtimes.ts](../src/behaviors/roborock.vacuum/default/runtimes.ts) - Runtime handlers

### **SmartBehavior** ([smart/smart.ts](../src/behaviors/roborock.vacuum/smart/smart.ts))

**Purpose:** Advanced vacuum control with area cleaning

**Additional Features:**

- ServiceArea cluster support
- Room-based cleaning
- Multi-area cleaning
- Map-based navigation

**Key Files:**

- [smart.ts](../src/behaviors/roborock.vacuum/smart/smart.ts) - Main behavior
- [initialData.ts](../src/behaviors/roborock.vacuum/smart/initialData.ts) - Initial data setup
- [runtimes.ts](../src/behaviors/roborock.vacuum/smart/runtimes.ts) - Runtime handlers

### **Behavior Factory** ([behaviorFactory.ts](../src/behaviorFactory.ts))

**Purpose:** Create appropriate behavior based on device capabilities

**Selection Logic:**

```typescript
if (device.supportsAreaCleaning && enableExperimental.cleanByArea) {
  return SmartBehavior
} else {
  return DefaultBehavior
}
```

---

## Data Flow

### 1. **Authentication Flow**

```
User Input (Email)
    ↓
AuthenticationService.requestVerificationCode()
    ↓
RoborockAuthenticateApi.sendEmailCode()
    ↓
User receives code via email
    ↓
AuthenticationService.loginWithVerificationCode()
    ↓
RoborockAuthenticateApi.loginWithCode()
    ↓
UserData stored → ServiceContainer.setUserData()
```

### 2. **Device Discovery Flow**

```
DeviceManagementService.listDevices()
    ↓
RoborockIoTApi.getHomeData()
    ↓
Parse devices and homes
    ↓
Filter by whitelist/blacklist
    ↓
Create RoborockVacuumCleaner instances
    ↓
Register with Matterbridge
```

### 3. **Message Update Flow**

```
MQTT Message Received
    ↓
MessageProcessor.processMessage()
    ↓
Deserialize and validate
    ↓
Route to registered listeners
    ↓
PlatformRunner.updateRobot()
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
RoborockService command method
    ↓
ClientRouter.sendRequest()
    ↓
MQTTClient/LocalNetworkClient
    ↓
Roborock Device
```

---

## Key Design Patterns

### 1. **Service Locator Pattern**

- `ServiceContainer` provides centralized service access
- Services registered and retrieved by type
- Lazy initialization

### 2. **Observer Pattern**

- Message listeners observe MQTT messages
- Platform observes device state changes
- Event-driven updates

### 3. **Strategy Pattern**

- Different behaviors (Default vs Smart) for different devices
- Protocol-specific serializers
- Message builders by protocol version

### 4. **Factory Pattern**

- `behaviorFactory` creates behaviors
- `messageBodyBuilderFactory` creates builders
- `messageProcessorFactory` creates processors

### 5. **Facade Pattern**

- `RoborockService` simplifies complex service interactions
- `ClientRouter` simplifies client selection
- Clear public APIs hide complexity

### 6. **Template Method Pattern**

- `BehaviorDeviceGeneric` defines behavior template
- Subclasses implement specific steps
- Common flow, customizable details

---

## Testing Strategy

### Test Coverage Summary

**Overall:** 95.74% statement coverage (873 tests)

**Coverage by Layer:**

- Plugin Template: 97.76%
- Main Source: ~95%
- Behaviors: 98-100%
- Communication: 94-100%
- Services: 90.76%
  - ConnectionService: 98.11%
  - PollingService: 100%
  - AuthenticationService: 91.83%
  - DeviceManagementService: 82.91%
  - MessageRoutingService: 92.53%
- Runtimes: 92.38%

### Test Organization

```
src/tests/
├── behaviors/                  # Behavior tests
├── errors/                     # Error class tests
│   ├── authenticationError.test.ts
│   ├── communicationError.test.ts
│   ├── configurationError.test.ts
│   ├── deviceError.test.ts (NEW)
│   └── validationError.test.ts
├── initialData/                # Initial data fetcher tests
├── model/                      # Model tests
├── roborockCommunication/      # Communication layer tests
├── runtimes/                   # Runtime handler tests
├── services/                   # Service layer tests (camelCase naming)
│   ├── areaManagementService.test.ts
│   ├── authenticationService.test.ts
│   ├── clientManager.test.ts
│   ├── connectionService.test.ts (NEW)
│   ├── deviceManagementService.test.ts
│   ├── messageRoutingService.test.ts
│   ├── pollingService.test.ts (NEW)
│   └── serviceContainer.test.ts
├── share/                      # Shared utility tests
├── testData/                   # Test fixtures and mocks
├── helper.test.ts
├── platform.region.test.ts
├── platformRunner*.test.ts
└── roborockService*.test.ts
```

### Testing Patterns

**1. Unit Tests**

- Test individual functions/methods in isolation
- Mock external dependencies
- Focus on single responsibility

**2. Integration Tests**

- Test service interactions
- Test message flow
- Test protocol handling

**3. Mock Strategy**

- Vitest mocks for external services
- Mock data in `testData/mockData.ts`
- Dependency injection for testability

**4. Skipped Tests**
None - all previously skipped tests have been fixed

- Connection timeout tests in DeviceManagementService: Fixed using `vi.spyOn`
- All 873 tests passing

### Test Commands

```bash
npm run test                  # Run all tests
npm run test -- --coverage   # Run with coverage
npm run test:verbose         # Verbose output
```

---

## Constants and Configuration

### Constants ([src/constants/](../src/constants/))

**Files:**

- **battery.ts** - Battery level thresholds
- **device.ts** - Device type identifiers
- **distance.ts** - Distance/measurement constants
- **ids.ts** - Cluster and endpoint IDs
- **timeouts.ts** - Timeout durations

**Key Timeouts:**

- `VERIFICATION_CODE_RATE_LIMIT_MS: 60000` (1 minute)
- `DEFAULT_REFRESH_INTERVAL_SECONDS: 30`
- `REFRESH_INTERVAL_BUFFER_MS: 2000`
- `UNREGISTER_DEVICES_DELAY_MS: 3000`

### Initial Data ([src/initialData/](../src/initialData/))

**Purpose:** Fetch and prepare initial device data

**Files:**

- **getBatteryStatus.ts** - Battery cluster initialization
- **getOperationalStates.ts** - Operational state mapping
- **getSupportedAreas.ts** - Service area support
- **getSupportedCleanModes.ts** - Clean mode options
- **getSupportedRunModes.ts** - Run mode options
- **getSupportedScenes.ts** - Scene support
- **regionUrls.ts** - Region-specific API URLs

---

## Error Handling

Located in: [src/errors/](../src/errors/)

### Error Hierarchy

```
BaseError
    ├── AuthenticationError
    ├── CommunicationError
    ├── ConfigurationError
    ├── DeviceError
    └── ValidationError
```

### Error Classes

**1. BaseError** ([BaseError.ts](../src/errors/BaseError.ts))

- Base class for all custom errors
- Provides error code support
- Maintains stack traces

**2. AuthenticationError** ([AuthenticationError.ts](../src/errors/AuthenticationError.ts))

- Login failures
- Token expiration
- Invalid credentials

**3. CommunicationError** ([CommunicationError.ts](../src/errors/CommunicationError.ts))

- Network failures
- MQTT connection issues
- Timeout errors

**4. ConfigurationError** ([ConfigurationError.ts](../src/errors/ConfigurationError.ts))

- Invalid plugin configuration
- Missing required settings
- Validation failures

**5. DeviceError** ([DeviceError.ts](../src/errors/DeviceError.ts))

- Device operation failures
- Unsupported operations
- Device-specific errors

**6. ValidationError** ([ValidationError.ts](../src/errors/ValidationError.ts))

- Input validation failures
- Schema validation errors
- Data format errors

---

## Domain Models

### Entities ([src/domain/entities/](../src/domain/entities/))

**Purpose:** Core business entities with identity

### Value Objects ([src/domain/valueObjects/](../src/domain/valueObjects/))

**Purpose:** Immutable value types

### Models ([src/model/](../src/model/))

**Key Models:**

**1. DockingStationStatus** ([DockingStationStatus.ts](../src/model/DockingStationStatus.ts))

- Docking station state
- Dust collection status
- Error states

**2. ExperimentalFeatureSetting** ([ExperimentalFeatureSetting.ts](../src/model/ExperimentalFeatureSetting.ts))

- Feature flags
- Authentication payload
- Clean mode settings

**3. RoomIndexMap** ([RoomIndexMap.ts](../src/model/RoomIndexMap.ts))

- Room ID to index mapping
- Area identification

**4. RoomMap** ([RoomMap.ts](../src/model/RoomMap.ts))

- Room definitions
- Map metadata

**5. CloudMessageModel** ([CloudMessageModel.ts](../src/model/CloudMessageModel.ts))

- Cloud message structure
- Message routing data

---

## Runtime Handlers

Located in: [src/runtimes/](../src/runtimes/)

### **handleLocalMessage** ([handleLocalMessage.ts](../src/runtimes/handleLocalMessage.ts))

**Purpose:** Process local network messages

**Handles:**

- Device status updates
- Battery notifications
- Error states

### **handleCloudMessage** ([handleCloudMessage.ts](../src/runtimes/handleCloudMessage.ts))

**Purpose:** Process cloud MQTT messages

**Handles:**

- Remote commands
- Cloud status updates
- Synchronization events

### **handleHomeDataMessage** ([handleHomeDataMessage.ts](../src/runtimes/handleHomeDataMessage.ts))

**Purpose:** Process home data updates

**Handles:**

- Device discovery
- Home structure updates
- Multi-device coordination

---

## Utility and Helper Functions

### **helper.ts** ([helper.ts](../src/helper.ts))

**Key Functions:**

- `isSupportedDevice()` - Check device compatibility
- `getRoomMapFromDevice()` - Extract room mapping
- `parseDeviceCapabilities()` - Parse device features

### **share/function.ts** ([share/function.ts](../src/share/function.ts))

**Shared Utilities:**

- Common transformations
- Data validation
- Format conversions

### **share/runtimeHelper.ts** ([share/runtimeHelper.ts](../src/share/runtimeHelper.ts))

**Runtime Utilities:**

- State management helpers
- Update coordination
- Change detection

### **types/MessagePayloads.ts** ([types/MessagePayloads.ts](../src/types/MessagePayloads.ts))

**Discriminated Union Types:**

- Type-safe message payload handling
- Compile-time message type checking
- Improved message routing safety

**Message Payload Types:**

```typescript
type MessagePayload =
  | { type: NotifyMessageTypes.CloudMessage; data: ResponseMessage }
  | { type: NotifyMessageTypes.LocalMessage; data: ResponseMessage }
  | { type: NotifyMessageTypes.HomeDataMessage; data: Home[] }
```

---

## Development Guidelines

### Build Process

```bash
npm run build              # Compile TypeScript
npm run buildProduction    # Production build
npm run watch             # Watch mode
npm run type-check        # Type checking only
```

### Code Quality

```bash
npm run lint              # ESLint
npm run format            # Prettier
npm run deepCleanB        # Full rebuild
```

### Debugging

- **Debug Mode:** Set `debug: true` in config
- **Logs:** Use `AnsiLogger` for structured logging
- **Levels:** error, warn, info, debug

### Plugin Configuration

**Config File:** `matterbridge-roborock-vacuum-plugin.config.json`

**Schema:** `matterbridge-roborock-vacuum-plugin.schema.json`

**Key Settings:**

```json
{
  "whiteList": [],
  "blackList": [],
  "useInterval": true,
  "refreshInterval": 30,
  "debug": false,
  "authentication": {},
  "enableExperimental": {}
}
```

---

## Dependencies

### Core Dependencies

- **matterbridge:** Matter protocol integration
- **matter.js:** Matter specification implementation
- **node-ansi-logger:** Structured logging
- **mqtt:** MQTT client
- **axios:** HTTP client
- **node-persist:** Data persistence

### Development Dependencies

- **TypeScript:** 5.7.3
- **Vitest:** See package.json
- **ESLint:** 9.18.0
- **Prettier:** 3.4.2

---

## Plugin Lifecycle

### 1. **Initialization (onStart)**

```
Load config → Authenticate → List devices → Register devices → Start polling
```

### 2. **Configuration (onConfigure)**

```
Detect device changes → Add new devices → Remove old devices → Update behaviors
```

### 3. **Runtime**

```
Poll for updates → Process MQTT messages → Update device states → Sync with Matter
```

### 4. **Shutdown (onShutdown)**

```
Stop polling → Close MQTT clients → Unregister devices → Cleanup resources
```

---

## References

### Documentation

- [README.md](../README.md) - Main documentation
- [README_DEV.md](../README_DEV.md) - Developer guide
- [README_SUPPORTED.md](../README_SUPPORTED.md) - Supported devices
- [README_CLEANMODE.md](../README_CLEANMODE.md) - Clean mode guide
- [README_REPORT_ISSUE.md](../README_REPORT_ISSUE.md) - Issue reporting
- [CODE_STRUCTURE.md](CODE_STRUCTURE.md) - This document
- [PHASE_1-3_IMPROVEMENTS.md](PHASE_1-3_IMPROVEMENTS.md) - Recent improvements and refactoring

### Links

- **GitHub:** https://github.com/RinDevJunior/matterbridge-roborock-vacuum-plugin
- **NPM:** https://www.npmjs.com/package/matterbridge-roborock-vacuum-plugin
- **Matterbridge:** https://www.npmjs.com/package/matterbridge

---

## Notes

- Based on `pluginTemplate` from Matterbridge
- Follows Matterbridge architecture and coding style
- TypeScript 5.x with ESNext output
- Comprehensive test coverage (95.74%)
- Active development (v1.1.1-rc14)

### Recent Improvements (January 2026)

**Service Layer Refactoring:**

- Extracted ConnectionService (172 lines) from DeviceManagementService
- Extracted PollingService (128 lines) from DeviceManagementService
- Improved Single Responsibility Principle adherence
- Better testability and maintainability

**Type Safety:**

- Added discriminated union types for message payloads
- Compile-time message type checking
- Reduced runtime errors

**File Naming:**

- Standardized all service files to camelCase
- Consistent with project-wide naming conventions
- Updated all imports and references

**Code Quality:**

- Removed anti-patterns (`const self = this`)
- Extracted magic numbers to constants
- Added comprehensive error tests
- Fixed all skipped tests

---

**Document Version:** 2.1  
**Last Updated:** January 13, 2026
