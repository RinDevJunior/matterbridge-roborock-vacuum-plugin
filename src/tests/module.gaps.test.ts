import type { PlatformMatterbridge } from 'matterbridge';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RoborockPluginPlatformConfig } from '../model/RoborockPluginPlatformConfig.js';
import { RoborockMatterbridgePlatform } from '../module.js';
import { DeviceDiscovery } from '../platform/deviceDiscovery.js';
import { asPartial, createMockLocalStorage, createMockLogger, createMockMatterbridge } from './helpers/testUtils.js';

vi.mock('../platform/deviceDiscovery.js');
vi.mock('../services/roborockService.js');
vi.mock('../types/roborockVacuumCleaner.js');
vi.mock('node-persist');

function createMockConfig(): RoborockPluginPlatformConfig {
	return asPartial<RoborockPluginPlatformConfig>({
		name: 'Test Platform',
		type: 'DynamicPlatform',
		authentication: {
			username: 'test@example.com',
			region: 'US',
			forceAuthentication: false,
			authenticationMethod: 'VerificationCode',
		},
		pluginConfiguration: {
			whiteList: [],
			enableServerMode: false,
			enableMultipleMap: false,
			sanitizeSensitiveLogs: false,
			refreshInterval: 30,
			debug: false,
			unregisterOnShutdown: false,
		},
		advancedFeature: {
			enableAdvancedFeature: false,
			settings: {
				clearStorageOnStartup: false,
				enableLiveMapUpdates: false,
				showRoutinesAsRoom: false,
				includeDockStationStatus: false,
				includeVacuumErrorStatus: false,
				forceRunAtDefault: false,
				useVacationModeToSendVacuumToDock: false,
				enableCleanModeMapping: false,
				cleanModeSettings: {
					vacuuming: { fanMode: 'Balanced', mopRouteMode: 'Standard' },
					mopping: { waterFlowMode: 'Medium', mopRouteMode: 'Standard', distanceOff: 25 },
					vacmop: { fanMode: 'Balanced', waterFlowMode: 'Medium', mopRouteMode: 'Standard', distanceOff: 25 },
				},
				overrideMatterConfiguration: false,
				matterOverrideSettings: {
					matterVendorName: 'xxx',
					matterVendorId: 123,
					matterProductName: 'yy',
					matterProductId: 456,
				},
				enableEmailNotification: false,
				emailNotificationSettings: {},
			},
		},
	});
}

describe('RoborockMatterbridgePlatform gap coverage', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;
	let mockMatterbridge: PlatformMatterbridge;
	let mockConfig: RoborockPluginPlatformConfig;
	let platform: RoborockMatterbridgePlatform;

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
		mockMatterbridge = createMockMatterbridge({});
		mockConfig = createMockConfig();
		platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, mockConfig);
		platform.verifyMatterbridgeVersion = vi.fn().mockReturnValue(true);
	});

	describe('rrHomeId accessors', () => {
		it('should return undefined when rrHomeId has never been set', () => {
			// Arrange
			// (fresh platform from beforeEach)
			// Act
			const result = platform.rrHomeId;
			// Assert
			expect(result).toBeUndefined();
		});

		it('should return the configurator rrHomeId when the getter is read', () => {
			// Arrange
			platform.configurator.rrHomeId = 77;
			// Act
			const result = platform.rrHomeId;
			// Assert
			expect(result).toBe(77);
		});

		it('should write through to the configurator when the rrHomeId setter is used', () => {
			// Arrange
			// (fresh platform from beforeEach)
			// Act
			platform.rrHomeId = 1234;
			// Assert
			expect(platform.configurator.rrHomeId).toBe(1234);
		});
	});

	describe('DeviceDiscovery persist accessor', () => {
		it('should pass an accessor to DeviceDiscovery that returns the current persist store', () => {
			// Arrange
			const sentinelPersist = createMockLocalStorage();
			platform.persist = sentinelPersist;
			const discoveryArgs = vi.mocked(DeviceDiscovery).mock.calls[0];
			// Act
			const getPersist = discoveryArgs[3];
			// Assert
			expect(getPersist()).toBe(sentinelPersist);
		});
	});
});
