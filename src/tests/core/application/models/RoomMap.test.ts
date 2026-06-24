import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MapInfoPlatformContext, MapReference } from '../../../../core/application/models/RoomMap.js';
import { RoomMap } from '../../../../core/application/models/RoomMap.js';
import type { RoomMapping } from '../../../../core/application/models/RoomMapping.js';
import type { Device, DeviceInformation } from '../../../../roborockCommunication/models/device.js';
import type { Home } from '../../../../roborockCommunication/models/home.js';
import type { RoborockService } from '../../../../services/roborockService.js';
import { asPartial, createMockLogger, createMockRoborockService } from '../../../helpers/testUtils.js';

function createRoomMapping(id: number, iot_map_id: number, overrides: Partial<RoomMapping> = {}): RoomMapping {
	return {
		id,
		iot_name_id: `room${id}`,
		tag: 0,
		iot_map_id,
		iot_name: `Room ${id}`,
		...overrides,
	};
}

function createMockDevice(): Device {
	return asPartial<Device>({
		duid: 'test-duid',
		store: asPartial<DeviceInformation>({ homeData: asPartial<Home>({ rooms: [] }) }),
		mapInfos: undefined,
	});
}

describe('RoomMap', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('hasRooms', () => {
		it('should return true when rooms exist', () => {
			const roomMap = new RoomMap([createRoomMapping(1, 0)]);
			expect(roomMap.hasRooms).toBe(true);
		});

		it('should return false when no rooms exist', () => {
			const roomMap = new RoomMap([]);
			expect(roomMap.hasRooms).toBe(false);
		});
	});

	describe('rooms', () => {
		it('should return all room mappings', () => {
			const mappings = [createRoomMapping(1, 0), createRoomMapping(2, 0)];
			const roomMap = new RoomMap(mappings);
			expect(roomMap.rooms).toEqual(mappings);
		});
	});

	describe('getRooms', () => {
		const mapRefs: MapReference[] = [{ id: 10, name: 'First Floor' }];

		it('should filter rooms by map id when enableMultipleMap is false', () => {
			const roomMap = new RoomMap([createRoomMapping(1, 10), createRoomMapping(2, 20), createRoomMapping(3, 10)]);
			const result = roomMap.getRooms(mapRefs, false);
			expect(result).toHaveLength(2);
			expect(result.map((r) => r.id)).toEqual([1, 3]);
		});

		it('should return all rooms when enableMultipleMap is true', () => {
			const roomMap = new RoomMap([createRoomMapping(1, 10), createRoomMapping(2, 20), createRoomMapping(3, 10)]);
			const result = roomMap.getRooms(mapRefs, true);
			expect(result).toHaveLength(3);
		});

		it('should include rooms with undefined iot_map_id when filtering', () => {
			const roomWithUndefinedMap = createRoomMapping(4, 0, { iot_map_id: undefined as unknown as number });
			const roomMap = new RoomMap([createRoomMapping(1, 10), roomWithUndefinedMap]);
			const result = roomMap.getRooms(mapRefs, false);
			expect(result.map((r) => r.id)).toContain(4);
		});

		it('should default to mapId 0 when map_info is empty', () => {
			const roomMap = new RoomMap([createRoomMapping(1, 0), createRoomMapping(2, 10)]);
			const result = roomMap.getRooms([], false);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe(1);
		});

		it('should default enableMultipleMap to false', () => {
			const roomMap = new RoomMap([createRoomMapping(1, 10), createRoomMapping(2, 20)]);
			const result = roomMap.getRooms(mapRefs);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe(1);
		});
	});

	describe('empty', () => {
		it('should return a RoomMap with no rooms', () => {
			const roomMap = RoomMap.empty();
			expect(roomMap.hasRooms).toBe(false);
			expect(roomMap.rooms).toHaveLength(0);
		});
	});

	describe('fromMapInfo', () => {
		let context: MapInfoPlatformContext;
		let roborockService: RoborockService;

		beforeEach(() => {
			roborockService = createMockRoborockService();
			context = {
				roborockService,
				log: createMockLogger(),
			};
		});

		it('should log error and return when roborockService is undefined', async () => {
			context.roborockService = undefined;
			const device = createMockDevice();

			const result = await RoomMap.fromMapInfo(device, context);

			expect(result).toBeUndefined();
			expect(context.log.error).toHaveBeenCalledWith('Roborock service not initialized');
		});

		it('should call getMapInfo and getRoomMap on the service', async () => {
			vi.mocked(roborockService.getMapInfo).mockResolvedValue();
			vi.mocked(roborockService.getRoomMap).mockResolvedValue(undefined);
			const device = createMockDevice();

			const result = await RoomMap.fromMapInfo(device, context);

			expect(result).toBeUndefined();
			expect(roborockService.getMapInfo).toHaveBeenCalledWith(device.duid);
			expect(roborockService.getRoomMap).toHaveBeenCalledWith(device.duid, -1);
		});
	});
});
