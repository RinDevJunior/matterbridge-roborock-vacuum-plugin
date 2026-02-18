import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeviceDiscovery } from '../../platform/deviceDiscovery.js';
import { asPartial, createMockLogger, createMockLocalStorage, createMockDeviceRegistry, createMockConfigManager } from '../helpers/testUtils.js';
import type { AnsiLogger } from 'matterbridge/logger';
import type { MatterbridgeDynamicPlatform } from 'matterbridge';
import type { PlatformConfigManager } from '../../platform/platformConfigManager.js';
import type { DeviceRegistry } from '../../platform/deviceRegistry.js';
import type { Device, DeviceSpecs } from '../../roborockCommunication/models/index.js';
import { DeviceModel } from '../../roborockCommunication/models/deviceModel.js';
import type { WssSendSnackbarMessage } from '../../types/WssSendSnackbarMessage.js';

const mockAuthenticate = vi.hoisted(() => vi.fn());
const mockListDevices = vi.hoisted(() => vi.fn());
const mockInitializeMessageClient = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('../../initialData/regionUrls.js', () => ({
  getBaseUrl: vi.fn().mockReturnValue('https://api.example.com'),
}));

vi.mock('../../services/roborockService.js', () => ({
  RoborockService: vi.fn().mockImplementation(function () {
    return {
      authenticate: mockAuthenticate,
      listDevices: mockListDevices,
      initializeMessageClient: mockInitializeMessageClient,
      stopService: vi.fn(),
    };
  }),
}));

function makeDevice(duid: string, model: DeviceModel | string, name = 'TestVac'): Device {
  return asPartial<Device>({
    duid,
    name,
    specs: asPartial<DeviceSpecs>({ model: model as DeviceModel }),
  });
}

describe('DeviceDiscovery', () => {
  let log: AnsiLogger;
  let platform: MatterbridgeDynamicPlatform;
  let configManager: PlatformConfigManager;
  let registry: DeviceRegistry;
  let toastMessage: WssSendSnackbarMessage;
  let discovery: DeviceDiscovery;

  beforeEach(() => {
    log = createMockLogger();
    platform = asPartial<MatterbridgeDynamicPlatform>({
      onConfigChanged: vi.fn().mockResolvedValue(undefined),
    });
    configManager = createMockConfigManager();

    Object.defineProperty(configManager, 'cleanModeSettings', { get: () => undefined, configurable: true });
    Object.defineProperty(configManager, 'isAdvancedFeatureEnabled', { get: () => false, configurable: true });
    Object.defineProperty(configManager, 'alwaysExecuteAuthentication', { get: () => false, configurable: true });
    Object.defineProperty(configManager, 'refreshInterval', { get: () => 60, configurable: true });
    Object.defineProperty(configManager, 'region', { get: () => 'US', configurable: true });
    Object.defineProperty(configManager, 'isServerModeEnabled', { get: () => true, configurable: true });
    Object.defineProperty(configManager, 'isDeviceAllowed', { value: vi.fn().mockReturnValue(true), configurable: true, writable: true });

    registry = createMockDeviceRegistry();
    toastMessage = vi.fn() as WssSendSnackbarMessage;

    const persist = createMockLocalStorage({
      getItem: vi.fn().mockResolvedValue('existing-session-id'),
    });

    discovery = new DeviceDiscovery(platform, configManager, registry, () => persist, toastMessage, log);

    mockAuthenticate.mockResolvedValue({ userData: { rriot: {} }, shouldContinue: true, isSuccess: false });
    mockListDevices.mockResolvedValue([]);
    mockInitializeMessageClient.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should log warning when device is not allowed', async () => {
    const allowedDevice = makeDevice('duid-1', 'roborock.vacuum.s7');
    const disallowedDevice = makeDevice('duid-2', 'roborock.vacuum.q7');
    mockListDevices.mockResolvedValue([allowedDevice, disallowedDevice]);

    Object.defineProperty(configManager, 'isDeviceAllowed', {
      value: (device: { duid?: string }) => device.duid === 'duid-1',
      configurable: true,
    });

    await discovery.discoverDevices();

    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('duid-2'));
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('isDeviceAllowed = false'));
  });

  it('should log warning when device model is not supported', async () => {
    const unsupportedDevice = makeDevice('duid-3', 'other.device.model');
    mockListDevices.mockResolvedValue([unsupportedDevice]);

    Object.defineProperty(configManager, 'isDeviceAllowed', {
      value: () => true,
      configurable: true,
    });

    await discovery.discoverDevices();

    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('isDeviceSupported = false'));
  });

  it('should return false when authentication fails', async () => {
    mockAuthenticate.mockResolvedValue({ userData: undefined, shouldContinue: false, isSuccess: false });

    const result = await discovery.discoverDevices();

    expect(result).toBe(false);
  });

  it('should return false when no vacuums found after filtering', async () => {
    const unsupportedDevice = makeDevice('duid-x', 'unsupported.model');
    mockListDevices.mockResolvedValue([unsupportedDevice]);

    Object.defineProperty(configManager, 'isDeviceAllowed', {
      value: () => true,
      configurable: true,
    });

    const result = await discovery.discoverDevices();

    expect(result).toBe(false);
    expect(log.error).toHaveBeenCalledWith('Initializing: No device found');
  });
});
