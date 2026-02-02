import { vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import type { PlatformConfigManager } from '../../platform/platformConfig.js';
import type { PlatformMatterbridge, SystemInformation } from 'matterbridge';
import type { RoborockIoTApi } from '../../roborockCommunication/api/iotClient.js';
import type { RoborockAuthenticateApi } from '../../roborockCommunication/api/authClient.js';
import { ClientRouter } from '../../roborockCommunication/routing/clientRouter.js';
import type { Device, UserData } from '../../roborockCommunication/models/index.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';
/**
 * Shared testing utilities for unit tests.
 * Keep these minimal and side-effect free; tests import what they need.
 */

export function createMockLogger(): AnsiLogger {
  return {
    debug: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
  } as Partial<AnsiLogger> as AnsiLogger;
}

export interface MockLocalClient {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  isConnected: ReturnType<typeof vi.fn>;
}

export function makeMockClientRouter(overrides: Partial<Record<string, unknown>> = {}): ClientRouter {
  const localClient: MockLocalClient = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
  };

  return {
    registerDevice: vi.fn(),
    registerMessageListener: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    registerClient: vi.fn().mockReturnValue(localClient),
    updateNonce: vi.fn(),
    destroy: vi.fn(),
    destroyAll: vi.fn(),
    // Add common Client methods used by dispatchers
    send: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as Partial<ClientRouter> as ClientRouter;
}

export function makeLocalClientStub(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    ...overrides,
  } as MockLocalClient;
}

// Lightweight LocalStorage mock that satisfies the subset used in tests
import type { LocalStorage, DatumOptions, WriteFileResult, DeleteFileResult } from 'node-persist';
export function createMockLocalStorage(overrides: Partial<Record<string, unknown>> = {}): LocalStorage {
  const base: Partial<LocalStorage> = {
    init: vi.fn(),
    setOptions: vi.fn(),
    // node-persist LocalStorage methods are async; provide Promise-returning mocks with correct result types
    getItem: vi.fn(async (_k: string) => null),
    setItem: vi.fn(async (_k: string, _v: unknown, _o?: DatumOptions) => ({}) as WriteFileResult),
    removeItem: vi.fn(async (_k: string) => ({}) as DeleteFileResult),
    clear: vi.fn(async () => undefined),
    keys: vi.fn(async () => []),
  };

  // Wrap any provided overrides that may be sync into async wrappers so the resulting shape matches LocalStorage
  const result: Partial<LocalStorage> = { ...base };

  if (overrides.getItem) {
    const f = overrides.getItem as (...a: any[]) => any;
    result.getItem = vi.fn(async (...a: any[]) => Promise.resolve(f(...a)));
  }
  if (overrides.setItem) {
    const f = overrides.setItem as (...a: any[]) => any;
    result.setItem = vi.fn(async (...a: any[]) => Promise.resolve(f(...a)));
  }
  if (overrides.removeItem) {
    const f = overrides.removeItem as (...a: any[]) => any;
    result.removeItem = vi.fn(async (...a: any[]) => Promise.resolve(f(...a)));
  }
  if (overrides.clear) {
    const f = overrides.clear as (...a: any[]) => any;
    result.clear = vi.fn(async (...a: any[]) => Promise.resolve(f(...a)));
  }
  if (overrides.keys) {
    const f = overrides.keys as (...a: any[]) => any;
    result.keys = vi.fn(async (...a: any[]) => Promise.resolve(f(...a)));
  }

  // Copy through any other non-function overrides
  for (const [k, v] of Object.entries(overrides)) {
    if (!['getItem', 'setItem', 'removeItem', 'clear', 'keys'].includes(k)) {
      (result as Record<string, unknown>)[k] = v;
    }
  }

  return result as Partial<LocalStorage> as LocalStorage;
}

export function createMockConfigManager(overrides: Partial<PlatformConfigManager> = {}): PlatformConfigManager {
  const base: Partial<PlatformConfigManager> = {
    get forceRunAtDefault() {
      return overrides.forceRunAtDefault ?? false;
    },
    get useVacationModeToSendVacuumToDock() {
      return overrides.useVacationModeToSendVacuumToDock ?? false;
    },
    get isMultipleMapEnabled() {
      return overrides.isMultipleMapEnabled ?? false;
    },
    get hasWhiteListConfig() {
      return overrides.hasWhiteListConfig ?? false;
    },
    validateConfig: () => true,
    validateAuthentication: () => true,
  };

  return base as Partial<PlatformConfigManager> as PlatformConfigManager;
}

