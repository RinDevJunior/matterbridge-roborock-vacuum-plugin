import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeviceConfigurator } from '../../platform/deviceConfigurator.js';
import type { MatterbridgeDynamicPlatform, MatterbridgeEndpoint } from 'matterbridge';
import type { AnsiLogger } from 'matterbridge/logger';
import {
  asPartial,
  createMockLogger,
  createMockConfigManager,
  createMockDeviceRegistry,
  createMockRoborockService,
} from '../helpers/testUtils.js';
import type { PlatformConfigManager } from '../../platform/platformConfigManager.js';
import type { DeviceRegistry } from '../../platform/deviceRegistry.js';
import type { PlatformRunner } from '../../platformRunner.js';
import type { RoborockService } from '../../services/roborockService.js';
import { DeviceInformation, DeviceModel, DeviceSpecs, type Device } from '../../roborockCommunication/models/index.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';
import type { WssSendSnackbarMessage } from '../../types/WssSendSnackbarMessage.js';

vi.mock('../../core/application/models/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/application/models/index.js')>();
  return {
    ...actual,
    RoomMap: {
      ...actual.RoomMap,
      fromMapInfo: vi.fn().mockResolvedValue({
        activeMapId: 0,
        mapInfo: { maps: [], allRooms: [], hasRooms: false, getActiveMapId: vi.fn().mockReturnValue(0) },
        roomMap: { rooms: [], hasRooms: false },
      }),
    },
  };
});

vi.mock('../../share/behaviorFactory.js', () => ({
  configureBehavior: vi.fn().mockReturnValue({
    onBatteryUpdate: vi.fn(),
    onStatusChanged: vi.fn(),
    onCleanModeUpdate: vi.fn(),
    onServiceAreaUpdate: vi.fn(),
    onError: vi.fn(),
    onAdditionalProps: vi.fn(),
  }),
}));

vi.mock('../../types/roborockVacuumCleaner.js', () => ({
  RoborockVacuumCleaner: vi.fn(function (this: Record<string, unknown>, device: Device) {
    this.device = device;
    this.deviceName = `Roborock-${device.duid}`;
    this.configureHandler = vi.fn();
    this.getClusterServerOptions = vi.fn().mockReturnValue({
      softwareVersion: 1,
      softwareVersionString: '1.0.0',
      hardwareVersion: 1,
      hardwareVersionString: '1.0.0',
      deviceTypeList: [],
    });
    this.createDefaultIdentifyClusterServer = vi.fn();
    this.createDefaultBridgedDeviceBasicInformationClusterServer = vi.fn();
    this.mode = undefined;
    this.deviceTypes = new Map();
    this.softwareVersion = 1;
    this.softwareVersionString = '1.0.0';
    this.hardwareVersion = 1;
    this.hardwareVersionString = '1.0.0';
    this.vendorName = 'Matterbridge';
    this.productName = 'Roborock';
    this.vendorId = 65521;
    this.productId = 32768;
  }),
}));

vi.mock('../../core/domain/entities/Home.js', () => ({
  HomeEntity: vi.fn(function (this: Record<string, unknown>) {
    this.rawRooms = [];
  }),
}));

