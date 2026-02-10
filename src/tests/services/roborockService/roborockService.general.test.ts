import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { AnsiLogger } from 'matterbridge/logger';
import type { RoborockPluginPlatformConfig } from '../../../model/RoborockPluginPlatformConfig.js';
import { RoborockService } from '../../../services/roborockService.js';
import { RoomIndexMap } from '../../../core/application/models/index.js';
import { createMockLogger, createMockLocalStorage, asPartial, asType } from '../../helpers/testUtils.js';
import { localStorageMock } from '../../testData/localStorageMock.js';
import { PlatformConfigManager as PlatformConfigManagerStatic } from '../../../platform/platformConfigManager.js';
import { Device } from '../../../roborockCommunication/models/device.js';

const logger: AnsiLogger = createMockLogger();

describe('RoborockService basic behaviors', () => {
  let svc: RoborockService;

  beforeEach(async () => {
    // Create service with default factories (will be mocked as needed)
    const persist = createMockLocalStorage();

    const PlatformConfigManager = PlatformConfigManagerStatic;
    const config = {
      name: 'test',
      type: 'test',
      version: '1.0',
      debug: false,
      unregisterOnShutdown: false,
      authentication: { username: 'test', region: 'US', forceAuthentication: false, authenticationMethod: 'Password', password: '' },
      pluginConfiguration: {
        whiteList: [],
        enableServerMode: false,
        enableMultipleMap: false,
        sanitizeSensitiveLogs: false,
        refreshInterval: 10,
        debug: false,
        unregisterOnShutdown: false,
      },
      advancedFeature: {
        enableAdvancedFeature: false,
        settings: {
          clearStorageOnStartup: false,
          showRoutinesAsRoom: false,
          includeDockStationStatus: false,
          forceRunAtDefault: false,
          useVacationModeToSendVacuumToDock: false,
          enableCleanModeMapping: false,
          cleanModeSettings: {
            vacuuming: { fanMode: 'Balanced', mopRouteMode: 'Standard' },
            mopping: { waterFlowMode: 'Medium', mopRouteMode: 'Standard', distanceOff: 25 },
            vacmop: { fanMode: 'Balanced', waterFlowMode: 'Medium', mopRouteMode: 'Standard', distanceOff: 25 },
          },
        },
      },
    } as RoborockPluginPlatformConfig;
    Object.assign(config, { name: 'test', type: 'test', version: '1.0', debug: false, unregisterOnShutdown: false });
    const configManager = PlatformConfigManager.create(config, asType<AnsiLogger>(logger));

    svc = new RoborockService(
      {
        refreshInterval: 10,
        baseUrl: 'https://api.roborock.com',
        persist: persist,
        configManager: configManager,
      },
      logger,
      configManager,
    );
  });

  it('maps selected area ids to room ids via RoomIndexMap in setSelectedAreas', () => {
    const map = new Map<number, any>();
    map.set(5, { roomId: 42, mapId: 1 });
    const rim = new RoomIndexMap(map);

    // Test public API
    svc.setSupportedAreaIndexMap('d1', rim);
    svc.setSelectedAreas('d1', [5]);

    const sel = svc.getSelectedAreas('d1');
    expect(sel).toEqual([42]);
  });

  it('getCleanModeData throws when message processor not available', async () => {
    await expect(svc.getCleanModeData('nope')).rejects.toThrow('MessageDispatcher not initialized for device nope');
  });

  it('getCustomAPI returns error when not authenticated', async () => {
    // Test without authentication - should throw
    await expect(svc.getCustomAPI('http://x')).rejects.toThrow('IoT API not initialized. Please login first.');
  });
});

