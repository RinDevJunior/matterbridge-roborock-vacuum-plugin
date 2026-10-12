import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RoborockPluginPlatformConfig } from '../../model/RoborockPluginPlatformConfig.js';
import { PlatformConfigManager } from '../../platform/platformConfigManager.js';
import { asPartial, asType, createMockLogger } from '../helpers/testUtils.js';

function createConfig(whiteList: string[]): RoborockPluginPlatformConfig {
	return asPartial<RoborockPluginPlatformConfig>({
		authentication: {
			username: 'testuser',
			region: 'US',
			forceAuthentication: false,
			authenticationMethod: 'Password',
			password: 'pass',
		},
		pluginConfiguration: asPartial<RoborockPluginPlatformConfig['pluginConfiguration']>({
			whiteList,
			enableServerMode: false,
			enableMultipleMap: false,
			sanitizeSensitiveLogs: true,
			refreshInterval: 60,
			debug: false,
			unregisterOnShutdown: false,
		}),
	});
}

describe('PlatformConfigManager whiteList gap coverage', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
	});

	describe('whiteList defensive fallback', () => {
		// The constructor normalizes whiteList with `??= []`, so the getter fallback is only reachable
		// when the stored config value is cleared after the manager is built.

		it('should return false for hasWhiteListConfig when whiteList is cleared after construction', () => {
			// Arrange
			const config = createConfig(['SN-1']);
			const manager = PlatformConfigManager.create(config, mockLogger);
			config.pluginConfiguration.whiteList = asType<string[]>(undefined);
			// Act
			const result = manager.hasWhiteListConfig;
			// Assert
			expect(result).toBe(false);
		});

		it('should return an empty array for whiteList when whiteList is cleared after construction', () => {
			// Arrange
			const config = createConfig(['SN-1']);
			const manager = PlatformConfigManager.create(config, mockLogger);
			config.pluginConfiguration.whiteList = asType<string[]>(undefined);
			// Act
			const result = manager.whiteList;
			// Assert
			expect(result).toEqual([]);
		});
	});

	describe('whiteList populated', () => {
		it('should return true for hasWhiteListConfig when whiteList contains a serial number', () => {
			// Arrange
			const manager = PlatformConfigManager.create(createConfig(['SN-1']), mockLogger);
			// Act
			const result = manager.hasWhiteListConfig;
			// Assert
			expect(result).toBe(true);
		});

		it('should return the configured serial numbers when whiteList is set', () => {
			// Arrange
			const manager = PlatformConfigManager.create(createConfig(['SN-1', 'SN-2']), mockLogger);
			// Act
			const result = manager.whiteList;
			// Assert
			expect(result).toEqual(['SN-1', 'SN-2']);
		});
	});
});
