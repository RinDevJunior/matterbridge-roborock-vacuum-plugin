import type { AnsiLogger } from 'matterbridge/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DeviceError } from '../../errors/index.js';
import type { RoborockAuthenticateApi } from '../../roborockCommunication/api/authClient.js';
import type { RoborockIoTApi } from '../../roborockCommunication/api/iotClient.js';
import type { Device, Home, UserData } from '../../roborockCommunication/models/index.js';
import { DeviceManagementService } from '../../services/deviceManagementService.js';
import { asPartial, asType, createMockLogger } from '../helpers/testUtils.js';

function createMockLoginApi(): RoborockAuthenticateApi {
	return asPartial<RoborockAuthenticateApi>({
		getBasicHomeInfo: vi.fn().mockResolvedValue({ rrHomeId: 42 }),
	});
}

function createMockIotApi(): RoborockIoTApi {
	return asPartial<RoborockIoTApi>({
		getHomeWithProducts: vi.fn(),
		getScenes: vi.fn().mockResolvedValue([]),
		getHomev2: vi.fn(),
		getHomev3: vi.fn().mockResolvedValue(undefined),
		getHome: vi.fn().mockResolvedValue(undefined),
	});
}

function createDevice(overrides: Partial<Device> = {}): Device {
	return asPartial<Device>({
		duid: 'duid-1',
		productId: 'prod-1',
		sn: 'SN-1',
		fv: '1.0.0',
		pv: '1.0',
		localKey: 'local-key',
		deviceStatus: {},
		...overrides,
	});
}

function createHome(devices: Device[]): Home {
	return asPartial<Home>({ products: [], devices, receivedDevices: [], rooms: [] });
}

describe('DeviceManagementService (gaps)', () => {
	let logger: AnsiLogger;
	let loginApi: RoborockAuthenticateApi;
	let iotApi: RoborockIoTApi;
	let service: DeviceManagementService;

	beforeEach(() => {
		vi.clearAllMocks();
		logger = createMockLogger();
		loginApi = createMockLoginApi();
		iotApi = createMockIotApi();
		service = new DeviceManagementService(logger, loginApi, asPartial<UserData>({ username: 'user@example.com' }));
		service.setIotApi(iotApi);
	});

	describe('listDevices', () => {
		it('should return an empty scenes list when getScenes resolves undefined', async () => {
			// Arrange
			vi.mocked(iotApi.getHomeWithProducts).mockResolvedValue(createHome([createDevice()]));
			vi.mocked(iotApi.getScenes).mockResolvedValue(asType<never>(undefined));
			// Act
			const result = await service.listDevices();
			// Assert
			expect(result).toHaveLength(1);
			expect(result[0].scenes).toEqual([]);
		});

		it.each([
			{ label: 'deviceStatus is undefined', deviceStatus: undefined },
			{ label: 'deviceStatus has no battery key', deviceStatus: {} },
		])('should default batteryLevel to 100 when $label', async ({ deviceStatus }) => {
			// Arrange
			vi.mocked(iotApi.getHomeWithProducts).mockResolvedValue(createHome([createDevice({ deviceStatus })]));
			// Act
			const result = await service.listDevices();
			// Assert
			expect(result[0].specs.batteryLevel).toBe(100);
		});

		it('should throw DeviceError carrying the original string when the home lookup rejects with a plain string', async () => {
			// Arrange
			vi.mocked(loginApi.getBasicHomeInfo).mockRejectedValue('boom');
			// Act
			const promise = service.listDevices();
			// Assert
			await expect(promise).rejects.toBeInstanceOf(DeviceError);
			await expect(promise).rejects.toMatchObject({ metadata: { originalError: 'boom' } });
			expect(logger.error).toHaveBeenCalledWith('Failed to list devices:', 'boom');
		});
	});

	describe('getHomeDataForUpdating', () => {
		it.each([
			{ label: 'deviceStatus is undefined', deviceStatus: undefined },
			{ label: 'deviceStatus has no battery key', deviceStatus: {} },
		])('should default batteryLevel to 100 when $label', async ({ deviceStatus }) => {
			// Arrange
			vi.mocked(iotApi.getHomev2).mockResolvedValue(createHome([createDevice({ deviceStatus })]));
			// Act
			const result = await service.getHomeDataForUpdating(42);
			// Assert
			expect(result?.devices[0].specs.batteryLevel).toBe(100);
		});
	});
});
