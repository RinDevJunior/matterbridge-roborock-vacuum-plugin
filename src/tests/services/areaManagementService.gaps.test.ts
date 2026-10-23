import { AnsiLogger } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ROUTINE_MAP_ID } from '../../constants/ids.js';
import { MapInfo, RoomIndexMap } from '../../core/application/models/index.js';
import { DeviceError } from '../../errors/index.js';
import { SupportedAreasResult } from '../../initialData/getSupportedAreas.js';
import { MultipleMapDto } from '../../roborockCommunication/models/home/index.js';
import { RawRoomMappingData } from '../../roborockCommunication/models/index.js';
import { AreaManagementService } from '../../services/areaManagementService.js';
import { MessageRoutingService } from '../../services/index.js';
import { asPartial, createMockLogger } from '../helpers/testUtils.js';

const mockDeviceId = 'test-device-1';

const STARTUP_ROOMS = [
	{ id: 1, tag: 14, iot_name_id: '11100845', iot_name: 'Living' },
	{ id: 2, tag: 9, iot_name_id: '11100849', iot_name: 'Bathroom' },
	{ id: 3, tag: 6, iot_name_id: '11100842', iot_name: 'Kitchen' },
	{ id: 4, tag: 1, iot_name_id: '11100847', iot_name: 'Bedroom' },
	{ id: 5, tag: 10, iot_name_id: '12231095', iot_name: 'Hallway' },
];

const STARTUP_RAW = [
	[1, '11100845', 14],
	[2, '11100849', 9],
	[3, '11100842', 6],
	[4, '11100847', 1],
	[5, '12231095', 10],
] as Partial<RawRoomMappingData> as RawRoomMappingData;

function createMockRoutingService() {
	return asPartial<MessageRoutingService>({
		getMapInfo: vi.fn(),
		getMapInfoV2: vi.fn(),
		getRoomMap: vi.fn(),
		getRoomMapV2: vi.fn(),
		switchMap: vi.fn(),
		requestHomeMapPush: vi.fn(),
	});
}

/** Map list with no rooms, so getMapInfo only publishes maps and never areas. */
function createNoRoomsMapInfo(mapFlags: number[]): MapInfo {
	return new MapInfo({
		max_multi_map: mapFlags.length,
		max_bak_map: 0,
		multi_map_count: mapFlags.length,
		map_info: mapFlags.map((mapFlag) => ({
			mapFlag,
			add_time: 0,
			length: 0,
			name: `Map ${mapFlag}`,
			bak_maps: [],
			rooms: [],
		})),
	} satisfies MultipleMapDto);
}

/** Map 0 holds one room (Den); map 1 holds the five startup rooms. */
function createTwoMapInfo(): MapInfo {
	return new MapInfo({
		max_multi_map: 2,
		max_bak_map: 0,
		multi_map_count: 2,
		map_info: [
			{
				mapFlag: 0,
				add_time: 0,
				length: 1,
				name: 'Ground',
				bak_maps: [],
				rooms: [{ id: 9, tag: 1, iot_name_id: '9', iot_name: 'Den' }],
			},
			{ mapFlag: 1, add_time: 0, length: 5, name: 'Upper', bak_maps: [], rooms: STARTUP_ROOMS },
		],
	} satisfies MultipleMapDto);
}

function makeArea(areaId: number, mapId: number): ServiceArea.Area {
	return asPartial<ServiceArea.Area>({ areaId, mapId });
}

