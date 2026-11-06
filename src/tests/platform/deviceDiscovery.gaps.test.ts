import crypto from 'node:crypto';

import * as axiosModule from 'axios';
import type { MatterbridgeDynamicPlatform } from 'matterbridge';
import type { AnsiLogger } from 'matterbridge/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DeviceDiscovery } from '../../platform/deviceDiscovery.js';
import type { DeviceRegistry } from '../../platform/deviceRegistry.js';
import type { PlatformConfigManager } from '../../platform/platformConfigManager.js';
import { RoborockAuthenticateApi } from '../../roborockCommunication/api/authClient.js';
import { RoborockIoTApi } from '../../roborockCommunication/api/iotClient.js';
import { DeviceModel } from '../../roborockCommunication/models/deviceModel.js';
import type { Device, DeviceSpecs, UserData } from '../../roborockCommunication/models/index.js';
import { RoborockService } from '../../services/roborockService.js';
import type { WssSendSnackbarMessage } from '../../types/WssSendSnackbarMessage.js';
import {
	asPartial,
	createMockConfigManager,
	createMockDeviceRegistry,
	createMockLocalStorage,
	createMockLogger,
} from '../helpers/testUtils.js';

const mockAuthenticate = vi.hoisted(() => vi.fn());
const mockListDevices = vi.hoisted(() => vi.fn());
const mockInitializeMessageClient = vi.hoisted(() => vi.fn());
const axiosState = vi.hoisted(() => ({ useDefault: true }));
const fakeAxiosDefault = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('axios', () => ({
	get default() {
		return axiosState.useDefault ? fakeAxiosDefault : undefined;
	},
}));

vi.mock('../../roborockCommunication/api/authClient.js', () => ({
	RoborockAuthenticateApi: vi.fn(),
}));

vi.mock('../../roborockCommunication/api/iotClient.js', () => ({
	RoborockIoTApi: vi.fn(),
}));

vi.mock('../../services/roborockService.js', () => ({
	RoborockService: vi.fn().mockImplementation(function () {
		return {
			authenticate: mockAuthenticate,
			listDevices: mockListDevices,
			initializeMessageClient: mockInitializeMessageClient,
		};
	}),
}));

const SUPPORTED_MODEL = 'roborock.vacuum.s7';

function createDevice(duid: string, model: string = SUPPORTED_MODEL): Device {
	return asPartial<Device>({
		duid,
		name: `Vac ${duid}`,
		serialNumber: '123',
		specs: asPartial<DeviceSpecs>({ model: model as DeviceModel }),
	});
}

function defineValue(target: object, key: string, value: unknown): void {
	Object.defineProperty(target, key, { value, configurable: true, writable: true });
}

function defineGetter(target: object, key: string, value: unknown): void {
	Object.defineProperty(target, key, { get: () => value, configurable: true });
}