// Generic helper to assert partial objects as full typed instances in tests
export function asPartial<T>(obj: Partial<T>): T {
  return obj as Partial<T> as T;
}

// Small helper to assert a value of unknown origin as a target type in tests where
// the runtime value is intentionally invalid (e.g., undefined/null/primitive) so
// we can assert behavior without scattering `as any`/`as unknown` throughout tests.
export function asType<T>(v: unknown): T {
  return v as T;
}

export function createMockIotApi(overrides: Partial<RoborockIoTApi> = {}): RoborockIoTApi {
  const base: Partial<RoborockIoTApi> = {
    logger: createMockLogger(),
    getHomev2: vi.fn().mockResolvedValue(undefined),
    getHomev3: vi.fn().mockResolvedValue(undefined),
    getHome: vi.fn().mockResolvedValue(undefined),
    getScenes: vi.fn().mockResolvedValue(undefined),
    getHomeWithProducts: vi.fn().mockResolvedValue(undefined),
  };
  return { ...base, ...overrides } as Partial<RoborockIoTApi> as RoborockIoTApi;
}

export function createMockAuthApi(overrides: Partial<RoborockAuthenticateApi> = {}): RoborockAuthenticateApi {
  const base: Partial<RoborockAuthenticateApi> = {
    getBasicHomeInfo: vi.fn().mockResolvedValue(undefined),
  };
  return { ...base, ...overrides } as Partial<RoborockAuthenticateApi> as RoborockAuthenticateApi;
}

// Minimal DeviceRegistry mock factory for tests that need a registry instance
import type { DeviceRegistry } from '../../platform/deviceRegistry.js';
export function createMockDeviceRegistry(overrides: Partial<DeviceRegistry> = {}, robots?: Map<string, RoborockVacuumCleaner>): DeviceRegistry {
  const rmap = robots ?? new Map<string, RoborockVacuumCleaner>();
  const base: Partial<DeviceRegistry> & Record<string, unknown> = {
    robotsMap: rmap,
    devicesMap: new Map<string, Device>(),
    getRobot: (duid: string) => rmap.get(duid),
    hasDevices: vi.fn(() => rmap.size > 0),
    registerRobot: vi.fn((robot: RoborockVacuumCleaner) => undefined),
    register: vi.fn((_device: Device, _robot: RoborockVacuumCleaner) => undefined),
    registerDevice: vi.fn((_device: Device) => undefined),
    unregister: vi.fn((_sn: string) => undefined),
    getDevice: vi.fn((_sn: string) => undefined),
    getAllRobots: vi.fn(() => Array.from(rmap.values())),
    getAllDevices: vi.fn(() => []),
    size: 0,
    clear: vi.fn(),
  };
  return { ...base, ...overrides } as Partial<DeviceRegistry> as DeviceRegistry;
}

// Minimal RoborockService mock factory
import type { RoborockService } from '../../services/roborockService.js';
export function createMockRoborockService(overrides: Partial<RoborockService> = {}): RoborockService {
  const base: Partial<RoborockService> = {
    getHomeDataForUpdating: vi.fn().mockResolvedValue(undefined),
    getSupportedAreas: vi.fn().mockReturnValue([]),
    getSupportedAreasIndexMap: vi.fn().mockReturnValue(new Map()),
    getSelectedAreas: vi.fn().mockReturnValue([]),
    getMapInfo: vi.fn().mockResolvedValue({ maps: [], allRooms: [] }),
    getRoomMap: vi.fn().mockResolvedValue(new Map()),
  };
  return { ...base, ...overrides } as Partial<RoborockService> as RoborockService;
}

export function createMockMatterbridge(overrides: Partial<PlatformMatterbridge> = {}): PlatformMatterbridge {
  const base: Partial<PlatformMatterbridge> & Record<string, unknown> = {
    matterbridgeVersion: '3.5.0',
    matterbridgePluginDirectory: '/tmp',
    matterbridgeDirectory: '/tmp',
    verifyMatterbridgeVersion: () => true,
    systemInformation: {} as Partial<SystemInformation> as SystemInformation,
  };
  return { ...base, ...overrides } as Partial<PlatformMatterbridge> as PlatformMatterbridge;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mkUser = () => asPartial<UserData>({ rriot: { r: { a: 'https://api.example', r: 'r', m: 'm', l: 'l' }, u: 'uid', s: 's', h: 'h', k: 'k' } });

export function setReadOnlyProperty<T>(obj: T, key: string | symbol, value: unknown): void {
  Object.defineProperty(obj, key, {
    value,
    writable: false,
    configurable: true,
  });
}