describe('DeviceConfigurator', () => {
  let log: AnsiLogger;
  let configManager: PlatformConfigManager;
  let registry: DeviceRegistry;
  let platformRunner: PlatformRunner;
  let platform: MatterbridgeDynamicPlatform;
  let roborockService: RoborockService;
  let configurator: DeviceConfigurator;
  let snackbarMessage: WssSendSnackbarMessage;

  const makeMockDevice = (duid: string): Device =>
    asPartial<Device>({
      duid,
      name: `Vacuum-${duid}`,
      rrHomeId: 1,
      fv: '1.0.0',
      specs: asPartial<DeviceSpecs>({ model: DeviceModel.S7, firmwareVersion: '1.0.0' }),
      store: asPartial<DeviceInformation>({
        homeData: { id: 1, name: 'Home', rooms: [], products: [], devices: [], receivedDevices: [] },
      }),
    });

  beforeEach(() => {
    log = createMockLogger();
    snackbarMessage = vi.fn() as unknown as WssSendSnackbarMessage;
    configManager = createMockConfigManager({
      isCustomCleanModeMappingEnabled: false,
      forceRunAtDefault: false,
      overrideMatterConfiguration: false,
    });
    Object.defineProperty(configManager, 'cleanModeSettings', { get: () => ({}), configurable: true });

    platformRunner = asPartial<PlatformRunner>({
      updateRobotWithPayload: vi.fn(),
      requestHomeData: vi.fn().mockResolvedValue(undefined),
      activateHandlerFunctions: vi.fn(),
    });

    platform = asPartial<MatterbridgeDynamicPlatform>({
      version: '1.0.0',
      matterbridge: asPartial<MatterbridgeDynamicPlatform['matterbridge']>({
        matterbridgeVersion: '3.5.5',
      }),
      log: createMockLogger(),
      validateDevice: vi.fn().mockReturnValue(true),
      setSelectDevice: vi.fn(),
      registerDevice: vi.fn().mockResolvedValue(undefined),
    });

    roborockService = createMockRoborockService({
      setDeviceNotify: vi.fn(),
      activateDeviceNotify: vi.fn(),
      initializeMessageClientForLocal: vi.fn().mockResolvedValue(true),
    });
  });

  describe('onConfigureDevice', () => {
    it('should return early and log error when registry has no devices', async () => {
      registry = createMockDeviceRegistry({
        hasDevices: vi.fn().mockReturnValue(false),
        getAllDevices: vi.fn().mockReturnValue([]),
      });
      configurator = new DeviceConfigurator(
        platform,
        configManager,
        registry,
        () => platformRunner,
        snackbarMessage,
        log,
      );

      await configurator.onConfigureDevice(roborockService);

      expect(log.error).toHaveBeenCalledWith('Initializing: No supported devices found');
      expect(roborockService.initializeMessageClientForLocal).not.toHaveBeenCalled();
    });

    it('should configure devices and activate handlers when devices exist', async () => {
      const device = makeMockDevice('duid-1');
      registry = createMockDeviceRegistry({
        hasDevices: vi.fn().mockReturnValue(true),
        getAllDevices: vi.fn().mockReturnValue([device]),
        robotsMap: new Map(),
      });

      configurator = new DeviceConfigurator(
        platform,
        configManager,
        registry,
        () => platformRunner,
        snackbarMessage,
        log,
      );

      await configurator.onConfigureDevice(roborockService);

      expect(roborockService.initializeMessageClientForLocal).toHaveBeenCalledWith(device);
      expect(platformRunner.requestHomeData).toHaveBeenCalled();
      expect(platformRunner.activateHandlerFunctions).toHaveBeenCalled();
    });

    it('should set rrHomeId when device is configured successfully', async () => {
      const device = makeMockDevice('duid-1');
      registry = createMockDeviceRegistry({
        hasDevices: vi.fn().mockReturnValue(true),
        getAllDevices: vi.fn().mockReturnValue([device]),
        robotsMap: new Map(),
      });

      configurator = new DeviceConfigurator(
        platform,
        configManager,
        registry,
        () => platformRunner,
        snackbarMessage,
        log,
      );

      await configurator.onConfigureDevice(roborockService);

      expect(configurator.rrHomeId).toBe(device.rrHomeId);
    });

    it('should activate notify for successfully configured robots', async () => {
      const device = makeMockDevice('duid-1');
      const robot = asPartial<RoborockVacuumCleaner>({ device });
      const robotsMap = new Map([['duid-1', robot]]);
      registry = createMockDeviceRegistry({
        hasDevices: vi.fn().mockReturnValue(true),
        getAllDevices: vi.fn().mockReturnValue([device]),
        robotsMap,
      });

      configurator = new DeviceConfigurator(
        platform,
        configManager,
        registry,
        () => platformRunner,
        snackbarMessage,
        log,
      );

      await configurator.onConfigureDevice(roborockService);

      expect(roborockService.activateDeviceNotify).toHaveBeenCalledWith(device);
    });

    it('should handle requestHomeData failure gracefully', async () => {
      const device = makeMockDevice('duid-1');
      registry = createMockDeviceRegistry({
        hasDevices: vi.fn().mockReturnValue(true),
        getAllDevices: vi.fn().mockReturnValue([device]),
        robotsMap: new Map(),
      });

      platformRunner = asPartial<PlatformRunner>({
        updateRobotWithPayload: vi.fn(),
        requestHomeData: vi.fn().mockRejectedValue(new Error('Network error')),
        activateHandlerFunctions: vi.fn(),
      });

      configurator = new DeviceConfigurator(
        platform,
        configManager,
        registry,
        () => platformRunner,
        snackbarMessage,
        log,
      );

      await configurator.onConfigureDevice(roborockService);

      expect(log.error).toHaveBeenCalledWith(expect.stringContaining('requestHomeData (initial) failed'));
      expect(platformRunner.activateHandlerFunctions).toHaveBeenCalled();
    });

    it('should log warn and continue when device fails to connect to local network', async () => {
      const device = makeMockDevice('duid-1');
      registry = createMockDeviceRegistry({
        hasDevices: vi.fn().mockReturnValue(true),
        getAllDevices: vi.fn().mockReturnValue([device]),
        robotsMap: new Map(),
      });

      roborockService = createMockRoborockService({
        setDeviceNotify: vi.fn(),
        activateDeviceNotify: vi.fn(),
        initializeMessageClientForLocal: vi.fn().mockResolvedValue(false),
      });

      configurator = new DeviceConfigurator(
        platform,
        configManager,
        registry,
        () => platformRunner,
        snackbarMessage,
        log,
      );

      await configurator.onConfigureDevice(roborockService);

      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('could not connect to local network'));
      expect(configurator.rrHomeId).toBe(device.rrHomeId);
    });

    it('should activate notify for device configured in MQTT-only mode', async () => {
      const device = makeMockDevice('duid-1');
      const robot = asPartial<RoborockVacuumCleaner>({ device });
      const robotsMap = new Map([['duid-1', robot]]);

      registry = createMockDeviceRegistry({
        hasDevices: vi.fn().mockReturnValue(true),
        getAllDevices: vi.fn().mockReturnValue([device]),
        robotsMap,
      });

      roborockService = createMockRoborockService({
        setDeviceNotify: vi.fn(),
        activateDeviceNotify: vi.fn(),
        initializeMessageClientForLocal: vi.fn().mockResolvedValue(false),
      });

      configurator = new DeviceConfigurator(
        platform,
        configManager,
        registry,
        () => platformRunner,
        snackbarMessage,
        log,
      );

      await configurator.onConfigureDevice(roborockService);

      expect(roborockService.activateDeviceNotify).toHaveBeenCalledWith(device);
    });
  });
});