describe('DeviceDiscovery (gaps)', () => {
	let log: AnsiLogger;
	let platform: MatterbridgeDynamicPlatform;
	let configManager: PlatformConfigManager;
	let registry: DeviceRegistry;
	let persist: ReturnType<typeof createMockLocalStorage>;
	let discovery: DeviceDiscovery;

	beforeEach(() => {
		vi.clearAllMocks();
		axiosState.useDefault = true;

		log = createMockLogger();
		platform = asPartial<MatterbridgeDynamicPlatform>({
			onConfigChanged: vi.fn().mockResolvedValue(undefined),
		});
		configManager = createMockConfigManager();
		defineGetter(configManager, 'cleanModeSettings', undefined);
		defineGetter(configManager, 'isCustomCleanModeMappingEnabled', false);
		defineGetter(configManager, 'alwaysExecuteAuthentication', false);
		defineGetter(configManager, 'refreshInterval', 60);
		defineGetter(configManager, 'region', 'US');
		defineGetter(configManager, 'isServerModeEnabled', true);
		defineGetter(configManager, 'whiteList', []);
		defineValue(configManager, 'isDeviceAllowed', vi.fn().mockReturnValue(true));

		registry = createMockDeviceRegistry({ registerDevice: vi.fn() });
		persist = createMockLocalStorage({
			getItem: vi.fn().mockResolvedValue('existing-session-id'),
			setItem: vi.fn().mockResolvedValue(undefined),
		});

		discovery = new DeviceDiscovery(
			platform,
			configManager,
			registry,
			() => persist,
			vi.fn() as WssSendSnackbarMessage,
			log,
		);

		mockAuthenticate.mockResolvedValue({ userData: asPartial<UserData>({}), shouldContinue: true, isSuccess: false });
		mockListDevices.mockResolvedValue([]);
		mockInitializeMessageClient.mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('custom clean mode mapping notice', () => {
		it('should log mapping as Enabled when custom clean mode mapping is enabled and settings exist', async () => {
			// Arrange
			defineGetter(configManager, 'cleanModeSettings', { mode: 'x' });
			defineGetter(configManager, 'isCustomCleanModeMappingEnabled', true);
			// Act
			await discovery.discoverDevices();
			// Assert
			expect(log.notice).toHaveBeenCalledWith(expect.stringContaining('Custom Clean Mode Mapping Enabled: Enabled'));
		});

		it('should log mapping as Disabled when custom clean mode mapping is disabled and settings exist', async () => {
			// Arrange
			defineGetter(configManager, 'cleanModeSettings', { mode: 'x' });
			defineGetter(configManager, 'isCustomCleanModeMappingEnabled', false);
			// Act
			await discovery.discoverDevices();
			// Assert
			expect(log.notice).toHaveBeenCalledWith(expect.stringContaining('Custom Clean Mode Mapping Enabled: Disabled'));
		});
	});

	describe('sessionId persistence', () => {
		it('should generate and persist a new sessionId when none is cached', async () => {
			// Arrange
			const uuid = '00000000-0000-4000-8000-000000000000';
			vi.mocked(persist.getItem).mockResolvedValue(undefined);
			const randomUUIDSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue(uuid);
			try {
				// Act
				await discovery.discoverDevices();
				// Assert
				expect(randomUUIDSpy).toHaveBeenCalled();
				expect(persist.setItem).toHaveBeenCalledWith('sessionId', uuid);
				expect(log.debug).toHaveBeenCalledWith('Generated new sessionId:', uuid);
			} finally {
				randomUUIDSpy.mockRestore();
			}
		});

		it('should reuse the cached sessionId when one is stored', async () => {
			// Arrange
			vi.mocked(persist.getItem).mockResolvedValue('existing-session-id');
			// Act
			await discovery.discoverDevices();
			// Assert
			expect(persist.setItem).not.toHaveBeenCalled();
			expect(log.debug).toHaveBeenCalledWith('Using cached sessionId:', 'existing-session-id');
		});
	});

	describe('API factories', () => {
		it('should fall back to the axios module when axios.default is undefined', async () => {
			// Arrange
			axiosState.useDefault = false;
			// Act
			await discovery.discoverDevices();
			const config = vi.mocked(RoborockService).mock.calls[0][0];
			config.authenticateApiFactory?.(log, 'https://auth.example.com');
			// Assert
			expect(vi.mocked(RoborockAuthenticateApi).mock.calls[0][1]).toBe(axiosModule);
		});

		it('should create the authenticate API with cached sessionId and the given url when factory is invoked', async () => {
			// Arrange
			await discovery.discoverDevices();
			const config = vi.mocked(RoborockService).mock.calls[0][0];
			// Act
			config.authenticateApiFactory?.(log, 'https://auth.example.com');
			// Assert
			expect(RoborockAuthenticateApi).toHaveBeenCalledWith(
				log,
				fakeAxiosDefault,
				'existing-session-id',
				'https://auth.example.com',
			);
		});

		it('should create the IoT API with user data when factory is invoked', async () => {
			// Arrange
			await discovery.discoverDevices();
			const config = vi.mocked(RoborockService).mock.calls[0][0];
			const userData = asPartial<UserData>({ rruid: 'rr-uid' });
			// Act
			config.iotApiFactory?.(log, userData);
			// Assert
			expect(RoborockIoTApi).toHaveBeenCalledWith(userData, log, fakeAxiosDefault);
		});
	});

	describe('forced authentication reset', () => {
		it('should disable forceAuthentication and call onConfigChanged when authentication succeeded and alwaysExecuteAuthentication is enabled', async () => {
			// Arrange
			const rawConfig = { authentication: { forceAuthentication: true } };
			defineGetter(configManager, 'rawConfig', rawConfig);
			defineGetter(configManager, 'alwaysExecuteAuthentication', true);
			mockAuthenticate.mockResolvedValue({ userData: asPartial<UserData>({}), shouldContinue: true, isSuccess: true });
			// Act
			await discovery.discoverDevices();
			// Assert
			expect(rawConfig.authentication.forceAuthentication).toBe(false);
			expect(platform.onConfigChanged).toHaveBeenCalledTimes(1);
			expect(platform.onConfigChanged).toHaveBeenCalledWith(rawConfig);
		});

		it('should not call onConfigChanged when authentication did not succeed even if alwaysExecuteAuthentication is enabled', async () => {
			// Arrange
			defineGetter(configManager, 'rawConfig', { authentication: { forceAuthentication: true } });
			defineGetter(configManager, 'alwaysExecuteAuthentication', true);
			mockAuthenticate.mockResolvedValue({ userData: asPartial<UserData>({}), shouldContinue: true, isSuccess: false });
			// Act
			await discovery.discoverDevices();
			// Assert
			expect(platform.onConfigChanged).not.toHaveBeenCalled();
		});
	});

	describe('server mode device selection', () => {
		it('should initialize and register only the first vacuum when server mode is disabled', async () => {
			// Arrange
			const first = createDevice('duid-1');
			const second = createDevice('duid-2');
			mockListDevices.mockResolvedValue([first, second]);
			defineGetter(configManager, 'isServerModeEnabled', false);
			// Act
			const result = await discovery.discoverDevices();
			// Assert
			expect(result).toBe(true);
			expect(mockInitializeMessageClient).toHaveBeenCalledTimes(1);
			expect(mockInitializeMessageClient).toHaveBeenCalledWith(first, expect.anything());
			expect(registry.registerDevice).toHaveBeenCalledTimes(1);
			expect(registry.registerDevice).toHaveBeenCalledWith(first);
		});

		it('should initialize and register every allowed vacuum when server mode is enabled', async () => {
			// Arrange
			const first = createDevice('duid-1');
			const second = createDevice('duid-2');
			mockListDevices.mockResolvedValue([first, second]);
			defineGetter(configManager, 'isServerModeEnabled', true);
			// Act
			await discovery.discoverDevices();
			// Assert
			expect(mockInitializeMessageClient).toHaveBeenCalledTimes(2);
			expect(registry.registerDevice).toHaveBeenCalledTimes(2);
			expect(registry.registerDevice).toHaveBeenLastCalledWith(second);
		});
	});

	it('should return false and log when the discovered vacuum list is empty', async () => {
		// Arrange
		mockListDevices.mockResolvedValue([]);
		// Act
		const result = await discovery.discoverDevices();
		// Assert
		expect(result).toBe(false);
		expect(log.error).toHaveBeenCalledWith('Initializing: No device found');
		expect(mockInitializeMessageClient).not.toHaveBeenCalled();
	});
});
