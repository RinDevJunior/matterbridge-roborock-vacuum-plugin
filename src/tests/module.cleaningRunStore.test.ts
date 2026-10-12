import { PlatformMatterbridge } from 'matterbridge';
import type { LocalStorage } from 'node-persist';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDefaultAdvancedFeature, RoborockPluginPlatformConfig } from '../model/RoborockPluginPlatformConfig.js';
import { RoborockMatterbridgePlatform } from '../module.js';
import { CleaningRunStateStore } from '../services/cleaningRunStateStore.js';
import { asPartial, createMockLocalStorage, createMockLogger } from './helpers/testUtils.js';

function createConfig(clearStorageOnStartup: boolean, persistFlag: boolean): RoborockPluginPlatformConfig {
	return asPartial<RoborockPluginPlatformConfig>({
		name: 'TestPlatform',
		username: 'test@example.com',
		whiteList: [],
		blackList: [],
		persistDirectory: '/tmp',
		authentication: asPartial<RoborockPluginPlatformConfig['authentication']>({
			username: 'test',
			region: 'US',
			forceAuthentication: false,
			password: 'test',
			authenticationMethod: 'Password',
		}),
		pluginConfiguration: asPartial<RoborockPluginPlatformConfig['pluginConfiguration']>({
			enableServerMode: false,
			enableMultipleMap: false,
		}),
		advancedFeature: {
			enableAdvancedFeature: true,
			settings: {
				...createDefaultAdvancedFeature().settings,
				clearStorageOnStartup,
				enablePersistCleaningState: persistFlag,
			},
		},
	});
}

describe('module onStart cleaning-run store wiring', () => {
	let persist: LocalStorage;
	let keys: ReturnType<typeof vi.fn>;
	let removeItem: ReturnType<typeof vi.fn>;
	let matterbridge: PlatformMatterbridge;

	function createPlatform(config: RoborockPluginPlatformConfig): RoborockMatterbridgePlatform {
		const platform = new RoborockMatterbridgePlatform(matterbridge, createMockLogger(), config);
		Object.defineProperty(platform, 'clearSelect', { value: vi.fn().mockResolvedValue(undefined) });
		Object.defineProperty(platform, 'ready', { value: Promise.resolve() });
		// Stop onStart right after the store wiring: discovery fails, so no device setup runs.
		vi.spyOn(platform.discovery, 'discoverDevices').mockResolvedValue(false);
		platform.persist = persist;
		return platform;
	}

	beforeEach(() => {
		vi.clearAllMocks();
		keys = vi.fn().mockResolvedValue([]);
		removeItem = vi.fn().mockResolvedValue({});
		persist = createMockLocalStorage({
			init: vi.fn().mockResolvedValue(undefined),
			keys,
			removeItem,
		});
		matterbridge = asPartial<PlatformMatterbridge>({
			matterbridgeVersion: '3.5.5',
			matterbridgePluginDirectory: '/tmp',
			matterbridgeDirectory: '/tmp',
		});
	});

	it('should create a CleaningRunStateStore after onStart when the flag is ON', async () => {
		const platform = createPlatform(createConfig(false, true));

		await platform.onStart();

		expect(platform.cleaningRunStateStore).toBeInstanceOf(CleaningRunStateStore);
		expect(removeItem).not.toHaveBeenCalled();
	});

	it('should leave cleaningRunStateStore undefined and remove only cleaningRun keys when the flag is OFF', async () => {
		keys.mockResolvedValue(['cleaningRun:duid-a', 'cleaningRun:duid-b', 'otherKey']);
		const platform = createPlatform(createConfig(false, false));

		await platform.onStart();

		expect(platform.cleaningRunStateStore).toBeUndefined();
		expect(removeItem).toHaveBeenCalledTimes(2);
		expect(removeItem).toHaveBeenCalledWith('cleaningRun:duid-a');
		expect(removeItem).toHaveBeenCalledWith('cleaningRun:duid-b');
		expect(removeItem).not.toHaveBeenCalledWith('otherKey');
	});

	it('should swallow a keys() failure during flag-OFF cleanup and still finish onStart', async () => {
		keys.mockRejectedValue(new Error('keys failed'));
		const platform = createPlatform(createConfig(false, false));

		await expect(platform.onStart()).resolves.toBeUndefined();
		expect(platform.cleaningRunStateStore).toBeUndefined();
	});

	it('should leave cleaningRunStateStore undefined when clearStorageOnStartup returns early', async () => {
		const platform = createPlatform(createConfig(true, true));

		await platform.onStart();

		expect(platform.cleaningRunStateStore).toBeUndefined();
		expect(keys).not.toHaveBeenCalled();
	});
});