describe('RoborockService - Facade Pattern Testing', () => {
  let roborockService: RoborockService;

  beforeEach(async () => {
    const persist = createMockLocalStorage();

    const PlatformConfigManager = PlatformConfigManagerStatic;
    const config = {
      name: 'test',
      type: 'test',
      version: '1.0',
      debug: false,
      unregisterOnShutdown: false,
      authentication: { username: 'test', region: 'US', forceAuthentication: false, authenticationMethod: 'Password', password: '' },
      pluginConfiguration: {
        whiteList: [],
        enableServerMode: false,
        enableMultipleMap: false,
        sanitizeSensitiveLogs: false,
        refreshInterval: 10,
        debug: false,
        unregisterOnShutdown: false,
      },
      advancedFeature: {
        enableAdvancedFeature: false,
        settings: {
          clearStorageOnStartup: false,
          showRoutinesAsRoom: false,
          includeDockStationStatus: false,
          forceRunAtDefault: false,
          useVacationModeToSendVacuumToDock: false,
          enableCleanModeMapping: false,
          cleanModeSettings: {
            vacuuming: { fanMode: 'Balanced', mopRouteMode: 'Standard' },
            mopping: { waterFlowMode: 'Medium', mopRouteMode: 'Standard', distanceOff: 25 },
            vacmop: { fanMode: 'Balanced', waterFlowMode: 'Medium', mopRouteMode: 'Standard', distanceOff: 25 },
          },
        },
      },
    } as RoborockPluginPlatformConfig;
    Object.assign(config, { name: 'test', type: 'test', version: '1.0', debug: false, unregisterOnShutdown: false });
    const configManager = PlatformConfigManager.create(config, asType<AnsiLogger>(logger));

    roborockService = new RoborockService(
      {
        refreshInterval: 10,
        baseUrl: 'https://api.roborock.com',
        persist: persist,
        configManager: configManager,
      },
      logger,
      configManager,
    );
  });

  afterEach(() => {
    roborockService.stopService();
  });

  describe('Facade Contract Testing', () => {
    it('should provide authentication interface without exposing internal implementation', () => {
      // Assert - Test that facade exposes expected authentication methods
      expect(typeof roborockService.authenticate).toBe('function');
    });

    it('should provide device management interface', () => {
      // Assert - Test that facade exposes expected device methods
      expect(typeof roborockService.listDevices).toBe('function');
      expect(typeof roborockService.getHomeDataForUpdating).toBe('function');
      expect(typeof roborockService.initializeMessageClient).toBe('function');
      expect(typeof roborockService.setDeviceNotify).toBe('function');
      expect(typeof roborockService.activateDeviceNotify).toBe('function');
      expect(typeof roborockService.stopService).toBe('function');
    });

    it('should provide area management interface', () => {
      // Assert - Test that facade exposes expected area methods
      expect(typeof roborockService.setSelectedAreas).toBe('function');
      expect(typeof roborockService.getSelectedAreas).toBe('function');
      expect(typeof roborockService.setSupportedAreas).toBe('function');
      expect(typeof roborockService.getSupportedAreas).toBe('function');
      expect(typeof roborockService.getMapInfo).toBe('function');
      expect(typeof roborockService.getRoomMap).toBe('function');
      expect(typeof roborockService.getScenes).toBe('function');
      expect(typeof roborockService.startScene).toBe('function');
    });

    it('should provide message routing interface', () => {
      // Assert - Test that facade exposes expected message methods
      expect(typeof roborockService.getCleanModeData).toBe('function');
      expect(typeof roborockService.changeCleanMode).toBe('function');
      expect(typeof roborockService.startClean).toBe('function');
      expect(typeof roborockService.pauseClean).toBe('function');
      expect(typeof roborockService.stopAndGoHome).toBe('function');
      expect(typeof roborockService.resumeClean).toBe('function');
      expect(typeof roborockService.playSoundToLocate).toBe('function');
      expect(typeof roborockService.customGet).toBe('function');
      expect(typeof roborockService.customSend).toBe('function');
    });

    it('should maintain consistent public interface', () => {
      // Assert - Test that facade maintains stable public API
      const publicMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(roborockService)).filter(
        (name) => typeof asType<Record<string, unknown>>(roborockService)[name] === 'function' && !name.startsWith('_'),
      );

      expect(publicMethods.length).toBeGreaterThan(15); // Should have comprehensive API
      expect(publicMethods).toContain('listDevices');
      expect(publicMethods).toContain('startClean');
      expect(publicMethods).toContain('stopService');
    });
  });

  describe('State Management', () => {
    it('should initialize with proper default state', () => {
      // Assert - Test initial facade state
      expect(roborockService.deviceNotify).toBeUndefined();
      expect(typeof roborockService.getSelectedAreas).toBe('function');
      expect(typeof roborockService.getSupportedAreas).toBe('function');
    });

    it('should manage device notification callbacks properly', () => {
      // Arrange
      const callback = vi.fn();

      // Act - Test state change through facade
      roborockService.setDeviceNotify(callback);

      // Assert - Verify facade manages state correctly
      expect(roborockService.deviceNotify).toBe(callback);
    });

    it('should coordinate service lifecycle', () => {
      // Act - Test lifecycle method exists and is callable
      expect(() => {
        roborockService.stopService();
      }).not.toThrow();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle method calls gracefully when not initialized', async () => {
      // Act & Assert - Test that facade handles edge cases gracefully
      expect(() => roborockService.getSelectedAreas('uninitialized-device')).not.toThrow();
      expect(() => roborockService.getSupportedAreas('uninitialized-device')).not.toThrow();
    });

    it('should provide consistent error handling interface', async () => {
      // These tests verify the facade provides consistent error handling
      // without making assumptions about internal implementation

      // Test methods that should handle invalid inputs gracefully
      expect(() => {
        roborockService.setSelectedAreas('device', []);
      }).not.toThrow();
      expect(() => {
        roborockService.setSupportedAreas('device', []);
      }).not.toThrow();

      // Create a valid RoomIndexMap with mock data
      const mockRoomMap = new Map<number, { roomId: number; mapId: number }>();
      mockRoomMap.set(1, { roomId: 10, mapId: 1 });
      expect(() => {
        roborockService.setSupportedAreaIndexMap('device', new RoomIndexMap(mockRoomMap));
      }).not.toThrow();
    });
  });

  describe('Behavior Coordination', () => {
    it('should coordinate device management workflow', () => {
      // Arrange
      const mockDevice = { duid: 'test-device', name: 'Test Vacuum' };

      // Act & Assert - Test workflow coordination
      expect(() => {
        roborockService.setDeviceNotify(vi.fn());
      }).not.toThrow();
      expect(() => {
        roborockService.activateDeviceNotify(asPartial<Device>(mockDevice));
      }).not.toThrow();
    });

    it('should coordinate area management workflow', () => {
      // Arrange
      const duid = 'test-device';
      const areas = [1, 2, 3];

      // Act & Assert - Test area workflow coordination
      expect(() => {
        roborockService.setSelectedAreas(duid, areas);
      }).not.toThrow();
      expect(() => roborockService.getSelectedAreas(duid)).not.toThrow();
    });
  });

  describe('Integration Points', () => {
    it('should properly initialize with required dependencies', () => {
      // Assert - Test that facade properly handles its dependencies
      expect(roborockService).toBeDefined();
      expect(roborockService.deviceNotify).toBeUndefined(); // Initial state
    });

    it('should maintain separation of concerns', () => {
      // Only check for methods that are actually present on the facade
      const authMethods: string[] = [];
      const deviceMethods = ['listDevices', 'initializeMessageClient', 'activateDeviceNotify'];
      const areaMethods = ['setSelectedAreas', 'getSupportedAreas', 'getMapInfo'];
      const messageMethods = ['startClean', 'pauseClean', 'getCleanModeData'];

      // Assert - All domain methods are available through facade
      authMethods.forEach((method) => {
        expect(typeof asType<Record<string, unknown>>(roborockService)[method]).toBe('function');
      });

      deviceMethods.forEach((method) => {
        expect(typeof asType<Record<string, unknown>>(roborockService)[method]).toBe('function');
      });

      areaMethods.forEach((method) => {
        expect(typeof asType<Record<string, unknown>>(roborockService)[method]).toBe('function');
      });

      messageMethods.forEach((method) => {
        expect(typeof asType<Record<string, unknown>>(roborockService)[method]).toBe('function');
      });
    });
  });
});
