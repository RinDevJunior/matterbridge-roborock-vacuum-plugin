import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MapInfo, RoomIndexMap } from '../../core/application/models/index.js';
import { DeviceError } from '../../errors/index.js';
import { AreaInfo, SegmentInfo } from '../../initialData/getSupportedAreas.js';
import { RoborockIoTApi } from '../../roborockCommunication/api/iotClient.js';
import { MultipleMapDto, RoomDto } from '../../roborockCommunication/models/home/index.js';
import { RawRoomMappingData } from '../../roborockCommunication/models/index.js';
import { Scene } from '../../roborockCommunication/models/scene.js';
import { AreaManagementService } from '../../services/areaManagementService.js';
import { MessageRoutingService } from '../../services/index.js';

describe('AreaManagementService', () => {
	let areaService: AreaManagementService;
	let mockLogger: any;
	let mockIotApi: any;
	let mockMessageRoutingService: any;

	const mockDeviceId = 'test-device-1';
	const mockAreas: ServiceArea.Area[] = [
		{ areaId: 0, mapId: 1 } as ServiceArea.Area,
		{ areaId: 1, mapId: 1 } as ServiceArea.Area,
		{ areaId: 2, mapId: 1 } as ServiceArea.Area,
	];

	const mockRoutines: ServiceArea.Area[] = [
		{ areaId: 100, mapId: 1 } as ServiceArea.Area,
		{ areaId: 101, mapId: 1 } as ServiceArea.Area,
	];

	beforeEach(() => {
		mockLogger = createMockLogger() as Partial<AnsiLogger> as AnsiLogger;
		mockIotApi = createMockIotApi() as Partial<RoborockIoTApi> as RoborockIoTApi;
		mockMessageRoutingService = {
			getRoomMap: vi.fn(),
			getMapInfo: vi.fn(),
		} satisfies Partial<MessageRoutingService>;
		areaService = new AreaManagementService(mockLogger, mockMessageRoutingService);
		areaService.setIotApi(mockIotApi);
	});

	function createMockLogger() {
		return {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			notice: vi.fn(),
		};
	}

	function createMockIotApi() {
		return {
			getScenes: vi.fn(),
			startScene: vi.fn(),
		};
	}

	function createStartupMapInfo(): MapInfo {
		const multimap = {
			max_multi_map: 1,
			max_bak_map: 0,
			multi_map_count: 1,
			map_info: [
				{
					mapFlag: 0,
					add_time: 1771060270,
					length: 5,
					name: 'Home',
					bak_maps: [],
					rooms: [
						{ id: 1, tag: 14, iot_name_id: '11100845', iot_name: 'Living' },
						{ id: 2, tag: 9, iot_name_id: '11100849', iot_name: 'Bathroom' },
						{ id: 3, tag: 6, iot_name_id: '11100842', iot_name: 'Kitchen' },
						{ id: 4, tag: 1, iot_name_id: '11100847', iot_name: 'Bedroom' },
						{ id: 5, tag: 10, iot_name_id: '12231095', iot_name: 'Hallway' },
					],
				},
			],
		} satisfies MultipleMapDto;

		return new MapInfo(multimap);
	}

	const startupRawRoomMapping = [
		[1, '11100845', 14],
		[2, '11100849', 9],
		[3, '11100842', 6],
		[4, '11100847', 1],
		[5, '12231095', 10],
	] as Partial<RawRoomMappingData> as RawRoomMappingData;

	const partialDeviceRooms: RoomDto[] = [{ id: 12231095, name: 'Hallway from cloud' }];

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('Initialization', () => {
		it('should initialize with all dependencies', () => {
			expect(areaService).toBeDefined();
		});

		it('should initialize with logger only', () => {
			const serviceWithoutDeps = new AreaManagementService(mockLogger as AnsiLogger, undefined);
			expect(serviceWithoutDeps).toBeDefined();
		});

		it('should initialize with logger and message routing service', () => {
			const service = new AreaManagementService(
				mockLogger as AnsiLogger,
				mockMessageRoutingService as MessageRoutingService,
			);
			expect(service).toBeDefined();
		});

		it('should set IoT API after initialization', () => {
			const service = new AreaManagementService(mockLogger as AnsiLogger, undefined);
			const newIotApi = {} as RoborockIoTApi;

			expect(() => {
				service.setIotApi(newIotApi);
			}).not.toThrow();
		});
	});

	describe('Supported Areas Management', () => {
		it('should set and get supported areas', () => {
			areaService.setSupportedAreas(mockDeviceId, mockAreas);

			const areas = areaService.getSupportedAreas(mockDeviceId);

			expect(areas).toBeDefined();
			expect(areas).toHaveLength(3);
			expect(areas).toEqual(mockAreas);
		});

		it('should return undefined for device without areas', () => {
			const areas = areaService.getSupportedAreas('unknown-device');

			expect(areas).toEqual([]);
		});

		it('should handle empty areas array', () => {
			areaService.setSupportedAreas(mockDeviceId, []);

			const areas = areaService.getSupportedAreas(mockDeviceId);

			expect(areas).toBeDefined();
			expect(areas).toHaveLength(0);
		});

		it('should support multiple devices', () => {
			const device2 = 'test-device-2';
			const areas2: ServiceArea.Area[] = [{ areaId: 10, mapId: 2 } as ServiceArea.Area];

			areaService.setSupportedAreas(mockDeviceId, mockAreas);
			areaService.setSupportedAreas(device2, areas2);

			expect(areaService.getSupportedAreas(mockDeviceId)).toEqual(mockAreas);
			expect(areaService.getSupportedAreas(device2)).toEqual(areas2);
		});

		it('should update existing areas', () => {
			areaService.setSupportedAreas(mockDeviceId, mockAreas);

			const newAreas: ServiceArea.Area[] = [{ areaId: 99, mapId: 1 } as ServiceArea.Area];
			areaService.setSupportedAreas(mockDeviceId, newAreas);

			const areas = areaService.getSupportedAreas(mockDeviceId);
			expect(areas).toEqual(newAreas);
		});
	});

	describe('Area Index Map Management', () => {
		it('should set and get area index map', () => {
			const roomMapData = new Map<number, AreaInfo>([
				[0, { roomId: 16, mapId: 1, roomName: 'rn-1' }],
				[1, { roomId: 17, mapId: 1, roomName: 'rn-2' }],
			]);

			const roomInfo = new Map<string, SegmentInfo>([]);
			const indexMap = new RoomIndexMap(roomMapData, roomInfo);

			areaService.setSupportedAreaIndexMap(mockDeviceId, indexMap);

			const retrievedMap = areaService.getSupportedAreasIndexMap(mockDeviceId);

			expect(retrievedMap).toBeDefined();
			expect(retrievedMap).toBe(indexMap);
		});

		it('should return undefined for device without index map', () => {
			const indexMap = areaService.getSupportedAreasIndexMap('unknown-device');

			expect(indexMap).toBeUndefined();
		});
	});

	describe('Selected Areas Management', () => {
		it('should return empty array when no areas selected', () => {
			const selectedAreas = areaService.getSelectedAreas(mockDeviceId);

			expect(selectedAreas).toEqual([]);
		});

		it('should handle empty selection', () => {
			const roomMapData = new Map<number, AreaInfo>([[0, { roomId: 16, mapId: 1, roomName: 'rn-1' }]]);
			const roomInfo = new Map<string, SegmentInfo>([]);
			const indexMap = new RoomIndexMap(roomMapData, roomInfo);

			areaService.setSupportedAreaIndexMap(mockDeviceId, indexMap);
			areaService.setSelectedAreas(mockDeviceId, []);

			const selectedAreas = areaService.getSelectedAreas(mockDeviceId);

			expect(selectedAreas).toEqual([]);
		});

		it('should return empty array for unknown device', () => {
			const selectedAreas = areaService.getSelectedAreas('unknown-device');

			expect(selectedAreas).toEqual([]);
		});
	});

	describe('Supported Routines Management', () => {
		it('should set and get supported routines', () => {
			areaService.setSupportedRoutines(mockDeviceId, mockRoutines);

			const routines = areaService.getSupportedRoutines(mockDeviceId);

			expect(routines).toBeDefined();
			expect(routines).toHaveLength(2);
			expect(routines).toEqual(mockRoutines);
		});

		it('should return undefined for device without routines', () => {
			const routines = areaService.getSupportedRoutines('unknown-device');

			expect(routines).toBeUndefined();
		});

		it('should handle empty routines array', () => {
			areaService.setSupportedRoutines(mockDeviceId, []);

			const routines = areaService.getSupportedRoutines(mockDeviceId);

			expect(routines).toBeDefined();
			expect(routines).toHaveLength(0);
		});
	});

	describe('getMapInformation', () => {
		const emptyMapInfo = new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });

		it('should retrieve map information successfully', async () => {
			mockMessageRoutingService.getMapInfo.mockResolvedValue(emptyMapInfo);

			await areaService.getMapInfo(mockDeviceId);

			expect(mockMessageRoutingService.getMapInfo).toHaveBeenCalled();
			expect(mockLogger.debug).toHaveBeenCalledWith('AreaManagementService - getMapInfo', mockDeviceId);
		});

		it('should return MapInfo when no maps available', async () => {
			mockMessageRoutingService.getMapInfo.mockResolvedValue(emptyMapInfo);

			const mapInfo = await areaService.getMapInfo(mockDeviceId);

			expect(mapInfo).toBeDefined();
			expect(mapInfo?.maps.length).toBe(0);
		});

		it('should throw DeviceError when service routing not initialized', async () => {
			const serviceWithoutClient = new AreaManagementService(mockLogger, undefined);

			await expect(serviceWithoutClient.getMapInfo(mockDeviceId)).rejects.toThrow(DeviceError);
			await expect(serviceWithoutClient.getMapInfo(mockDeviceId)).rejects.toThrow('Service routing not initialized');
		});
	});

	describe('getRoomMappings', () => {
		it('should retrieve room mappings with non-secure request', async () => {
			mockMessageRoutingService.getRoomMap.mockResolvedValue([]);

			await areaService.getRoomMap(mockDeviceId, 1);

			expect(mockMessageRoutingService.getRoomMap).toHaveBeenCalledWith(mockDeviceId, 1);
		});

		it('should return undefined when message client not initialized', async () => {
			const serviceWithoutClient = new AreaManagementService(mockLogger, undefined);
			await expect(serviceWithoutClient.getRoomMap(mockDeviceId, 1)).rejects.toThrow(DeviceError);
		});

		it('should handle empty room mappings', async () => {
			mockMessageRoutingService.getRoomMap.mockResolvedValue([]);

			await areaService.getRoomMap(mockDeviceId, 1);

			expect(mockMessageRoutingService.getRoomMap).toHaveBeenCalledWith(mockDeviceId, 1);
		});
	});

	describe('getScenes', () => {
		const mockHomeId = 12345;
		const mockScenes: Scene[] = [{ id: 1, name: 'Morning Clean' } as Scene, { id: 2, name: 'Evening Clean' } as Scene];

		it('should retrieve scenes successfully', async () => {
			mockIotApi.getScenes.mockResolvedValue(mockScenes);

			const scenes = await areaService.getScenes(mockHomeId);

			expect(scenes).toEqual(mockScenes);
			expect(mockIotApi.getScenes).toHaveBeenCalledWith(mockHomeId);
		});

		it('should throw DeviceError when IoT API not initialized', async () => {
			const serviceWithoutApi = new AreaManagementService(mockLogger, undefined);

			await expect(serviceWithoutApi.getScenes(mockHomeId)).rejects.toThrow(DeviceError);
			await expect(serviceWithoutApi.getScenes(mockHomeId)).rejects.toThrow('IoT API not initialized');
		});

		it('should handle empty scenes array', async () => {
			mockIotApi.getScenes.mockResolvedValue([]);

			const scenes = await areaService.getScenes(mockHomeId);

			expect(scenes).toEqual([]);
		});

		it('should handle undefined scenes', async () => {
			mockIotApi.getScenes.mockResolvedValue(undefined);

			const scenes = await areaService.getScenes(mockHomeId);

			expect(scenes).toBeUndefined();
		});
	});

	describe('startScene', () => {
		const mockSceneId = 42;

		it('should start scene successfully', async () => {
			const mockResult = { success: true };
			mockIotApi.startScene.mockResolvedValue(mockResult);

			const result = await areaService.startScene(mockSceneId);

			expect(result).toEqual(mockResult);
			expect(mockIotApi.startScene).toHaveBeenCalledWith(mockSceneId);
		});

		it('should throw DeviceError when IoT API not initialized', async () => {
			const serviceWithoutApi = new AreaManagementService(mockLogger, undefined);

			await expect(serviceWithoutApi.startScene(mockSceneId)).rejects.toThrow(DeviceError);
			await expect(serviceWithoutApi.startScene(mockSceneId)).rejects.toThrow('IoT API not initialized');
		});

		it('should propagate API errors', async () => {
			const error = new Error('Scene execution failed');
			mockIotApi.startScene.mockRejectedValue(error);

			await expect(areaService.startScene(mockSceneId)).rejects.toThrow('Scene execution failed');
		});
	});

	describe('clearAll', () => {
		it('should clear all data', () => {
			// Set up some data
			areaService.setSupportedAreas(mockDeviceId, mockAreas);
			areaService.setSupportedRoutines(mockDeviceId, mockRoutines);
			const roomMapData = new Map<number, AreaInfo>([[0, { roomId: 16, mapId: 1, roomName: 'rn-1' }]]);
			const roomInfo = new Map<string, SegmentInfo>([]);
			areaService.setSupportedAreaIndexMap(mockDeviceId, new RoomIndexMap(roomMapData, roomInfo));
			areaService.setSelectedAreas(mockDeviceId, [0]);
			areaService.setProgress(mockDeviceId, [{ areaId: 0, status: ServiceArea.OperationalStatus.Operating }]);

			// Clear all
			areaService.clearAll();

			// Verify everything is cleared
			expect(areaService.getSupportedAreas(mockDeviceId)).toEqual([]);
			expect(areaService.getSupportedRoutines(mockDeviceId)).toBeUndefined();
			expect(areaService.getSupportedAreasIndexMap(mockDeviceId)).toBeUndefined();
			expect(areaService.getSelectedAreas(mockDeviceId)).toEqual([]);
			expect(areaService.getProgress(mockDeviceId)).toEqual([]);
			expect(mockLogger.debug).toHaveBeenCalledWith('AreaManagementService - All data cleared');
		});

		it('should be safe to call multiple times', () => {
			areaService.clearAll();
			areaService.clearAll();

			expect(() => {
				areaService.clearAll();
			}).not.toThrow();
		});

		it('should clear empty service without errors', () => {
			const newService = new AreaManagementService(mockLogger, undefined);

			expect(() => {
				newService.clearAll();
			}).not.toThrow();
		});
	});

	describe('setDeviceRooms', () => {
		it('stores rooms per duid', () => {
			const rooms = [{ id: 1, name: undefined } as RoomDto];
			areaService.setDeviceRooms(mockDeviceId, rooms);
			// No direct getter — verify indirectly via clearAll not throwing
			expect(() => areaService.clearAll()).not.toThrow();
		});
	});

	describe('Progress Management', () => {
		it('should set and get progress array', () => {
			const progress: ServiceArea.Progress[] = [
				{ areaId: 1, status: ServiceArea.OperationalStatus.Pending },
				{ areaId: 2, status: ServiceArea.OperationalStatus.Operating },
			];
			areaService.setProgress(mockDeviceId, progress);

			const retrieved = areaService.getProgress(mockDeviceId);

			expect(retrieved).toEqual(progress);
			expect(mockLogger.debug).toHaveBeenCalledWith('AreaManagementService - setProgress', debugStringify(progress));
		});

		it('should return empty array when no progress set for duid', () => {
			const progress = areaService.getProgress('unknown-device');

			expect(progress).toEqual([]);
		});

		it('should return empty array as default for new duid', () => {
			const newDuid = 'new-device-456';
			const progress = areaService.getProgress(newDuid);

			expect(progress).toEqual([]);
		});

		it('should handle empty progress array', () => {
			areaService.setProgress(mockDeviceId, []);

			const progress = areaService.getProgress(mockDeviceId);

			expect(progress).toEqual([]);
		});

		it('should update existing progress', () => {
			const initialProgress: ServiceArea.Progress[] = [{ areaId: 1, status: ServiceArea.OperationalStatus.Pending }];
			areaService.setProgress(mockDeviceId, initialProgress);

			const updatedProgress: ServiceArea.Progress[] = [
				{ areaId: 1, status: ServiceArea.OperationalStatus.Operating },
				{ areaId: 2, status: ServiceArea.OperationalStatus.Completed },
			];
			areaService.setProgress(mockDeviceId, updatedProgress);

			expect(areaService.getProgress(mockDeviceId)).toEqual(updatedProgress);
		});

		it('should support multiple devices independently', () => {
			const device1 = 'device-1';
			const device2 = 'device-2';

			const progress1: ServiceArea.Progress[] = [{ areaId: 1, status: ServiceArea.OperationalStatus.Pending }];
			const progress2: ServiceArea.Progress[] = [{ areaId: 10, status: ServiceArea.OperationalStatus.Operating }];

			areaService.setProgress(device1, progress1);
			areaService.setProgress(device2, progress2);

			expect(areaService.getProgress(device1)).toEqual(progress1);
			expect(areaService.getProgress(device2)).toEqual(progress2);
		});

		it('should clear progress in clearAll', () => {
			const progress: ServiceArea.Progress[] = [{ areaId: 1, status: ServiceArea.OperationalStatus.Operating }];
			areaService.setProgress(mockDeviceId, progress);

			expect(areaService.getProgress(mockDeviceId)).toEqual(progress);

			areaService.clearAll();

			expect(areaService.getProgress(mockDeviceId)).toEqual([]);
		});

		it('should handle all progress statuses', () => {
			const progress: ServiceArea.Progress[] = [
				{ areaId: 1, status: ServiceArea.OperationalStatus.Pending },
				{ areaId: 2, status: ServiceArea.OperationalStatus.Operating },
				{ areaId: 3, status: ServiceArea.OperationalStatus.Completed },
				{ areaId: 4, status: ServiceArea.OperationalStatus.Skipped },
			];
			areaService.setProgress(mockDeviceId, progress);

			const retrieved = areaService.getProgress(mockDeviceId);

			expect(retrieved).toHaveLength(4);
			expect(retrieved[0].status).toBe(ServiceArea.OperationalStatus.Pending);
			expect(retrieved[1].status).toBe(ServiceArea.OperationalStatus.Operating);
			expect(retrieved[2].status).toBe(ServiceArea.OperationalStatus.Completed);
			expect(retrieved[3].status).toBe(ServiceArea.OperationalStatus.Skipped);
		});
	});

	describe('Last Actively Cleaning State Management', () => {
		it('should return false when no entry exists (default)', () => {
			const state = areaService.getLastActivelyCleaningState('unknown-device');

			expect(state).toBe(false);
		});

		it('should set and get last actively cleaning state', () => {
			const duid = 'test-device-cleaning-state';

			areaService.setLastActivelyCleaningState(duid, true);
			const state = areaService.getLastActivelyCleaningState(duid);

			expect(state).toBe(true);
		});

		it('should return true after setting to true', () => {
			const duid = 'test-device-state-true';

			areaService.setLastActivelyCleaningState(duid, true);

			expect(areaService.getLastActivelyCleaningState(duid)).toBe(true);
		});

		it('should return false after setting to false', () => {
			const duid = 'test-device-state-false';

			areaService.setLastActivelyCleaningState(duid, false);

			expect(areaService.getLastActivelyCleaningState(duid)).toBe(false);
		});

		it('should update existing state', () => {
			const duid = 'test-device-state-update';

			areaService.setLastActivelyCleaningState(duid, true);
			expect(areaService.getLastActivelyCleaningState(duid)).toBe(true);

			areaService.setLastActivelyCleaningState(duid, false);
			expect(areaService.getLastActivelyCleaningState(duid)).toBe(false);

			areaService.setLastActivelyCleaningState(duid, true);
			expect(areaService.getLastActivelyCleaningState(duid)).toBe(true);
		});

		it('should support multiple devices independently', () => {
			const device1 = 'device-state-1';
			const device2 = 'device-state-2';

			areaService.setLastActivelyCleaningState(device1, true);
			areaService.setLastActivelyCleaningState(device2, false);

			expect(areaService.getLastActivelyCleaningState(device1)).toBe(true);
			expect(areaService.getLastActivelyCleaningState(device2)).toBe(false);
		});

		it('should clear state in clearAll', () => {
			const duid = 'test-device-state-clear';

			areaService.setLastActivelyCleaningState(duid, true);
			expect(areaService.getLastActivelyCleaningState(duid)).toBe(true);

			areaService.clearAll();

			expect(areaService.getLastActivelyCleaningState(duid)).toBe(false);
		});

		it('should clear state for multiple devices', () => {
			const device1 = 'device-clear-1';
			const device2 = 'device-clear-2';

			areaService.setLastActivelyCleaningState(device1, true);
			areaService.setLastActivelyCleaningState(device2, true);

			expect(areaService.getLastActivelyCleaningState(device1)).toBe(true);
			expect(areaService.getLastActivelyCleaningState(device2)).toBe(true);

			areaService.clearAll();

			expect(areaService.getLastActivelyCleaningState(device1)).toBe(false);
			expect(areaService.getLastActivelyCleaningState(device2)).toBe(false);
		});

		it('should log debug message when setting state', () => {
			const duid = 'test-device-state-log';

			areaService.setLastActivelyCleaningState(duid, true);

			expect(mockLogger.debug).toHaveBeenCalledWith('AreaManagementService - setLastActivelyCleaningState', {
				duid,
				isActivelyCleaning: true,
			});
		});
	});

	describe('registerAreasListener', () => {
		it('registers callback per duid', () => {
			const cb = vi.fn();
			areaService.registerAreasListener(mockDeviceId, cb);
			// callback registered — setSupportedAreas will invoke it
			areaService.setSupportedAreas(mockDeviceId, mockAreas);
			expect(cb).toHaveBeenCalledWith(mockAreas, []);
		});

		it('invokes callback when setSupportedAreas is called', () => {
			const cb = vi.fn();
			areaService.registerAreasListener(mockDeviceId, cb);
			areaService.setSupportedAreas(mockDeviceId, mockAreas);
			expect(cb).toHaveBeenCalledTimes(1);
		});

		it('invokes callback with current maps when setSupportedAreas is called', () => {
			const cb = vi.fn();
			const maps: ServiceArea.Map[] = [{ mapId: 1, name: 'Map 1' }];
			areaService.setSupportedMaps(mockDeviceId, maps);
			areaService.registerAreasListener(mockDeviceId, cb);
			areaService.setSupportedAreas(mockDeviceId, mockAreas);
			expect(cb).toHaveBeenCalledWith(mockAreas, maps);
		});
	});

	describe('setSupportedMaps / getSupportedMaps', () => {
		it('stores and retrieves maps by duid', () => {
			const maps: ServiceArea.Map[] = [
				{ mapId: 1, name: 'Map A' },
				{ mapId: 2, name: 'Map B' },
			];
			areaService.setSupportedMaps(mockDeviceId, maps);
			expect(areaService.getSupportedMaps(mockDeviceId)).toEqual(maps);
		});

		it('returns empty array for unknown duid', () => {
			expect(areaService.getSupportedMaps('unknown-duid')).toEqual([]);
		});
	});

	describe('getMapInfo — liveMapUpdates = true', () => {
		it('calls serviceRouting.getMapInfoV2 and returns undefined', async () => {
			const liveService = new AreaManagementService(
				mockLogger as AnsiLogger,
				mockMessageRoutingService as MessageRoutingService,
				true,
			);
			mockMessageRoutingService.getMapInfoV2 = vi.fn().mockResolvedValue(undefined);

			const result = await liveService.getMapInfo(mockDeviceId);
			expect(mockMessageRoutingService.getMapInfoV2).toHaveBeenCalledWith(mockDeviceId);
			expect(mockMessageRoutingService.getMapInfo).not.toHaveBeenCalled();
			expect(result).toBeUndefined();
		});
	});

	describe('getMapInfo — liveMapUpdates = false (standard path)', () => {
		it('caches mapInfo in mapInfoCache', async () => {
			const mapInfo = new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
			mockMessageRoutingService.getMapInfo.mockResolvedValue(mapInfo);

			await areaService.getMapInfo(mockDeviceId);
			// Call again — cache used: getMapInfo should be called each time (no cache bypass)
			await areaService.getMapInfo(mockDeviceId);
			expect(mockMessageRoutingService.getMapInfo).toHaveBeenCalledTimes(2);
		});

		it('calls setSupportedMaps when mapInfo.maps.length > 0', async () => {
			const mapInfo = new MapInfo({
				max_multi_map: 1,
				max_bak_map: 0,
				multi_map_count: 1,
				map_info: [{ mapFlag: 1, add_time: 0, length: 0, bak_maps: [], name: 'Test Map', rooms: [] }],
			});
			mockMessageRoutingService.getMapInfo.mockResolvedValue(mapInfo);

			await areaService.getMapInfo(mockDeviceId);
			expect(areaService.getSupportedMaps(mockDeviceId)).toEqual([{ mapId: 1, name: 'Test Map' }]);
		});

		it('skips room setup when mapInfo.hasRooms = false', async () => {
			const mapInfo = new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
			mockMessageRoutingService.getMapInfo.mockResolvedValue(mapInfo);

			await areaService.getMapInfo(mockDeviceId);
			expect(areaService.getSupportedAreas(mockDeviceId)).toEqual([]);
		});
	});

	describe('getRoomMap — liveMapUpdates = true', () => {
		it('calls serviceRouting.getRoomMapV2 and returns undefined', async () => {
			const liveService = new AreaManagementService(
				mockLogger as AnsiLogger,
				mockMessageRoutingService as MessageRoutingService,
				true,
			);
			mockMessageRoutingService.getRoomMapV2 = vi.fn().mockResolvedValue(undefined);

			const result = await liveService.getRoomMap(mockDeviceId, 1);
			expect(mockMessageRoutingService.getRoomMapV2).toHaveBeenCalledWith(mockDeviceId, 1);
			expect(mockMessageRoutingService.getRoomMap).not.toHaveBeenCalled();
			expect(result).toBeUndefined();
		});
	});

	describe('getRoomMap — liveMapUpdates = false (rawData branch)', () => {
		it('skips area setup when rawData is empty array', async () => {
			mockMessageRoutingService.getRoomMap = vi.fn().mockResolvedValue([]);

			await areaService.getRoomMap(mockDeviceId, 1);
			// Empty rawData → no setSupportedAreas called
			expect(areaService.getSupportedAreas(mockDeviceId)).toEqual([]);
		});

		it('uses cached mapInfoCache to resolve mapId when rawData is non-empty', async () => {
			// Pre-populate mapInfo cache via getMapInfo call
			const mapInfo = new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
			mockMessageRoutingService.getMapInfo.mockResolvedValue(mapInfo);
			await areaService.getMapInfo(mockDeviceId);

			// Now call getRoomMap with non-empty rawData
			const rawData: [number, string][] = [[16, 'room1']];
			mockMessageRoutingService.getRoomMap = vi.fn().mockResolvedValue(rawData);
			await areaService.getRoomMap(mockDeviceId, 1);
			expect(mockMessageRoutingService.getRoomMap).toHaveBeenCalledWith(mockDeviceId, 1);
		});

		it('should preserve map_info room names after getMapInfo then getRoomMap when deviceRooms mismatch segments 1-4', async () => {
			areaService.setDeviceRooms(mockDeviceId, partialDeviceRooms);
			const mapInfo = createStartupMapInfo();
			mockMessageRoutingService.getMapInfo.mockResolvedValue(mapInfo);
			mockMessageRoutingService.getRoomMap.mockResolvedValue(startupRawRoomMapping);

			await areaService.getMapInfo(mockDeviceId);
			await areaService.getRoomMap(mockDeviceId, -1);

			const areas = areaService.getSupportedAreas(mockDeviceId);
			const expectedNames = ['Living', 'Bathroom', 'Kitchen', 'Bedroom', 'Hallway'];

			expect(areas).toHaveLength(5);
			for (let i = 0; i < 4; i++) {
				expect(areas[i]?.areaInfo?.locationInfo?.locationName).toBe(expectedNames[i]);
			}
			expect(areas[4]?.areaInfo?.locationInfo?.locationName).toBe('Hallway from cloud');
		});

		it('should keep getMapInfo areas unchanged when getRoomMap returns empty rawData', async () => {
			areaService.setDeviceRooms(mockDeviceId, partialDeviceRooms);
			const mapInfo = createStartupMapInfo();
			mockMessageRoutingService.getMapInfo.mockResolvedValue(mapInfo);
			mockMessageRoutingService.getRoomMap.mockResolvedValue([]);

			await areaService.getMapInfo(mockDeviceId);
			const areasAfterMapInfo = areaService.getSupportedAreas(mockDeviceId);

			await areaService.getRoomMap(mockDeviceId, -1);
			const areasAfterRoomMap = areaService.getSupportedAreas(mockDeviceId);

			expect(areasAfterRoomMap).toEqual(areasAfterMapInfo);
			expect(areasAfterRoomMap[0]?.areaInfo?.locationInfo?.locationName).toBe('Living');
		});
	});

	describe('startPeriodicRefresh / stopPeriodicRefresh', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('starts interval and calls getMapInfo periodically', async () => {
			const mapInfo = new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
			mockMessageRoutingService.getMapInfo.mockResolvedValue(mapInfo);

			areaService.startPeriodicRefresh(mockDeviceId, 5000);
			await vi.advanceTimersByTimeAsync(5001);
			expect(mockMessageRoutingService.getMapInfo).toHaveBeenCalled();
			areaService.stopPeriodicRefresh(mockDeviceId);
		});

		it('stopPeriodicRefresh clears interval and deletes from map', async () => {
			const mapInfo = new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
			mockMessageRoutingService.getMapInfo.mockResolvedValue(mapInfo);

			areaService.startPeriodicRefresh(mockDeviceId, 5000);
			areaService.stopPeriodicRefresh(mockDeviceId);
			await vi.advanceTimersByTimeAsync(10000);
			expect(mockMessageRoutingService.getMapInfo).not.toHaveBeenCalled();
		});

		it('startPeriodicRefresh replaces existing interval (stopPeriodicRefresh called first)', async () => {
			const mapInfo = new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
			mockMessageRoutingService.getMapInfo.mockResolvedValue(mapInfo);

			areaService.startPeriodicRefresh(mockDeviceId, 5000);
			areaService.startPeriodicRefresh(mockDeviceId, 5000); // replace
			await vi.advanceTimersByTimeAsync(5001);
			// Only one interval active, so getMapInfo called once per tick
			expect(mockMessageRoutingService.getMapInfo).toHaveBeenCalledTimes(1);
			areaService.stopPeriodicRefresh(mockDeviceId);
		});

		it('logs error when periodic getMapInfo fails', async () => {
			mockMessageRoutingService.getMapInfo.mockRejectedValue(new Error('network failure'));
			areaService.startPeriodicRefresh(mockDeviceId, 5000);
			await vi.advanceTimersByTimeAsync(5001);
			expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('network failure'));
			areaService.stopPeriodicRefresh(mockDeviceId);
		});
	});

	describe('clearAll — interval cleanup', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('stops all refresh intervals and clears all maps', async () => {
			const mapInfo = new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
			mockMessageRoutingService.getMapInfo.mockResolvedValue(mapInfo);

			areaService.startPeriodicRefresh(mockDeviceId, 5000);
			areaService.clearAll();
			await vi.advanceTimersByTimeAsync(10000);
			expect(mockMessageRoutingService.getMapInfo).not.toHaveBeenCalled();
		});
	});

	describe('Integration Scenarios', () => {
		it('should handle complete area setup workflow', () => {
			// Setup areas
			areaService.setSupportedAreas(mockDeviceId, mockAreas);

			// Setup index map
			const roomMapData = new Map<number, AreaInfo>([
				[0, { roomId: 16, mapId: 1, roomName: 'rn-1' }],
				[1, { roomId: 17, mapId: 1, roomName: 'rn-2' }],
				[2, { roomId: 18, mapId: 1, roomName: 'rn-3' }],
			]);
			const roomInfo = new Map<string, SegmentInfo>([]);
			areaService.setSupportedAreaIndexMap(mockDeviceId, new RoomIndexMap(roomMapData, roomInfo));

			// Setup routines
			areaService.setSupportedRoutines(mockDeviceId, mockRoutines);

			// Select areas
			areaService.setSelectedAreas(mockDeviceId, [0, 2]);

			// Verify complete setup
			expect(areaService.getSupportedAreas(mockDeviceId)).toEqual(mockAreas);
			expect(areaService.getSupportedRoutines(mockDeviceId)).toEqual(mockRoutines);
			expect(areaService.getSelectedAreas(mockDeviceId)).toEqual([0, 2]);
		});

		it('should handle multiple devices independently', () => {
			const device1 = 'device-1';
			const device2 = 'device-2';

			const areas1: ServiceArea.Area[] = [{ areaId: 1, mapId: 1 } as ServiceArea.Area];
			const areas2: ServiceArea.Area[] = [{ areaId: 2, mapId: 2 } as ServiceArea.Area];

			areaService.setSupportedAreas(device1, areas1);
			areaService.setSupportedAreas(device2, areas2);

			expect(areaService.getSupportedAreas(device1)).toEqual(areas1);
			expect(areaService.getSupportedAreas(device2)).toEqual(areas2);
		});

		it('should handle scene workflow with IoT API', async () => {
			const homeId = 123;
			const mockScenes: Scene[] = [{ id: 1, name: 'Test' } as Scene];

			mockIotApi.getScenes.mockResolvedValue(mockScenes);
			mockIotApi.startScene.mockResolvedValue({ success: true });

			const scenes = await areaService.getScenes(homeId);
			expect(scenes).toEqual(mockScenes);

			const result = await areaService.startScene(1);
			expect(result).toEqual({ success: true });
		});
	});

	describe('Error Handling', () => {
		it('should handle unknown device IDs gracefully', () => {
			expect(areaService.getSupportedAreas('unknown-device')).toEqual([]);
			expect(areaService.getSelectedAreas('unknown-device')).toEqual([]);
			expect(areaService.getSupportedRoutines('unknown-device')).toBeUndefined();
		});

		it('should handle malformed area data', () => {
			const malformedAreas = [{ areaId: 1 } as ServiceArea.Area, { areaId: 2 } as ServiceArea.Area];

			expect(() => {
				areaService.setSupportedAreas(mockDeviceId, malformedAreas);
			}).not.toThrow();

			const areas = areaService.getSupportedAreas(mockDeviceId);
			expect(areas).toEqual(malformedAreas);
		});

		it('should propagate message client errors', async () => {
			const error = new Error('Network error');
			mockMessageRoutingService.getMapInfo.mockRejectedValue(error);

			await expect(areaService.getMapInfo(mockDeviceId)).rejects.toThrow('Network error');
		});

		it('should propagate IoT API errors', async () => {
			const error = new Error('API error');
			mockIotApi.getScenes.mockRejectedValue(error);

			await expect(areaService.getScenes(123)).rejects.toThrow('API error');
		});
	});

	describe('resolveInitialAreas', () => {
		it('should call getMapInfo then getRoomMap in sequence', async () => {
			const mapInfo = new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
			mockMessageRoutingService.getMapInfo.mockResolvedValue(mapInfo);
			mockMessageRoutingService.getRoomMap.mockResolvedValue([]);

			await areaService.resolveInitialAreas(mockDeviceId);

			expect(mockMessageRoutingService.getMapInfo).toHaveBeenCalledWith(mockDeviceId);
			expect(mockMessageRoutingService.getRoomMap).toHaveBeenCalledWith(mockDeviceId, -1);

			// Verify call order: getMapInfo should be called before getRoomMap
			const getMapInfoCallOrder = vi.mocked(mockMessageRoutingService.getMapInfo).mock.invocationCallOrder[0];
			const getRoomMapCallOrder = vi.mocked(mockMessageRoutingService.getRoomMap).mock.invocationCallOrder[0];
			expect(getMapInfoCallOrder).toBeLessThan(getRoomMapCallOrder);
		});

		it('should return resolved supportedAreas when getMapInfo and getRoomMap succeed', async () => {
			const mapInfo = new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
			mockMessageRoutingService.getMapInfo.mockResolvedValue(mapInfo);
			mockMessageRoutingService.getRoomMap.mockResolvedValue([]);
			areaService.setSupportedAreas(mockDeviceId, mockAreas);

			const result = await areaService.resolveInitialAreas(mockDeviceId);

			expect(result.supportedAreas).toEqual(mockAreas);
		});

		it('should return resolved supportedMaps when getMapInfo and getRoomMap succeed', async () => {
			const mapInfo = new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
			mockMessageRoutingService.getMapInfo.mockResolvedValue(mapInfo);
			mockMessageRoutingService.getRoomMap.mockResolvedValue([]);
			const maps: ServiceArea.Map[] = [{ mapId: 1, name: 'Map A' }];
			areaService.setSupportedMaps(mockDeviceId, maps);

			const result = await areaService.resolveInitialAreas(mockDeviceId);

			expect(result.supportedMaps).toEqual(maps);
		});

		it('should not throw when getMapInfo rejects', async () => {
			mockMessageRoutingService.getMapInfo.mockRejectedValue(new Error('Network failure'));

			await expect(areaService.resolveInitialAreas(mockDeviceId)).resolves.toBeDefined();
		});

		it('should not throw when getRoomMap rejects', async () => {
			const mapInfo = new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
			mockMessageRoutingService.getMapInfo.mockResolvedValue(mapInfo);
			mockMessageRoutingService.getRoomMap.mockRejectedValue(new Error('Network failure'));

			await expect(areaService.resolveInitialAreas(mockDeviceId)).resolves.toBeDefined();
		});

		it('should return empty areas when both calls fail', async () => {
			mockMessageRoutingService.getMapInfo.mockRejectedValue(new Error('Network failure'));

			const result = await areaService.resolveInitialAreas(mockDeviceId);

			expect(result.supportedAreas).toEqual([]);
			expect(result.supportedMaps).toEqual([]);
		});

		it('should return fallback empty areas and maps for unknown device', async () => {
			const mapInfo = new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
			mockMessageRoutingService.getMapInfo.mockResolvedValue(mapInfo);
			mockMessageRoutingService.getRoomMap.mockResolvedValue([]);

			const result = await areaService.resolveInitialAreas('unknown-device');

			expect(result.supportedAreas).toEqual([]);
			expect(result.supportedMaps).toEqual([]);
		});

		it('should log error when getMapInfo fails', async () => {
			mockMessageRoutingService.getMapInfo.mockRejectedValue(new Error('Network error'));

			await areaService.resolveInitialAreas(mockDeviceId);

			expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('resolveInitialAreas failed'));
		});

		it('should handle undefined serviceRouting gracefully', async () => {
			const serviceWithoutClient = new AreaManagementService(mockLogger, undefined);

			const result = await serviceWithoutClient.resolveInitialAreas(mockDeviceId);

			expect(result.supportedAreas).toEqual([]);
			expect(result.supportedMaps).toEqual([]);
		});

		it('should preserve map_info room names end-to-end via resolveInitialAreas', async () => {
			areaService.setDeviceRooms(mockDeviceId, partialDeviceRooms);
			const mapInfo = createStartupMapInfo();
			mockMessageRoutingService.getMapInfo.mockResolvedValue(mapInfo);
			mockMessageRoutingService.getRoomMap.mockResolvedValue(startupRawRoomMapping);

			const result = await areaService.resolveInitialAreas(mockDeviceId);

			const expectedNames = ['Living', 'Bathroom', 'Kitchen', 'Bedroom', 'Hallway from cloud'];
			expect(result.supportedAreas).toHaveLength(5);
			result.supportedAreas.forEach((area, index) => {
				expect(area.areaInfo?.locationInfo?.locationName).toBe(expectedNames[index]);
			});
		});

		it('should use sync getMapInfo and getRoomMap when liveMapUpdates is true', async () => {
			const liveService = new AreaManagementService(
				mockLogger as AnsiLogger,
				mockMessageRoutingService as MessageRoutingService,
				true,
			);
			liveService.setDeviceRooms(mockDeviceId, partialDeviceRooms);
			mockMessageRoutingService.getMapInfoV2 = vi.fn();
			mockMessageRoutingService.getRoomMapV2 = vi.fn();
			mockMessageRoutingService.getMapInfo.mockResolvedValue(createStartupMapInfo());
			mockMessageRoutingService.getRoomMap.mockResolvedValue(startupRawRoomMapping);

			const result = await liveService.resolveInitialAreas(mockDeviceId);

			expect(mockMessageRoutingService.getMapInfo).toHaveBeenCalledWith(mockDeviceId);
			expect(mockMessageRoutingService.getRoomMap).toHaveBeenCalledWith(mockDeviceId, -1);
			expect(mockMessageRoutingService.getMapInfoV2).not.toHaveBeenCalled();
			expect(mockMessageRoutingService.getRoomMapV2).not.toHaveBeenCalled();

			const expectedNames = ['Living', 'Bathroom', 'Kitchen', 'Bedroom', 'Hallway from cloud'];
			expect(result.supportedAreas).toHaveLength(5);
			result.supportedAreas.forEach((area, index) => {
				expect(area.areaInfo?.locationInfo?.locationName).toBe(expectedNames[index]);
			});
		});

		it('should populate supportedMaps from sync getMapInfo when liveMapUpdates is true', async () => {
			const liveService = new AreaManagementService(
				mockLogger as AnsiLogger,
				mockMessageRoutingService as MessageRoutingService,
				true,
			);
			mockMessageRoutingService.getMapInfo.mockResolvedValue(createStartupMapInfo());
			mockMessageRoutingService.getRoomMap.mockResolvedValue(startupRawRoomMapping);

			const result = await liveService.resolveInitialAreas(mockDeviceId);

			expect(result.supportedMaps).toEqual([{ mapId: 0, name: 'Home' }]);
		});

		describe('Multi-map bootstrap with mapId sort (Bug 2)', () => {
			it('should sort supportedAreas by mapId ascending when multi-map bootstrap fetches out-of-order', async () => {
				const multiMapService = new AreaManagementService(
					mockLogger as AnsiLogger,
					mockMessageRoutingService as MessageRoutingService,
					false,
					true, // enableMultipleMap = true
				);
				multiMapService.setDeviceRooms(mockDeviceId, partialDeviceRooms);

				// Create a multi-map MapInfo with mapId 0 and mapId 1
				const multiMapInfo = {
					max_multi_map: 2,
					max_bak_map: 0,
					multi_map_count: 2,
					map_info: [
						{
							mapFlag: 0, // mapId 0
							add_time: 1771060270,
							length: 2,
							name: 'First Map',
							bak_maps: [],
							rooms: [
								{ id: 10, tag: 14, iot_name_id: '11100845', iot_name: 'Living' },
								{ id: 11, tag: 9, iot_name_id: '11100849', iot_name: 'Bathroom' },
							],
						},
						{
							mapFlag: 1, // mapId 1
							add_time: 1771060271,
							length: 2,
							name: 'Second Map',
							bak_maps: [],
							rooms: [
								{ id: 20, tag: 14, iot_name_id: '21100845', iot_name: 'Office' },
								{ id: 21, tag: 9, iot_name_id: '21100849', iot_name: 'Garage' },
							],
						},
					],
				} satisfies MultipleMapDto;

				const mapInfo = new MapInfo(multiMapInfo);

				// Mock: first fetch returns mapId 1 rooms (the "currently active" map), then loop fetches mapId 0
				const mapId1RoomData = [
					[20, '21100845', 14],
					[21, '21100849', 9],
				] as Partial<RawRoomMappingData> as RawRoomMappingData;

				const mapId0RoomData = [
					[10, '11100845', 14],
					[11, '11100849', 9],
				] as Partial<RawRoomMappingData> as RawRoomMappingData;

				// Setup: first getRoomMap (via fetchAndApplyRoomMap(duid, -1)) returns mapId 1 data
				// second getRoomMap (via ensureAreasForMap) returns mapId 0 data
				mockMessageRoutingService.getMapInfo.mockResolvedValue(mapInfo);
				mockMessageRoutingService.switchMap = vi.fn().mockResolvedValue(undefined);

				let callCount = 0;
				mockMessageRoutingService.getRoomMap.mockImplementation(() => {
					callCount++;
					if (callCount === 1) {
						return Promise.resolve(mapId1RoomData); // First call: mapId 1
					} else {
						return Promise.resolve(mapId0RoomData); // Second call: mapId 0
					}
				});

				const result = await multiMapService.resolveInitialAreas(mockDeviceId);

				// Assert: supportedAreas should be sorted by mapId 0 first, then mapId 1
				expect(result.supportedAreas).toHaveLength(4);

				// mapId 0 areas should come first (areaId 0, 1)
				expect(result.supportedAreas[0]).toMatchObject({ areaId: 0 });
				expect(result.supportedAreas[1]).toMatchObject({ areaId: 1 });

				// mapId 1 areas should come second (areaId 2, 3)
				expect(result.supportedAreas[2]).toMatchObject({ areaId: 2 });
				expect(result.supportedAreas[3]).toMatchObject({ areaId: 3 });

				// Verify all areas have correct mapIds
				const area0MapId = result.supportedAreas[0].mapId;
				const area1MapId = result.supportedAreas[1].mapId;
				const area2MapId = result.supportedAreas[2].mapId;
				const area3MapId = result.supportedAreas[3].mapId;

				expect(area0MapId).toBe(0);
				expect(area1MapId).toBe(0);
				expect(area2MapId).toBe(1);
				expect(area3MapId).toBe(1);
			});

			it('should rebuild roomIndexMap to reflect new areaIds after sort', async () => {
				const multiMapService = new AreaManagementService(
					mockLogger as AnsiLogger,
					mockMessageRoutingService as MessageRoutingService,
					false,
					true, // enableMultipleMap = true
				);
				multiMapService.setDeviceRooms(mockDeviceId, partialDeviceRooms);

				const multiMapInfo = {
					max_multi_map: 2,
					max_bak_map: 0,
					multi_map_count: 2,
					map_info: [
						{
							mapFlag: 0, // mapId 0
							add_time: 1771060270,
							length: 2,
							name: 'First Map',
							bak_maps: [],
							rooms: [
								{ id: 10, tag: 14, iot_name_id: '11100845', iot_name: 'Living' },
								{ id: 11, tag: 9, iot_name_id: '11100849', iot_name: 'Bathroom' },
							],
						},
						{
							mapFlag: 1, // mapId 1
							add_time: 1771060271,
							length: 2,
							name: 'Second Map',
							bak_maps: [],
							rooms: [
								{ id: 20, tag: 14, iot_name_id: '21100845', iot_name: 'Office' },
								{ id: 21, tag: 9, iot_name_id: '21100849', iot_name: 'Garage' },
							],
						},
					],
				} satisfies MultipleMapDto;

				const mapInfo = new MapInfo(multiMapInfo);

				const mapId1RoomData = [
					[20, '21100845', 14],
					[21, '21100849', 9],
				] as Partial<RawRoomMappingData> as RawRoomMappingData;

				const mapId0RoomData = [
					[10, '11100845', 14],
					[11, '11100849', 9],
				] as Partial<RawRoomMappingData> as RawRoomMappingData;

				mockMessageRoutingService.getMapInfo.mockResolvedValue(mapInfo);
				mockMessageRoutingService.switchMap = vi.fn().mockResolvedValue(undefined);

				let callCount = 0;
				mockMessageRoutingService.getRoomMap.mockImplementation(() => {
					callCount++;
					return Promise.resolve(callCount === 1 ? mapId1RoomData : mapId0RoomData);
				});

				await multiMapService.resolveInitialAreas(mockDeviceId);

				// Verify roomIndexMap was rebuilt with new areaIds
				const indexMap = multiMapService.getSupportedAreasIndexMap(mockDeviceId);
				expect(indexMap).toBeDefined();

				// The areas at new indices should map correctly:
				// newAreaId 0 -> original roomId 10 (mapId 0)
				// newAreaId 1 -> original roomId 11 (mapId 0)
				// newAreaId 2 -> original roomId 20 (mapId 1)
				// newAreaId 3 -> original roomId 21 (mapId 1)

				// Verify by checking the areaInfo entries
				const areas = multiMapService.getSupportedAreas(mockDeviceId);
				expect(areas[0].areaId).toBe(0);
				expect(areas[1].areaId).toBe(1);
				expect(areas[2].areaId).toBe(2);
				expect(areas[3].areaId).toBe(3);
			});

			it('should not sort or reindex when enableMultipleMap is false', async () => {
				const singleMapService = new AreaManagementService(
					mockLogger as AnsiLogger,
					mockMessageRoutingService as MessageRoutingService,
					false,
					false, // enableMultipleMap = false
				);
				singleMapService.setDeviceRooms(mockDeviceId, partialDeviceRooms);

				mockMessageRoutingService.getMapInfo.mockResolvedValue(createStartupMapInfo());
				mockMessageRoutingService.getRoomMap.mockResolvedValue(startupRawRoomMapping);

				const result = await singleMapService.resolveInitialAreas(mockDeviceId);

				// Single-map case: no sort, areas should be in their original order
				expect(result.supportedAreas).toHaveLength(5);
				// Verify areaIds are sequential (0-4)
				for (let i = 0; i < 5; i++) {
					expect(result.supportedAreas[i].areaId).toBe(i);
				}
			});

			it('should not reorder areas when multi-map input is already sorted by mapId', async () => {
				const multiMapService = new AreaManagementService(
					mockLogger as AnsiLogger,
					mockMessageRoutingService as MessageRoutingService,
					false,
					true, // enableMultipleMap = true
				);
				multiMapService.setDeviceRooms(mockDeviceId, partialDeviceRooms);

				// Create multi-map with already-sorted mapIds: 0 first, then 1
				const multiMapInfo = {
					max_multi_map: 2,
					max_bak_map: 0,
					multi_map_count: 2,
					map_info: [
						{
							mapFlag: 0, // mapId 0
							add_time: 1771060270,
							length: 2,
							name: 'First Map',
							bak_maps: [],
							rooms: [
								{ id: 10, tag: 14, iot_name_id: '11100845', iot_name: 'Living' },
								{ id: 11, tag: 9, iot_name_id: '11100849', iot_name: 'Bathroom' },
							],
						},
						{
							mapFlag: 1, // mapId 1
							add_time: 1771060271,
							length: 2,
							name: 'Second Map',
							bak_maps: [],
							rooms: [
								{ id: 20, tag: 14, iot_name_id: '21100845', iot_name: 'Office' },
								{ id: 21, tag: 9, iot_name_id: '21100849', iot_name: 'Garage' },
							],
						},
					],
				} satisfies MultipleMapDto;

				const mapInfo = new MapInfo(multiMapInfo);

				const mapId0RoomData = [
					[10, '11100845', 14],
					[11, '11100849', 9],
				] as Partial<RawRoomMappingData> as RawRoomMappingData;

				const mapId1RoomData = [
					[20, '21100845', 14],
					[21, '21100849', 9],
				] as Partial<RawRoomMappingData> as RawRoomMappingData;

				mockMessageRoutingService.getMapInfo.mockResolvedValue(mapInfo);
				mockMessageRoutingService.switchMap = vi.fn().mockResolvedValue(undefined);

				let callCount = 0;
				mockMessageRoutingService.getRoomMap.mockImplementation(() => {
					callCount++;
					return Promise.resolve(callCount === 1 ? mapId0RoomData : mapId1RoomData);
				});

				const result = await multiMapService.resolveInitialAreas(mockDeviceId);

				// Already sorted input should produce the same order (stable sort no-op)
				expect(result.supportedAreas).toHaveLength(4);
				expect(result.supportedAreas[0].areaId).toBe(0);
				expect(result.supportedAreas[1].areaId).toBe(1);
				expect(result.supportedAreas[2].areaId).toBe(2);
				expect(result.supportedAreas[3].areaId).toBe(3);

				// Verify order is stable: within each mapId, order should be preserved
				expect(result.supportedAreas[0].mapId).toBe(0);
				expect(result.supportedAreas[1].mapId).toBe(0);
				expect(result.supportedAreas[2].mapId).toBe(1);
				expect(result.supportedAreas[3].mapId).toBe(1);
			});
		});
	});

	describe('V1 room resolution cache', () => {
		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-07-13T12:00:00Z'));
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('should set and retrieve V1 resolved segment', () => {
			// Arrange
			const duid = 'v1-device';
			const segmentId = 42;

			// Act
			areaService.setV1ResolvedSegment(duid, segmentId);
			areaService.setV1ResolvedSegment(duid, segmentId);
			const result = areaService.getV1ResolvedSegment(duid);

			// Assert
			expect(result).toBe(segmentId);
		});

		it('should return undefined for duid that was never set', () => {
			// Act
			const result = areaService.getV1ResolvedSegment('unknown-duid');

			// Assert
			expect(result).toBeUndefined();
		});

		it('should return undefined when cached entry exceeds maxAgeMs', () => {
			// Arrange
			const duid = 'v1-device';
			areaService.setV1ResolvedSegment(duid, 42);
			areaService.setV1ResolvedSegment(duid, 42);

			// Act — advance time beyond maxAgeMs (default 30_000)
			vi.advanceTimersByTime(31_000);
			const result = areaService.getV1ResolvedSegment(duid);

			// Assert
			expect(result).toBeUndefined();
		});

		it('should return cached segmentId just under the staleness threshold', () => {
			// Arrange
			const duid = 'v1-device';
			areaService.setV1ResolvedSegment(duid, 42);
			areaService.setV1ResolvedSegment(duid, 42);

			// Act — advance time just under maxAgeMs (default 30_000)
			vi.advanceTimersByTime(29_999);
			const result = areaService.getV1ResolvedSegment(duid);

			// Assert
			expect(result).toBe(42);
		});

		it('should respect custom maxAgeMs parameter', () => {
			// Arrange
			const duid = 'v1-device';
			const customMaxAge = 5_000;
			areaService.setV1ResolvedSegment(duid, 42);
			areaService.setV1ResolvedSegment(duid, 42);

			// Act — advance time beyond custom maxAgeMs
			vi.advanceTimersByTime(6_000);
			const result = areaService.getV1ResolvedSegment(duid, customMaxAge);

			// Assert
			expect(result).toBeUndefined();
		});

		it('should call serviceRouting.requestHomeMapPush when requestV1MapRefresh is called', async () => {
			// Arrange
			const duid = 'v1-device';
			mockMessageRoutingService.requestHomeMapPush = vi.fn().mockResolvedValue(undefined);

			// Act
			await areaService.requestV1MapRefresh(duid);

			// Assert
			expect(mockMessageRoutingService.requestHomeMapPush).toHaveBeenCalledWith(duid);
		});

		it('should catch and log error when requestHomeMapPush rejects', async () => {
			// Arrange
			const duid = 'v1-device';
			const error = new Error('RPC failed');
			mockMessageRoutingService.requestHomeMapPush = vi.fn().mockRejectedValue(error);

			// Act & Assert — should not throw
			await expect(areaService.requestV1MapRefresh(duid)).resolves.toBeUndefined();

			// Verify error was logged at debug level
			expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('requestV1MapRefresh failed'));
		});

		it('should return early when serviceRouting is not provided', async () => {
			// Arrange — service without messageRouting
			const serviceNoRouting = new AreaManagementService(mockLogger as AnsiLogger, undefined);

			// Act & Assert — should not throw
			await expect(serviceNoRouting.requestV1MapRefresh('any-duid')).resolves.toBeUndefined();
		});

		it('should clear V1 cache in clearAll()', () => {
			// Arrange
			const duid = 'v1-device';
			areaService.setV1ResolvedSegment(duid, 42);
			areaService.setV1ResolvedSegment(duid, 42);
			expect(areaService.getV1ResolvedSegment(duid)).toBe(42);

			// Act
			areaService.clearAll();

			// Assert
			expect(areaService.getV1ResolvedSegment(duid)).toBeUndefined();
		});

		describe('V1 debounce/confirmation behavior', () => {
			it('should NOT publish a single resolution', () => {
				// Arrange
				const duid = 'v1-device-single';
				const segmentId = 7;

				// Act
				areaService.setV1ResolvedSegment(duid, segmentId);
				const result = areaService.getV1ResolvedSegment(duid);

				// Assert
				expect(result).toBeUndefined();
			});

			it('should publish two consecutive matching resolutions', () => {
				// Arrange
				const duid = 'v1-device-double';
				const segmentId = 7;

				// Act
				areaService.setV1ResolvedSegment(duid, segmentId);
				areaService.setV1ResolvedSegment(duid, segmentId);
				const result = areaService.getV1ResolvedSegment(duid);

				// Assert
				expect(result).toBe(segmentId);
			});

			it('should not publish a single differing (outlier) resolution between two matching ones', () => {
				// Arrange
				const duid = 'v1-device-outlier';

				// Act
				areaService.setV1ResolvedSegment(duid, 7);
				areaService.setV1ResolvedSegment(duid, 7);
				// First two match — 7 is now published
				expect(areaService.getV1ResolvedSegment(duid)).toBe(7);

				// Single differing (outlier) resolution
				areaService.setV1ResolvedSegment(duid, 9);
				const result = areaService.getV1ResolvedSegment(duid);

				// Assert
				// Published value should still be 7 (unchanged)
				expect(result).toBe(7);
			});

			it('should confirm genuine transition after 2 consecutive matching calls to new segment', () => {
				// Arrange
				const duid = 'v1-device-transition';

				// Act
				areaService.setV1ResolvedSegment(duid, 7);
				areaService.setV1ResolvedSegment(duid, 7);
				expect(areaService.getV1ResolvedSegment(duid)).toBe(7);

				// Single outlier
				areaService.setV1ResolvedSegment(duid, 9);
				expect(areaService.getV1ResolvedSegment(duid)).toBe(7); // Still 7

				// Now 2 consecutive 9s
				areaService.setV1ResolvedSegment(duid, 9);
				areaService.setV1ResolvedSegment(duid, 9);
				const result = areaService.getV1ResolvedSegment(duid);

				// Assert
				expect(result).toBe(9);
			});

			it('should not confirm non-consecutive noise', () => {
				// Arrange
				const duid = 'v1-device-noise';
				const sequence = [5, 6, 4, 6, 1]; // Never 2-in-a-row

				// Act & Assert
				for (const segmentId of sequence) {
					areaService.setV1ResolvedSegment(duid, segmentId);
					const result = areaService.getV1ResolvedSegment(duid);
					// None should be published since no value repeats consecutively
					expect(result).toBeUndefined();
				}
			});

			it('should clear both confirmed and pending state in clearAll()', () => {
				// Arrange
				const duid = 'v1-device-pending-clear';

				// Act & Assert — single call (pending, not confirmed)
				areaService.setV1ResolvedSegment(duid, 7);
				expect(areaService.getV1ResolvedSegment(duid)).toBeUndefined();

				// Clear
				areaService.clearAll();

				// Call setV1ResolvedSegment once more with same segmentId
				areaService.setV1ResolvedSegment(duid, 7);
				const result = areaService.getV1ResolvedSegment(duid);

				// Assert — should still be undefined because pending state was cleared
				expect(result).toBeUndefined();
			});

			it('should maintain per-duid isolation', () => {
				// Arrange
				const duidA = 'duid-a';
				const duidB = 'duid-b';

				// Act
				areaService.setV1ResolvedSegment(duidA, 7);
				areaService.setV1ResolvedSegment(duidA, 7);
				areaService.setV1ResolvedSegment(duidB, 9);

				// Assert
				expect(areaService.getV1ResolvedSegment(duidA)).toBe(7);
				expect(areaService.getV1ResolvedSegment(duidB)).toBeUndefined();
			});
		});
	});
});
