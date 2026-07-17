import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoomMap } from '../core/application/models/index.js';
import { RoomEntity } from '../core/domain/entities/Room.js';
import { RoborockMatterbridgePlatform } from '../module.js';
import { DeviceRegistry } from '../platform/deviceRegistry.js';
import { PlatformConfigManager } from '../platform/platformConfigManager.js';
import { ProtocolVersion } from '../roborockCommunication/enums/index.js';
import { DeviceCategory } from '../roborockCommunication/models/deviceCategory.js';
import { DeviceModel } from '../roborockCommunication/models/deviceModel.js';
import { Device, Home } from '../roborockCommunication/models/index.js';
import { UserData } from '../roborockCommunication/models/userData.js';
import { RoborockService } from '../services/roborockService.js';
import { RoborockVacuumCleaner } from '../types/roborockVacuumCleaner.js';
import { asPartial, createMockLogger } from './testUtils.js';

describe('PlatformRunner.getRoomMapFromDevice', () => {
	let platform: RoborockMatterbridgePlatform;
	let registry: DeviceRegistry;
	let roborockService: RoborockService;

	beforeEach(() => {
		const robots = new Map<string, RoborockVacuumCleaner>();
		registry = asPartial<DeviceRegistry>({
			robotsMap: robots,
			getRobot: (duid: string) => robots.get(duid),
		});
		const configManager = {
			get isMultipleMapEnabled() {
				return false;
			},
		};
		platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			roborockService: (roborockService = asPartial<RoborockService>({
				getRoomMap: vi.fn().mockResolvedValue(undefined),
				getMapInfo: vi.fn().mockResolvedValue(undefined),
			})),
			registry: registry,
			configManager: asPartial<PlatformConfigManager>(configManager),
		});
	});

	function createDevice(rooms: RoomEntity[] = []): Device {
		const userData: UserData = {
			username: 'test',
			uid: 'u1',
			tokentype: 'Bearer',
			token: 't',
			rruid: 'rr',
			region: 'us',
			countrycode: 'US',
			country: 'US',
			nickname: 'n',
			rriot: { u: 'u', s: 's', h: 'h', k: 'k', r: { r: 'r', a: 'a', m: 'm', l: 'l' } },
		};
		return {
			duid: 'duid1',
			name: 'TestVac',
			sn: 'SN1',
			serialNumber: 'SN1',
			activeTime: 0,
			createTime: 0,
			localKey: 'lk',
			pv: '1.0',
			online: true,
			productId: 'p1',
			rrHomeId: 1,
			fv: '1.0',
			deviceStatus: {},
			schema: [],
			specs: {
				id: 'duid1',
				firmwareVersion: '1.0',
				serialNumber: 'SN1',
				model: DeviceModel.QREVO_EDGE_5V1,
				protocol: ProtocolVersion.V1,
				category: DeviceCategory.VacuumCleaner,
				batteryLevel: 100,
				hasRealTimeConnection: true,
			},
			store: {
				userData,
				localKey: 'lk',
				pv: '1.0',
				model: DeviceModel.QREVO_EDGE_5V1,
				homeData: {
					id: 1,
					name: 'Test Home',
					products: [],
					devices: [],
					receivedDevices: [],
					rooms,
				} satisfies Home,
			},
			mapInfos: undefined,
		};
	}

	it('fires getMapInfo and getRoomMap and returns void', async () => {
		const device = createDevice([new RoomEntity(1, 'Kitchen'), new RoomEntity(2, 'Study')]);

		const result = await RoomMap.fromMapInfo(device, platform);

		expect(result).toBeUndefined();
		expect(roborockService.getMapInfo).toHaveBeenCalledWith(device.duid);
		expect(roborockService.getRoomMap).toHaveBeenCalledWith(device.duid, -1);
	});

	it('logs error and returns when roborockService is undefined', async () => {
		const device = createDevice();
		const context = { roborockService: undefined, log: platform.log };

		const result = await RoomMap.fromMapInfo(device, context);

		expect(result).toBeUndefined();
		expect(platform.log.error).toHaveBeenCalledWith('Roborock service not initialized');
	});

	it('calls getMapInfo before getRoomMap', async () => {
		const callOrder: string[] = [];
		vi.mocked(roborockService.getMapInfo).mockImplementation(async () => {
			callOrder.push('getMapInfo');
		});
		vi.mocked(roborockService.getRoomMap).mockImplementation(async () => {
			callOrder.push('getRoomMap');
		});
		const device = createDevice();

		await RoomMap.fromMapInfo(device, platform);

		expect(callOrder).toEqual(['getMapInfo', 'getRoomMap']);
	});
});