describe('AreaManagementService gap coverage', () => {
	let logger: AnsiLogger;
	let routing: MessageRoutingService;
	let service: AreaManagementService;

	beforeEach(() => {
		vi.clearAllMocks();
		logger = createMockLogger();
		routing = createMockRoutingService();
		service = new AreaManagementService(logger, routing);
	});

	describe('isMultipleMapEnabled', () => {
		it('should return true when constructed without the multiple-map flag', () => {
			expect(service.isMultipleMapEnabled()).toBe(true);
		});

		it('should return false when constructed with multiple maps disabled', () => {
			const disabled = new AreaManagementService(logger, routing, false, false);

			expect(disabled.isMultipleMapEnabled()).toBe(false);
		});
	});

	describe('applySupportedAreasResult', () => {
		function createResult(areas: ServiceArea.Area[]): SupportedAreasResult {
			return asPartial<SupportedAreasResult>({
				supportedAreas: areas,
				supportedMaps: [],
				roomIndexMap: new RoomIndexMap(new Map(), new Map()),
			});
		}

		it('should replace all areas and notify the listener when mergeMapId is undefined', () => {
			const listener = vi.fn();
			service.registerAreasListener(mockDeviceId, listener);
			service.setSupportedAreas(mockDeviceId, [makeArea(0, 1)]);
			const incoming = [makeArea(0, 3)];

			service.applySupportedAreasResult(mockDeviceId, createResult(incoming));

			expect(service.getSupportedAreas(mockDeviceId)).toEqual(incoming);
			expect(listener).toHaveBeenLastCalledWith(incoming, []);
		});

		it('should merge by mapId and keep other maps when multiple maps are enabled', () => {
			service.setSupportedAreas(mockDeviceId, [makeArea(0, 1)]);

			service.applySupportedAreasResult(mockDeviceId, createResult([makeArea(0, 3)]), 3);

			const mapIds = service.getSupportedAreas(mockDeviceId).map((area) => area.mapId);
			expect(mapIds).toEqual(expect.arrayContaining([1, 3]));
		});

		it('should fully replace areas instead of merging when multiple maps are disabled', () => {
			const disabled = new AreaManagementService(logger, routing, false, false);
			disabled.setSupportedAreas(mockDeviceId, [makeArea(0, 1)]);
			const incoming = [makeArea(0, 3)];

			disabled.applySupportedAreasResult(mockDeviceId, createResult(incoming), 3);

			expect(disabled.getSupportedAreas(mockDeviceId)).toEqual(incoming);
		});
	});

	describe('room map application with multiple maps disabled', () => {
		it('should return raw data without publishing areas when resolved map is not the primary map', async () => {
			const disabled = new AreaManagementService(logger, routing, false, false);
			vi.mocked(routing.getMapInfo).mockResolvedValue(createTwoMapInfo());
			await disabled.getMapInfo(mockDeviceId);
			const listener = vi.fn();
			disabled.registerAreasListener(mockDeviceId, listener);
			vi.mocked(routing.getRoomMap).mockResolvedValueOnce(STARTUP_RAW);

			const result = await disabled.getRoomMap(mockDeviceId, 1);

			expect(result).toEqual(STARTUP_RAW);
			expect(listener).not.toHaveBeenCalled();
		});

		it('should fall back to the empty MapInfo when no map info is cached for the device', async () => {
			vi.mocked(routing.getRoomMap).mockResolvedValueOnce(STARTUP_RAW);

			const result = await service.getRoomMap(mockDeviceId, 0);

			expect(result).toEqual(STARTUP_RAW);
			expect(service.getSupportedAreas(mockDeviceId).length).toBeGreaterThan(0);
			expect(service.getSupportedAreas(mockDeviceId).every((area) => area.mapId === 0)).toBe(true);
		});
	});

	describe('ensureAreasForMap', () => {
		it('should return true without fetching when map id is a non-physical routine map', async () => {
			const routineResult = await service.ensureAreasForMap(mockDeviceId, ROUTINE_MAP_ID);
			const negativeResult = await service.ensureAreasForMap(mockDeviceId, -1);

			expect(routineResult).toBe(true);
			expect(negativeResult).toBe(true);
			expect(routing.getRoomMap).not.toHaveBeenCalled();
			expect(routing.switchMap).not.toHaveBeenCalled();
		});

		it('should return false without fetching when multiple maps are disabled and no areas exist for a non-primary map', async () => {
			const disabled = new AreaManagementService(logger, routing, false, false);
			vi.mocked(routing.getMapInfo).mockResolvedValue(createNoRoomsMapInfo([0, 1]));
			await disabled.getMapInfo(mockDeviceId);

			const result = await disabled.ensureAreasForMap(mockDeviceId, 1);

			expect(result).toBe(false);
			expect(routing.getRoomMap).not.toHaveBeenCalled();
		});

		it('should return true without fetching when multiple maps are disabled and the non-primary map already has areas', async () => {
			const disabled = new AreaManagementService(logger, routing, false, false);
			vi.mocked(routing.getMapInfo).mockResolvedValue(createNoRoomsMapInfo([0, 1]));
			await disabled.getMapInfo(mockDeviceId);
			disabled.setSupportedAreas(mockDeviceId, [makeArea(0, 1)]);

			const result = await disabled.ensureAreasForMap(mockDeviceId, 1);

			expect(result).toBe(true);
			expect(routing.getRoomMap).not.toHaveBeenCalled();
		});

		it('should return true without fetching when areas already exist for the map and multiple maps are enabled', async () => {
			service.setSupportedAreas(mockDeviceId, [makeArea(0, 1)]);

			const result = await service.ensureAreasForMap(mockDeviceId, 1);

			expect(result).toBe(true);
			expect(routing.getRoomMap).not.toHaveBeenCalled();
		});

		it('should fetch and apply the primary map when multiple maps are disabled and it has no areas yet', async () => {
			const disabled = new AreaManagementService(logger, routing, false, false);
			vi.mocked(routing.getMapInfo).mockResolvedValue(createNoRoomsMapInfo([0, 1]));
			await disabled.getMapInfo(mockDeviceId);
			vi.mocked(routing.getRoomMap).mockResolvedValueOnce(STARTUP_RAW);

			const result = await disabled.ensureAreasForMap(mockDeviceId, 0);

			expect(result).toBe(true);
			expect(routing.getRoomMap).toHaveBeenCalledWith(mockDeviceId, 0);
		});

		it('should switch to the map before fetching when switchFirst is requested', async () => {
			vi.mocked(routing.getRoomMap).mockResolvedValueOnce(STARTUP_RAW);

			const result = await service.ensureAreasForMap(mockDeviceId, 2, { switchFirst: true });

			expect(result).toBe(true);
			expect(routing.switchMap).toHaveBeenCalledWith(mockDeviceId, 2);
			expect(routing.getRoomMap).toHaveBeenCalledWith(mockDeviceId, 2);
		});

		it('should not switch map when switchFirst is not requested', async () => {
			vi.mocked(routing.getRoomMap).mockResolvedValueOnce(STARTUP_RAW);

			await service.ensureAreasForMap(mockDeviceId, 2);

			expect(routing.switchMap).not.toHaveBeenCalled();
			expect(routing.getRoomMap).toHaveBeenCalledWith(mockDeviceId, 2);
		});

		it('should return false when the fetched room map yields no areas for the map', async () => {
			vi.mocked(routing.getRoomMap).mockResolvedValueOnce([]);

			const result = await service.ensureAreasForMap(mockDeviceId, 2);

			expect(result).toBe(false);
		});

		it('should return false and log the error when the room map fetch rejects', async () => {
			vi.mocked(routing.getRoomMap).mockRejectedValueOnce(new Error('boom'));

			const result = await service.ensureAreasForMap(mockDeviceId, 2);

			expect(result).toBe(false);
			expect(logger.error).toHaveBeenCalledWith(
				expect.stringContaining('ensureAreasForMap failed for test-device-1 map 2'),
			);
		});

		it('should return false and log the error when service routing is missing', async () => {
			const noRouting = new AreaManagementService(logger, undefined);

			const result = await noRouting.ensureAreasForMap(mockDeviceId, 1);

			expect(result).toBe(false);
			expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Service routing not initialized'));
		});
	});

	describe('live map updates without service routing', () => {
		it('should throw DeviceError from getMapInfo when liveMapUpdates is enabled and routing is missing', async () => {
			const live = new AreaManagementService(logger, undefined, true);

			await expect(live.getMapInfo(mockDeviceId)).rejects.toThrow(DeviceError);
		});

		it('should throw DeviceError from getRoomMap when liveMapUpdates is enabled and routing is missing', async () => {
			const live = new AreaManagementService(logger, undefined, true);

			await expect(live.getRoomMap(mockDeviceId, 0)).rejects.toThrow(DeviceError);
		});
	});

	describe('resolveInitialAreas', () => {
		it('should skip the routine map without switching or fetching it', async () => {
			vi.mocked(routing.getMapInfo).mockResolvedValue(createNoRoomsMapInfo([ROUTINE_MAP_ID]));

			const result = await service.resolveInitialAreas(mockDeviceId);

			expect(routing.switchMap).not.toHaveBeenCalled();
			expect(routing.getRoomMap).toHaveBeenCalledTimes(1);
			expect(result.supportedMaps).toHaveLength(1);
		});

		it('should bootstrap maps without areas by switching and restore the original active map', async () => {
			vi.mocked(routing.getMapInfo).mockResolvedValue(createNoRoomsMapInfo([0, 2]));
			vi.mocked(routing.getRoomMap).mockResolvedValueOnce(STARTUP_RAW).mockResolvedValueOnce(STARTUP_RAW);

			const result = await service.resolveInitialAreas(mockDeviceId);

			expect(routing.switchMap).toHaveBeenCalledWith(mockDeviceId, 2);
			expect(routing.switchMap).toHaveBeenLastCalledWith(mockDeviceId, 0);
			expect(result.supportedAreas.map((area) => area.mapId)).toEqual(expect.arrayContaining([0, 2]));
		});

		it('should sort pre-existing areas without mapId and missing index info by map', async () => {
			vi.mocked(routing.getMapInfo).mockResolvedValue(createNoRoomsMapInfo([0, 2]));
			service.setSupportedAreas(mockDeviceId, [
				asPartial<ServiceArea.Area>({ areaId: 0 }),
				makeArea(1, 0),
				asPartial<ServiceArea.Area>({ areaId: 2 }),
			]);
			service.setSupportedAreaIndexMap(
				mockDeviceId,
				new RoomIndexMap(new Map([[0, { mapId: null, roomId: 16, roomName: 'Den' }]]), new Map()),
			);

			await service.resolveInitialAreas(mockDeviceId);

			expect(service.getSupportedAreas(mockDeviceId).map((area) => area.areaId)).toEqual([0, 1, 2]);
			expect(service.getSupportedAreasIndexMap(mockDeviceId)?.getRoomId(0)).toBe(16);
		});
	});

	describe('requestV1MapRefresh', () => {
		it('should log the stringified rejection when the failure is not an Error instance', async () => {
			vi.mocked(routing.requestHomeMapPush).mockRejectedValueOnce('plain failure');

			await service.requestV1MapRefresh(mockDeviceId);

			expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('requestV1MapRefresh failed: plain failure'));
		});
	});
});
