import { RvcOperationalState, ServiceArea } from 'matterbridge/matter/clusters';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { INVALID_SEGMENT_ID } from '../../../constants/index.js';
import { RoomIndexMap } from '../../../core/application/models/index.js';
import { HomeEntity } from '../../../core/domain/entities/Home.js';
import { AreaInfo, SegmentInfo } from '../../../initialData/getSupportedAreas.js';
import { RoborockMatterbridgePlatform } from '../../../module.js';
import { PlatformConfigManager } from '../../../platform/platformConfigManager.js';
import { OperationStatusCode, ProtocolVersion } from '../../../roborockCommunication/enums/index.js';
import { CleanInformation, Device } from '../../../roborockCommunication/models/index.js';
import {
	buildProgressUpdate,
	getNextPendingArea,
	handleActiveMapChanged,
	handleServiceAreaUpdate,
	markAreaSkipped,
} from '../../../runtimes/handlers/serviceAreaHandler.js';
import { RoborockService } from '../../../services/roborockService.js';
import type { ServiceAreaUpdateMessage } from '../../../types/MessagePayloads.js';
import { RoborockVacuumCleaner } from '../../../types/roborockVacuumCleaner.js';
import { asPartial, createMockLogger } from '../../helpers/testUtils.js';

function createMockConfigManager(estimatedEndTimeEnabled = false): PlatformConfigManager {
	return asPartial<PlatformConfigManager>({
		isEstimatedEndTimeEnabled: estimatedEndTimeEnabled,
	});
}

function createMockPlatform(
	areas: ServiceArea.Area[] = [],
	indexMap?: RoomIndexMap,
	estimatedEndTimeEnabled = false,
): RoborockMatterbridgePlatform {
	return asPartial<RoborockMatterbridgePlatform>({
		log: createMockLogger(),
		configManager: createMockConfigManager(estimatedEndTimeEnabled),
		roborockService: asPartial<RoborockService>({
			getSupportedAreas: vi.fn().mockReturnValue(areas),
			getSupportedAreasIndexMap: vi.fn().mockReturnValue(indexMap),
			getSelectedAreas: vi.fn().mockReturnValue([]),
			getProgress: vi.fn().mockReturnValue([]),
			setProgress: vi.fn(),
			ensureAreasForMap: vi.fn().mockResolvedValue(false),
		}),
	});
}

function createRoomIndexMapForSegment(segmentId: number, areaId: number, mapId = 100): RoomIndexMap {
	const roomMapData = new Map<number, AreaInfo>([[areaId, { roomId: segmentId, mapId, roomName: `Room ${areaId}` }]]);
	const roomInfo = new Map<string, SegmentInfo>([
		[`${segmentId}-${mapId}`, { areaId, mapId, roomName: `Room ${areaId}` }],
	]);
	return new RoomIndexMap(roomMapData, roomInfo);
}

function createMockRobot(
	duid: string,
	activeMapId = 0,
	matterSupportedAreas?: ServiceArea.Area[],
	operationalState?: RvcOperationalState.OperationalState,
): RoborockVacuumCleaner {
	return asPartial<RoborockVacuumCleaner>({
		device: asPartial<Device>({ duid }),
		homeInFo: asPartial<HomeEntity>({ activeMapId }),
		updateAttribute: vi.fn().mockResolvedValue(undefined),
		getAttribute: vi.fn().mockImplementation((_clusterId, attrName) => {
			if (attrName === 'supportedAreas') {
				return matterSupportedAreas;
			}
			if (attrName === 'operationalState') {
				return operationalState;
			}
			return undefined;
		}),
	});
}

describe('handleActiveMapChanged', () => {
	let robot: RoborockVacuumCleaner;

	beforeEach(() => {
		vi.clearAllMocks();
		robot = createMockRobot('test-duid', 100);
	});

	it('does nothing when no areas found for mapId', async () => {
		const platform = createMockPlatform([]); // no areas
		await handleActiveMapChanged(robot, 100, platform);
		expect(robot.updateAttribute).not.toHaveBeenCalled();
	});

	it('sets selectedAreas to all area IDs on the active map', async () => {
		const areas: ServiceArea.Area[] = [
			{ areaId: 1, mapId: 100 } as ServiceArea.Area,
			{ areaId: 2, mapId: 100 } as ServiceArea.Area,
			{ areaId: 3, mapId: 999 } as ServiceArea.Area, // different map
		];
		robot = createMockRobot('test-duid', 100, [
			{ areaId: 1, mapId: 100 } as ServiceArea.Area,
			{ areaId: 2, mapId: 100 } as ServiceArea.Area,
		]);
		const platform = createMockPlatform(areas);
		await handleActiveMapChanged(robot, 100, platform);

		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'selectedAreas', [1, 2], expect.anything());
	});

	it('sets currentArea to null', async () => {
		const areas: ServiceArea.Area[] = [{ areaId: 5, mapId: 100 } as ServiceArea.Area];
		robot = createMockRobot('test-duid', 100, [{ areaId: 5, mapId: 100 } as ServiceArea.Area]);
		const platform = createMockPlatform(areas);
		await handleActiveMapChanged(robot, 100, platform);

		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', null, expect.anything());
	});

	it('should clear estimatedEndTime to null on map change', async () => {
		const areas: ServiceArea.Area[] = [{ areaId: 5, mapId: 100 } as ServiceArea.Area];
		robot = createMockRobot('test-duid', 100, [{ areaId: 5, mapId: 100 } as ServiceArea.Area]);
		const platform = createMockPlatform(areas);
		await handleActiveMapChanged(robot, 100, platform);

		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'estimatedEndTime', null, expect.anything());
	});

	it('resets progress to empty array on map change', async () => {
		const areas: ServiceArea.Area[] = [
			{ areaId: 1, mapId: 100 } as ServiceArea.Area,
			{ areaId: 2, mapId: 100 } as ServiceArea.Area,
		];
		robot = createMockRobot('test-duid', 100, [
			{ areaId: 1, mapId: 100 } as ServiceArea.Area,
			{ areaId: 2, mapId: 100 } as ServiceArea.Area,
		]);
		const platform = createMockPlatform(areas);
		await handleActiveMapChanged(robot, 100, platform);

		expect(platform.roborockService?.setProgress).toHaveBeenCalledWith(robot.device.duid, []);
		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'progress', [], expect.anything());
	});

	it('should skip selectedAreas when Matter supportedAreas is routines-only', async () => {
		const areas: ServiceArea.Area[] = [
			{ areaId: 0, mapId: 0 } as ServiceArea.Area,
			{ areaId: 1, mapId: 0 } as ServiceArea.Area,
			{ areaId: 2, mapId: 0 } as ServiceArea.Area,
			{ areaId: 3, mapId: 0 } as ServiceArea.Area,
		];
		robot = createMockRobot('test-duid', 0, [{ areaId: 100, mapId: 999 } as ServiceArea.Area]);
		const platform = createMockPlatform(areas);
		await handleActiveMapChanged(robot, 0, platform);

		expect(robot.updateAttribute).not.toHaveBeenCalledWith(
			ServiceArea.id,
			'selectedAreas',
			expect.anything(),
			expect.anything(),
		);
	});

	it('should set selectedAreas when Matter supportedAreas contains matching IDs', async () => {
		const areas: ServiceArea.Area[] = [
			{ areaId: 0, mapId: 0 } as ServiceArea.Area,
			{ areaId: 1, mapId: 0 } as ServiceArea.Area,
			{ areaId: 2, mapId: 0 } as ServiceArea.Area,
			{ areaId: 3, mapId: 0 } as ServiceArea.Area,
		];
		robot = createMockRobot('test-duid', 0, areas);
		const platform = createMockPlatform(areas);
		await handleActiveMapChanged(robot, 0, platform);

		expect(robot.updateAttribute).toHaveBeenCalledWith(
			ServiceArea.id,
			'selectedAreas',
			[0, 1, 2, 3],
			expect.anything(),
		);
	});

	it('handles empty roborockService (no supportedAreas)', async () => {
		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(),
			roborockService: undefined,
		});
		await expect(handleActiveMapChanged(robot, 100, platform)).resolves.toBeUndefined();
		expect(robot.updateAttribute).not.toHaveBeenCalled();
	});
});

describe('handleServiceAreaUpdate with progress', () => {
	let robot: RoborockVacuumCleaner;

	beforeEach(() => {
		vi.clearAllMocks();
		robot = createMockRobot('test-duid-progress', 100);
	});

	it('should clear progress when state is Idle with Operating area', async () => {
		const selectedAreas = [1, 2];
		const initialProgress: ServiceArea.Progress[] = [
			{ areaId: 1, status: ServiceArea.OperationalStatus.Pending },
			{ areaId: 2, status: ServiceArea.OperationalStatus.Operating },
		];

		const mockRoborockService = asPartial<RoborockService>({
			getSelectedAreas: vi.fn().mockReturnValue(selectedAreas),
			getProgress: vi.fn().mockReturnValue(initialProgress),
			setProgress: vi.fn(),
		});

		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(),
			roborockService: mockRoborockService,
		});

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-progress',
			state: OperationStatusCode.Idle,
			cleaningInfo: undefined,
			cleaningProcess: { clean_area: 0, clean_time: 0 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		expect(mockRoborockService?.setProgress).toHaveBeenCalledWith(robot.device.duid, []);
		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'progress', [], expect.anything());
	});

	it('should initialize progress when cleaning starts with single selected area', async () => {
		const selectedAreas = [5];
		const mockRoborockService = asPartial<RoborockService>({
			getSelectedAreas: vi.fn().mockReturnValue(selectedAreas),
			getProgress: vi.fn().mockReturnValue([]),
			setProgress: vi.fn(),
		});

		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(),
			roborockService: mockRoborockService,
		});

		vi.mocked(robot.getAttribute).mockReturnValue(selectedAreas);

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-progress',
			state: OperationStatusCode.Cleaning,
			cleaningInfo: undefined,
			cleaningProcess: { clean_area: 100, clean_time: 50 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		// Verify progress was set with Operating status for the single area
		expect(mockRoborockService?.setProgress).toHaveBeenCalledWith(
			robot.device.duid,
			expect.arrayContaining([
				expect.objectContaining({
					areaId: 5,
					status: ServiceArea.OperationalStatus.Operating,
				}),
			]),
		);

		expect(robot.updateAttribute).toHaveBeenCalledWith(
			ServiceArea.id,
			'progress',
			expect.arrayContaining([
				expect.objectContaining({
					areaId: 5,
					status: ServiceArea.OperationalStatus.Operating,
				}),
			]),
			expect.anything(),
		);
	});

	it('should handle progress when no prior progress exists on clean start', async () => {
		const selectedAreas = [10];
		const mockRoborockService = asPartial<RoborockService>({
			getSelectedAreas: vi.fn().mockReturnValue(selectedAreas),
			getProgress: vi.fn().mockReturnValue([]),
			setProgress: vi.fn(),
		});

		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(),
			roborockService: mockRoborockService,
		});

		vi.mocked(robot.getAttribute).mockReturnValue(selectedAreas);

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-progress',
			state: OperationStatusCode.RoomClean,
			cleaningInfo: undefined,
			cleaningProcess: { clean_area: 50, clean_time: 30 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		// With empty prior progress, should initialize with Pending and set to Operating
		const setProgressCall = vi.mocked(mockRoborockService?.setProgress).mock.calls[0];
		expect(setProgressCall).toBeDefined();
		// estimatedTime is null because estimatedEndTimeEnabled is false in createMockConfigManager()
		expect(setProgressCall[1]).toEqual([
			{ areaId: 10, status: ServiceArea.OperationalStatus.Operating, estimatedTime: null },
		]);
	});

	it('should clear progress when state is Idle without Operating areas', async () => {
		const selectedAreas = [1, 2];
		const initialProgress: ServiceArea.Progress[] = [
			{ areaId: 1, status: ServiceArea.OperationalStatus.Pending },
			{ areaId: 2, status: ServiceArea.OperationalStatus.Pending },
		];

		const mockRoborockService = asPartial<RoborockService>({
			getSelectedAreas: vi.fn().mockReturnValue(selectedAreas),
			getProgress: vi.fn().mockReturnValue(initialProgress),
			setProgress: vi.fn(),
		});

		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(),
			roborockService: mockRoborockService,
		});

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-progress',
			state: OperationStatusCode.Idle,
			cleaningInfo: undefined,
			cleaningProcess: { clean_area: 0, clean_time: 0 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		expect(mockRoborockService?.setProgress).toHaveBeenCalledWith(robot.device.duid, []);
		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'progress', [], expect.anything());
	});

	it('should not update progress when cleaning_info is undefined and clean_area is 0', async () => {
		const selectedAreas = [1];
		const mockRoborockService = asPartial<RoborockService>({
			getSelectedAreas: vi.fn().mockReturnValue(selectedAreas),
			getProgress: vi.fn().mockReturnValue([]),
			setProgress: vi.fn(),
		});

		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(),
			roborockService: mockRoborockService,
		});

		vi.mocked(robot.getAttribute).mockReturnValue(selectedAreas);

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-progress',
			state: OperationStatusCode.Cleaning,
			cleaningInfo: undefined,
			cleaningProcess: { clean_area: 0, clean_time: 0 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		// Progress should not be set when clean hasn't started (clean_area === 0)
		expect(mockRoborockService?.setProgress).not.toHaveBeenCalled();
	});
});

describe('handleServiceAreaUpdate idle clears currentArea', () => {
	let robot: RoborockVacuumCleaner;

	beforeEach(() => {
		vi.clearAllMocks();
		robot = createMockRobot('test-duid-idle-clear', 100);
	});

	it('should clear currentArea and estimatedEndTime when state is Idle', async () => {
		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(),
			roborockService: asPartial<RoborockService>({
				getSelectedAreas: vi.fn().mockReturnValue([1]),
				getProgress: vi.fn().mockReturnValue([]),
				setProgress: vi.fn(),
			}),
		});

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-idle-clear',
			state: OperationStatusCode.Idle,
			cleaningInfo: undefined,
			cleaningProcess: { clean_area: 0, clean_time: 0 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', null, expect.anything());
		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'estimatedEndTime', null, expect.anything());
	});
});

describe('handleServiceAreaUpdate multi-room without cleaning_info', () => {
	let robot: RoborockVacuumCleaner;

	beforeEach(() => {
		vi.clearAllMocks();
		robot = createMockRobot('test-duid-multi', 100);
	});

	it('should keep selectedAreas and set currentArea to first selected when clean_time > 0', async () => {
		const selectedAreas = [10, 20];
		const mockRoborockService = asPartial<RoborockService>({
			getSelectedAreas: vi.fn().mockReturnValue(selectedAreas),
			getProgress: vi.fn().mockReturnValue([]),
			setProgress: vi.fn(),
		});
		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(),
			roborockService: mockRoborockService,
		});

		vi.mocked(robot.getAttribute).mockReturnValue(selectedAreas);

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-multi',
			state: OperationStatusCode.Cleaning,
			cleaningInfo: undefined,
			cleaningProcess: { clean_area: 100, clean_time: 50 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		expect(robot.updateAttribute).toHaveBeenCalledWith(
			ServiceArea.id,
			'selectedAreas',
			selectedAreas,
			expect.anything(),
		);
		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', 10, expect.anything());
	});
});

describe('markAreaSkipped and getNextPendingArea', () => {
	it('should mark skipped area Skipped and advance next pending area to Operating', () => {
		const selectedAreas = [1, 2, 3];
		const progress: ServiceArea.Progress[] = [
			{ areaId: 1, status: ServiceArea.OperationalStatus.Completed },
			{ areaId: 2, status: ServiceArea.OperationalStatus.Operating },
			{ areaId: 3, status: ServiceArea.OperationalStatus.Pending },
		];

		const nextAreaId = getNextPendingArea(selectedAreas, progress, 2);
		const updated = markAreaSkipped(progress, selectedAreas, 2, nextAreaId);

		expect(nextAreaId).toBe(3);
		expect(updated).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ areaId: 2, status: ServiceArea.OperationalStatus.Skipped }),
				expect.objectContaining({ areaId: 3, status: ServiceArea.OperationalStatus.Operating }),
			]),
		);
	});
});

describe('resolveAreaFromCleaningInfo — progress updates with area resolution', () => {
	let robot: RoborockVacuumCleaner;

	beforeEach(() => {
		vi.clearAllMocks();
		robot = createMockRobot('test-duid-resolve', 100);
	});

	it('should transition area from Pending to Operating when cleaningInfo resolves a new area', async () => {
		const selectedAreas = [1, 2];
		const initialProgress: ServiceArea.Progress[] = [
			{ areaId: 1, status: ServiceArea.OperationalStatus.Pending },
			{ areaId: 2, status: ServiceArea.OperationalStatus.Pending },
		];

		const roomMapData = new Map<number, AreaInfo>([
			[1, { roomId: 10, mapId: 100, roomName: 'Room 1' }],
			[2, { roomId: 20, mapId: 100, roomName: 'Room 2' }],
		]);
		const roomInfo = new Map<string, SegmentInfo>([
			['10-100', { areaId: 1, mapId: 100, roomName: 'Room 1' }],
			['20-100', { areaId: 2, mapId: 100, roomName: 'Room 2' }],
		]);
		const indexMap = new RoomIndexMap(roomMapData, roomInfo);

		const mockRoborockService = asPartial<RoborockService>({
			getSupportedAreas: vi.fn().mockReturnValue([]),
			getSupportedAreasIndexMap: vi.fn().mockReturnValue(indexMap),
			getSelectedAreas: vi.fn().mockReturnValue(selectedAreas),
			getProgress: vi.fn().mockReturnValue(initialProgress),
			setProgress: vi.fn(),
		});

		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(),
			roborockService: mockRoborockService,
		});

		vi.mocked(robot.getAttribute).mockReturnValue(selectedAreas);

		const cleaningInfo: CleanInformation = {
			segment_id: 10,
			target_segment_id: INVALID_SEGMENT_ID,
			fan_power: 0,
			water_box_status: 0,
			mop_mode: 0,
		};

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-resolve',
			state: OperationStatusCode.RoomClean,
			cleaningInfo,
			cleaningProcess: { clean_area: 100, clean_time: 60 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		// Verify area 1 transitioned to Operating
		expect(mockRoborockService?.setProgress).toHaveBeenCalledWith(
			robot.device.duid,
			expect.arrayContaining([
				expect.objectContaining({
					areaId: 1,
					status: ServiceArea.OperationalStatus.Operating,
				}),
			]),
		);
	});

	it('should mark previous Operating area as Completed when new area becomes Operating', async () => {
		const selectedAreas = [1, 2];
		const initialProgress: ServiceArea.Progress[] = [
			{ areaId: 1, status: ServiceArea.OperationalStatus.Operating },
			{ areaId: 2, status: ServiceArea.OperationalStatus.Pending },
		];

		const roomMapData = new Map<number, AreaInfo>([
			[1, { roomId: 10, mapId: 100, roomName: 'Room 1' }],
			[2, { roomId: 20, mapId: 100, roomName: 'Room 2' }],
		]);
		const roomInfo = new Map<string, SegmentInfo>([
			['10-100', { areaId: 1, mapId: 100, roomName: 'Room 1' }],
			['20-100', { areaId: 2, mapId: 100, roomName: 'Room 2' }],
		]);
		const indexMap = new RoomIndexMap(roomMapData, roomInfo);

		const mockRoborockService = asPartial<RoborockService>({
			getSupportedAreas: vi.fn().mockReturnValue([]),
			getSupportedAreasIndexMap: vi.fn().mockReturnValue(indexMap),
			getSelectedAreas: vi.fn().mockReturnValue(selectedAreas),
			getProgress: vi.fn().mockReturnValue(initialProgress),
			setProgress: vi.fn(),
		});

		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(),
			roborockService: mockRoborockService,
		});

		vi.mocked(robot.getAttribute).mockReturnValue(selectedAreas);

		const cleaningInfo: CleanInformation = {
			segment_id: 20,
			target_segment_id: INVALID_SEGMENT_ID,
			fan_power: 0,
			water_box_status: 0,
			mop_mode: 0,
		};

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-resolve',
			state: OperationStatusCode.RoomClean,
			cleaningInfo,
			cleaningProcess: { clean_area: 100, clean_time: 60 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		// Verify area 1 → Completed and area 2 → Operating
		expect(mockRoborockService?.setProgress).toHaveBeenCalledWith(
			robot.device.duid,
			expect.arrayContaining([
				expect.objectContaining({ areaId: 1, status: ServiceArea.OperationalStatus.Completed }),
				expect.objectContaining({ areaId: 2, status: ServiceArea.OperationalStatus.Operating }),
			]),
		);
	});

	it('should not update progress when cleaningInfo resolves to null mappedArea', async () => {
		const selectedAreas = [1];
		const roomMapData = new Map<number, AreaInfo>([[10, { roomId: 10, mapId: 100, roomName: 'Room 1' }]]);
		const roomInfo = new Map<string, SegmentInfo>([]);
		const indexMap = new RoomIndexMap(roomMapData, roomInfo);
		// No mapping for segment 99

		const mockRoborockService = asPartial<RoborockService>({
			getSupportedAreas: vi.fn().mockReturnValue([]),
			getSupportedAreasIndexMap: vi.fn().mockReturnValue(indexMap),
			getSelectedAreas: vi.fn().mockReturnValue(selectedAreas),
			getProgress: vi.fn().mockReturnValue([]),
			setProgress: vi.fn(),
		});

		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(),
			roborockService: mockRoborockService,
		});

		vi.mocked(robot.getAttribute).mockReturnValue(selectedAreas);

		const cleaningInfo: CleanInformation = {
			segment_id: 99,
			target_segment_id: INVALID_SEGMENT_ID,
			fan_power: 0,
			water_box_status: 0,
			mop_mode: 0,
		};

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-resolve',
			state: OperationStatusCode.RoomClean,
			cleaningInfo,
			cleaningProcess: { clean_area: 100, clean_time: 60 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		// Progress should not be set when mapped area is not found
		expect(mockRoborockService?.setProgress).not.toHaveBeenCalled();
	});
});

describe('handleServiceAreaUpdate estimatedEndTime', () => {
	let robot: RoborockVacuumCleaner;

	beforeEach(() => {
		vi.clearAllMocks();
		robot = createMockRobot('test-duid-eta', 100);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function createResolvePlatform(
		indexMap: RoomIndexMap,
		estimatedEndTimeEnabled: boolean,
		selectedAreas: number[] = [1],
	): RoborockMatterbridgePlatform {
		const mockRoborockService = asPartial<RoborockService>({
			getSupportedAreas: vi.fn().mockReturnValue([]),
			getSupportedAreasIndexMap: vi.fn().mockReturnValue(indexMap),
			getSelectedAreas: vi.fn().mockReturnValue(selectedAreas),
			getProgress: vi.fn().mockReturnValue([]),
			setProgress: vi.fn(),
		});

		return asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(estimatedEndTimeEnabled),
			roborockService: mockRoborockService,
		});
	}

	it('should publish null estimatedEndTime when config is disabled', async () => {
		const indexMap = createRoomIndexMapForSegment(10, 1);
		const platform = createResolvePlatform(indexMap, false);
		vi.mocked(robot.getAttribute).mockReturnValue([1]);

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-eta',
			state: OperationStatusCode.RoomClean,
			cleaningInfo: {
				segment_id: 10,
				target_segment_id: INVALID_SEGMENT_ID,
				fan_power: 0,
				water_box_status: 0,
				mop_mode: 0,
			},
			cleaningProcess: { clean_area: 100, clean_time: 60, clean_percent: 25 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', 1, expect.anything());
		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'estimatedEndTime', null, expect.anything());
	});

	it('should publish computed estimatedEndTime via resolveAreaFromCleaningInfo when config is enabled', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2020-01-01T00:00:00Z'));
		const expectedNow = Math.floor(Date.now() / 1000);

		const indexMap = createRoomIndexMapForSegment(10, 1);
		const platform = createResolvePlatform(indexMap, true);
		vi.mocked(robot.getAttribute).mockReturnValue([1]);

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-eta',
			state: OperationStatusCode.RoomClean,
			cleaningInfo: {
				segment_id: 10,
				target_segment_id: INVALID_SEGMENT_ID,
				fan_power: 0,
				water_box_status: 0,
				mop_mode: 0,
			},
			cleaningProcess: { clean_area: 100, clean_time: 60, clean_percent: 25 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', 1, expect.anything());
		expect(robot.updateAttribute).toHaveBeenCalledWith(
			ServiceArea.id,
			'estimatedEndTime',
			expectedNow + 180,
			expect.anything(),
		);
	});

	it('should publish computed estimatedEndTime via handleCleaningWithoutInfo for multi-room', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2020-01-01T00:00:00Z'));
		const expectedNow = Math.floor(Date.now() / 1000);

		const selectedAreas = [10, 20];
		const mockRoborockService = asPartial<RoborockService>({
			getSelectedAreas: vi.fn().mockReturnValue(selectedAreas),
			getProgress: vi.fn().mockReturnValue([]),
			setProgress: vi.fn(),
		});
		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(true),
			roborockService: mockRoborockService,
		});
		vi.mocked(robot.getAttribute).mockReturnValue(selectedAreas);

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-eta',
			state: OperationStatusCode.Cleaning,
			cleaningInfo: undefined,
			cleaningProcess: { clean_area: 100, clean_time: 60, clean_percent: 25 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', 10, expect.anything());
		expect(robot.updateAttribute).toHaveBeenCalledWith(
			ServiceArea.id,
			'estimatedEndTime',
			expectedNow + 180,
			expect.anything(),
		);
	});

	it('should publish null estimatedEndTime when clean_percent is 0', async () => {
		const indexMap = createRoomIndexMapForSegment(10, 1);
		const platform = createResolvePlatform(indexMap, true);
		vi.mocked(robot.getAttribute).mockReturnValue([1]);

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-eta',
			state: OperationStatusCode.RoomClean,
			cleaningInfo: {
				segment_id: 10,
				target_segment_id: INVALID_SEGMENT_ID,
				fan_power: 0,
				water_box_status: 0,
				mop_mode: 0,
			},
			cleaningProcess: { clean_area: 100, clean_time: 60, clean_percent: 0 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', 1, expect.anything());
		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'estimatedEndTime', null, expect.anything());
	});

	it('should publish null estimatedEndTime when clean_percent is omitted', async () => {
		const indexMap = createRoomIndexMapForSegment(10, 1);
		const platform = createResolvePlatform(indexMap, true);
		vi.mocked(robot.getAttribute).mockReturnValue([1]);

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-eta',
			state: OperationStatusCode.RoomClean,
			cleaningInfo: {
				segment_id: 10,
				target_segment_id: INVALID_SEGMENT_ID,
				fan_power: 0,
				water_box_status: 0,
				mop_mode: 0,
			},
			cleaningProcess: { clean_area: 100, clean_time: 60 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', 1, expect.anything());
		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'estimatedEndTime', null, expect.anything());
	});

	it('should clear currentArea and estimatedEndTime when traveling with clean_time 0', async () => {
		const selectedAreas = [10];
		const mockRoborockService = asPartial<RoborockService>({
			getSelectedAreas: vi.fn().mockReturnValue(selectedAreas),
			getProgress: vi.fn().mockReturnValue([]),
			setProgress: vi.fn(),
		});
		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(true),
			roborockService: mockRoborockService,
		});
		vi.mocked(robot.getAttribute).mockReturnValue(selectedAreas);

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-eta',
			state: OperationStatusCode.Cleaning,
			cleaningInfo: undefined,
			cleaningProcess: { clean_area: 0, clean_time: 0 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', null, expect.anything());
		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'estimatedEndTime', null, expect.anything());
	});

	it('should publish null estimatedEndTime when state is outside CLEANING_STATES', async () => {
		const indexMap = createRoomIndexMapForSegment(10, 1);
		const platform = createResolvePlatform(indexMap, true);
		vi.mocked(robot.getAttribute).mockReturnValue([1]);

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-eta',
			state: OperationStatusCode.Charging,
			cleaningInfo: {
				segment_id: 10,
				target_segment_id: INVALID_SEGMENT_ID,
				fan_power: 0,
				water_box_status: 0,
				mop_mode: 0,
			},
			cleaningProcess: { clean_area: 100, clean_time: 60, clean_percent: 25 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', 1, expect.anything());
		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'estimatedEndTime', null, expect.anything());
	});
});

describe('handleActiveMapChanged — operational state guard (Bug 3)', () => {
	let robot: RoborockVacuumCleaner;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should skip updateAttribute when robot is actively running', async () => {
		robot = createMockRobot(
			'test-duid-guard',
			100,
			[{ areaId: 5, mapId: 100 } as ServiceArea.Area],
			RvcOperationalState.OperationalState.Running,
		);
		const areas: ServiceArea.Area[] = [{ areaId: 5, mapId: 100 } as ServiceArea.Area];
		const platform = createMockPlatform(areas, undefined, false);

		await handleActiveMapChanged(robot, 100, platform);

		expect(robot.updateAttribute).not.toHaveBeenCalled();
		expect(platform.roborockService?.setProgress).not.toHaveBeenCalled();
	});

	it('should skip updateAttribute when robot is paused', async () => {
		robot = createMockRobot(
			'test-duid-guard-paused',
			100,
			[{ areaId: 5, mapId: 100 } as ServiceArea.Area],
			RvcOperationalState.OperationalState.Paused,
		);
		const areas: ServiceArea.Area[] = [{ areaId: 5, mapId: 100 } as ServiceArea.Area];
		const platform = createMockPlatform(areas, undefined, false);

		await handleActiveMapChanged(robot, 100, platform);

		expect(robot.updateAttribute).not.toHaveBeenCalled();
		expect(platform.roborockService?.setProgress).not.toHaveBeenCalled();
	});

	it('should skip updateAttribute when robot is seeking charger', async () => {
		robot = createMockRobot(
			'test-duid-guard-seeking',
			100,
			[{ areaId: 5, mapId: 100 } as ServiceArea.Area],
			RvcOperationalState.OperationalState.SeekingCharger,
		);
		const areas: ServiceArea.Area[] = [{ areaId: 5, mapId: 100 } as ServiceArea.Area];
		const platform = createMockPlatform(areas, undefined, false);

		await handleActiveMapChanged(robot, 100, platform);

		expect(robot.updateAttribute).not.toHaveBeenCalled();
		expect(platform.roborockService?.setProgress).not.toHaveBeenCalled();
	});

	it('should allow updateAttribute when robot is docked', async () => {
		robot = createMockRobot(
			'test-duid-guard-docked',
			100,
			[{ areaId: 5, mapId: 100 } as ServiceArea.Area],
			RvcOperationalState.OperationalState.Docked,
		);
		const areas: ServiceArea.Area[] = [{ areaId: 5, mapId: 100 } as ServiceArea.Area];
		const platform = createMockPlatform(areas, undefined, false);

		await handleActiveMapChanged(robot, 100, platform);

		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'selectedAreas', [5], expect.anything());
		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', null, expect.anything());
	});

	it('should allow updateAttribute when robot is stopped', async () => {
		robot = createMockRobot(
			'test-duid-guard-stopped',
			100,
			[{ areaId: 5, mapId: 100 } as ServiceArea.Area],
			RvcOperationalState.OperationalState.Stopped,
		);
		const areas: ServiceArea.Area[] = [{ areaId: 5, mapId: 100 } as ServiceArea.Area];
		const platform = createMockPlatform(areas, undefined, false);

		await handleActiveMapChanged(robot, 100, platform);

		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'selectedAreas', [5], expect.anything());
		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', null, expect.anything());
	});

	it('should allow updateAttribute when robot is in error state', async () => {
		robot = createMockRobot(
			'test-duid-guard-error',
			100,
			[{ areaId: 5, mapId: 100 } as ServiceArea.Area],
			RvcOperationalState.OperationalState.Error,
		);
		const areas: ServiceArea.Area[] = [{ areaId: 5, mapId: 100 } as ServiceArea.Area];
		const platform = createMockPlatform(areas, undefined, false);

		await handleActiveMapChanged(robot, 100, platform);

		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'selectedAreas', [5], expect.anything());
		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', null, expect.anything());
	});

	it('should allow updateAttribute when operationalState is undefined', async () => {
		robot = createMockRobot(
			'test-duid-guard-undefined',
			100,
			[{ areaId: 5, mapId: 100 } as ServiceArea.Area],
			undefined,
		);
		const areas: ServiceArea.Area[] = [{ areaId: 5, mapId: 100 } as ServiceArea.Area];
		const platform = createMockPlatform(areas, undefined, false);

		await handleActiveMapChanged(robot, 100, platform);

		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'selectedAreas', [5], expect.anything());
		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', null, expect.anything());
	});

	it('should still respect Matter supportedAreas filter when guard does not trip (idle case)', async () => {
		robot = createMockRobot(
			'test-duid-guard-matter-filter',
			100,
			[{ areaId: 5, mapId: 100 } as ServiceArea.Area],
			RvcOperationalState.OperationalState.Docked,
		);
		const roborockServiceAreas: ServiceArea.Area[] = [
			{ areaId: 5, mapId: 100 } as ServiceArea.Area,
			{ areaId: 6, mapId: 100 } as ServiceArea.Area,
		];
		const platform = createMockPlatform(roborockServiceAreas, undefined, false);

		await handleActiveMapChanged(robot, 100, platform);

		// Should only set area 5 (which is in Matter supportedAreas), not area 6
		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'selectedAreas', [5], expect.anything());
	});
});

describe('resolveAreaFromCleaningInfo — fallback to getAreaIdV2 (Bug 1)', () => {
	let robot: RoborockVacuumCleaner;

	beforeEach(() => {
		vi.clearAllMocks();
		robot = createMockRobot('test-duid-fallback', 0);
	});

	it('should use composite-key lookup when activeMapId matches existing entry (no regression)', async () => {
		// Composite key "10-100" exists in roomInfo
		const roomMapData = new Map<number, AreaInfo>([[1, { roomId: 10, mapId: 100, roomName: 'Room 1' }]]);
		const roomInfo = new Map<string, SegmentInfo>([['10-100', { areaId: 1, mapId: 100, roomName: 'Room 1' }]]);
		const indexMap = new RoomIndexMap(roomMapData, roomInfo);

		robot = createMockRobot('test-duid-composite', 100); // activeMapId = 100 matches
		const mockRoborockService = asPartial<RoborockService>({
			getSupportedAreas: vi.fn().mockReturnValue([{ areaId: 1, mapId: 100 } as ServiceArea.Area]),
			getSupportedAreasIndexMap: vi.fn().mockReturnValue(indexMap),
			getSelectedAreas: vi.fn().mockReturnValue([1]),
			getProgress: vi.fn().mockReturnValue([]),
			setProgress: vi.fn(),
		});

		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(),
			roborockService: mockRoborockService,
		});

		vi.mocked(robot.getAttribute).mockReturnValue([1]);

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-composite',
			state: OperationStatusCode.RoomClean,
			cleaningInfo: {
				segment_id: 10,
				target_segment_id: INVALID_SEGMENT_ID,
				fan_power: 0,
				water_box_status: 0,
				mop_mode: 0,
			},
			cleaningProcess: { clean_area: 100, clean_time: 60 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', 1, expect.anything());
	});

	it('should fall back to getAreaIdV2 when composite-key lookup misses (Bug 1 fix)', async () => {
		// Composite key "10--1" does not exist (activeMapId = -1)
		// But "10-0" exists under a different mapId, which getAreaIdV2 should find
		const roomMapData = new Map<number, AreaInfo>([[1, { roomId: 10, mapId: 0, roomName: 'Room 1' }]]);
		const roomInfo = new Map<string, SegmentInfo>([['10-0', { areaId: 1, mapId: 0, roomName: 'Room 1' }]]);
		const indexMap = new RoomIndexMap(roomMapData, roomInfo);

		robot = createMockRobot('test-duid-fallback', -1); // activeMapId = -1 (V10/V1 case)
		const mockRoborockService = asPartial<RoborockService>({
			getSupportedAreas: vi.fn().mockReturnValue([{ areaId: 1, mapId: 0 } as ServiceArea.Area]),
			getSupportedAreasIndexMap: vi.fn().mockReturnValue(indexMap),
			getSelectedAreas: vi.fn().mockReturnValue([1]),
			getProgress: vi.fn().mockReturnValue([]),
			setProgress: vi.fn(),
		});

		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(),
			roborockService: mockRoborockService,
		});

		vi.mocked(robot.getAttribute).mockReturnValue([1]);

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-fallback',
			state: OperationStatusCode.RoomClean,
			cleaningInfo: {
				segment_id: 10,
				target_segment_id: INVALID_SEGMENT_ID,
				fan_power: 0,
				water_box_status: 0,
				mop_mode: 0,
			},
			cleaningProcess: { clean_area: 100, clean_time: 60 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		// Despite activeMapId=-1 mismatch, fallback should resolve area 1 via getAreaIdV2
		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', 1, expect.anything());
	});

	it('should set currentArea to null when both composite and fallback lookups miss', async () => {
		// No entry for roomId 99 under any mapId
		const roomMapData = new Map<number, AreaInfo>([[1, { roomId: 10, mapId: 0, roomName: 'Room 1' }]]);
		const roomInfo = new Map<string, SegmentInfo>([['10-0', { areaId: 1, mapId: 0, roomName: 'Room 1' }]]);
		const indexMap = new RoomIndexMap(roomMapData, roomInfo);

		robot = createMockRobot('test-duid-both-miss', -1);
		const mockRoborockService = asPartial<RoborockService>({
			getSupportedAreas: vi.fn().mockReturnValue([{ areaId: 1, mapId: 0 } as ServiceArea.Area]),
			getSupportedAreasIndexMap: vi.fn().mockReturnValue(indexMap),
			getSelectedAreas: vi.fn().mockReturnValue([1]),
			getProgress: vi.fn().mockReturnValue([]),
			setProgress: vi.fn(),
		});

		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(),
			roborockService: mockRoborockService,
		});

		vi.mocked(robot.getAttribute).mockReturnValue([1]);

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-both-miss',
			state: OperationStatusCode.RoomClean,
			cleaningInfo: {
				segment_id: 99, // This segment does not exist in the map
				target_segment_id: INVALID_SEGMENT_ID,
				fan_power: 0,
				water_box_status: 0,
				mop_mode: 0,
			},
			cleaningProcess: { clean_area: 100, clean_time: 60 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', null, expect.anything());
	});

	it('should preserve existing Pending/Completed progress when using fallback', async () => {
		const selectedAreas = [1, 2];
		const initialProgress: ServiceArea.Progress[] = [
			{ areaId: 1, status: ServiceArea.OperationalStatus.Pending },
			{ areaId: 2, status: ServiceArea.OperationalStatus.Pending },
		];

		const roomMapData = new Map<number, AreaInfo>([
			[1, { roomId: 10, mapId: 0, roomName: 'Room 1' }],
			[2, { roomId: 20, mapId: 0, roomName: 'Room 2' }],
		]);
		const roomInfo = new Map<string, SegmentInfo>([
			['10-0', { areaId: 1, mapId: 0, roomName: 'Room 1' }],
			['20-0', { areaId: 2, mapId: 0, roomName: 'Room 2' }],
		]);
		const indexMap = new RoomIndexMap(roomMapData, roomInfo);

		robot = createMockRobot('test-duid-progress-fallback', -1);
		const mockRoborockService = asPartial<RoborockService>({
			getSupportedAreas: vi
				.fn()
				.mockReturnValue([{ areaId: 1, mapId: 0 } as ServiceArea.Area, { areaId: 2, mapId: 0 } as ServiceArea.Area]),
			getSupportedAreasIndexMap: vi.fn().mockReturnValue(indexMap),
			getSelectedAreas: vi.fn().mockReturnValue(selectedAreas),
			getProgress: vi.fn().mockReturnValue(initialProgress),
			setProgress: vi.fn(),
		});

		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(),
			roborockService: mockRoborockService,
		});

		vi.mocked(robot.getAttribute).mockReturnValue(selectedAreas);

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-progress-fallback',
			state: OperationStatusCode.RoomClean,
			cleaningInfo: {
				segment_id: 10,
				target_segment_id: INVALID_SEGMENT_ID,
				fan_power: 0,
				water_box_status: 0,
				mop_mode: 0,
			},
			cleaningProcess: { clean_area: 100, clean_time: 60 },
		};

		await handleServiceAreaUpdate(robot, message, platform);

		// Verify area 1 transitioned to Operating, area 2 remained Pending
		expect(mockRoborockService?.setProgress).toHaveBeenCalledWith(
			robot.device.duid,
			expect.arrayContaining([
				expect.objectContaining({
					areaId: 1,
					status: ServiceArea.OperationalStatus.Operating,
				}),
				expect.objectContaining({
					areaId: 2,
					status: ServiceArea.OperationalStatus.Pending,
				}),
			]),
		);
	});
});

describe('buildProgressUpdate', () => {
	describe('with estimatedTimeForActiveArea', () => {
		it('should create new Pending entry for activeAreaId with estimatedTime=180 when estimatedTimeForActiveArea=180 passed', () => {
			const existing: ServiceArea.Progress[] = [];
			const selectedAreas = [1];
			const activeAreaId = 1;
			const estimatedTimeForActiveArea = 180;

			const result = buildProgressUpdate(existing, selectedAreas, activeAreaId, estimatedTimeForActiveArea);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				areaId: 1,
				status: ServiceArea.OperationalStatus.Operating,
				estimatedTime: 180,
			});
		});

		it('should set estimatedTime=null on new active area entry when estimatedTimeForActiveArea=null', () => {
			const existing: ServiceArea.Progress[] = [];
			const selectedAreas = [1];
			const activeAreaId = 1;
			const estimatedTimeForActiveArea = null;

			const result = buildProgressUpdate(existing, selectedAreas, activeAreaId, estimatedTimeForActiveArea);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				areaId: 1,
				status: ServiceArea.OperationalStatus.Operating,
				estimatedTime: null,
			});
		});

		it('should not set estimatedTime key on new entry for activeAreaId when estimatedTimeForActiveArea is undefined', () => {
			const existing: ServiceArea.Progress[] = [];
			const selectedAreas = [1];
			const activeAreaId = 1;

			const result = buildProgressUpdate(existing, selectedAreas, activeAreaId, undefined);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				areaId: 1,
				status: ServiceArea.OperationalStatus.Operating,
			});
			expect(result[0]).not.toHaveProperty('estimatedTime');
		});
	});

	describe('without estimatedTimeForActiveArea on non-active areas', () => {
		it('should NOT set estimatedTime on new Pending entries for non-active areas', () => {
			const existing: ServiceArea.Progress[] = [];
			const selectedAreas = [1, 2, 3];
			const activeAreaId = 1;
			const estimatedTimeForActiveArea = 180;

			const result = buildProgressUpdate(existing, selectedAreas, activeAreaId, estimatedTimeForActiveArea);

			// Active area (areaId=1) gets estimatedTime
			const activeEntry = result.find((p) => p.areaId === 1);
			expect(activeEntry).toMatchObject({
				areaId: 1,
				status: ServiceArea.OperationalStatus.Operating,
				estimatedTime: 180,
			});

			// Non-active areas (areaId=2,3) should NOT have estimatedTime property
			const nonActiveEntry2 = result.find((p) => p.areaId === 2);
			const nonActiveEntry3 = result.find((p) => p.areaId === 3);
			expect(nonActiveEntry2).toMatchObject({
				areaId: 2,
				status: ServiceArea.OperationalStatus.Pending,
			});
			expect(nonActiveEntry2).not.toHaveProperty('estimatedTime');
			expect(nonActiveEntry3).toMatchObject({
				areaId: 3,
				status: ServiceArea.OperationalStatus.Pending,
			});
			expect(nonActiveEntry3).not.toHaveProperty('estimatedTime');
		});
	});

	describe('existing entry preservation', () => {
		it('should NOT overwrite estimatedTime on existing Progress entry when called again', () => {
			// First call creates entry with estimatedTime: 180
			const existing: ServiceArea.Progress[] = [
				{
					areaId: 1,
					status: ServiceArea.OperationalStatus.Pending,
					estimatedTime: 180,
				},
			];
			const selectedAreas = [1];
			const activeAreaId = 1;
			// Second call with different value
			const newEstimatedTime = 200;

			const result = buildProgressUpdate(existing, selectedAreas, activeAreaId, newEstimatedTime);

			// Should preserve original estimatedTime (180), not update to 200
			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				areaId: 1,
				estimatedTime: 180,
			});
		});

		it('should preserve estimatedTime when existing entry transitions from Pending to Operating', () => {
			const existing: ServiceArea.Progress[] = [
				{
					areaId: 1,
					status: ServiceArea.OperationalStatus.Pending,
					estimatedTime: 120,
				},
			];
			const selectedAreas = [1];
			const activeAreaId = 1; // Transitioning to Operating
			const newEstimatedTime = 150; // Different value passed

			const result = buildProgressUpdate(existing, selectedAreas, activeAreaId, newEstimatedTime);

			// Status should change to Operating, but estimatedTime should remain unchanged
			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				areaId: 1,
				status: ServiceArea.OperationalStatus.Operating,
				estimatedTime: 120,
			});
		});
	});

	describe('status transitions', () => {
		it('should set new entry status to Pending and activeAreaId to Operating', () => {
			const existing: ServiceArea.Progress[] = [];
			const selectedAreas = [1, 2];
			const activeAreaId = 1;

			const result = buildProgressUpdate(existing, selectedAreas, activeAreaId, null);

			expect(result.find((p) => p.areaId === 1)).toMatchObject({
				status: ServiceArea.OperationalStatus.Operating,
			});
			expect(result.find((p) => p.areaId === 2)).toMatchObject({
				status: ServiceArea.OperationalStatus.Pending,
			});
		});

		it('should transition previously Operating area to Completed when activeAreaId changes', () => {
			const existing: ServiceArea.Progress[] = [
				{ areaId: 1, status: ServiceArea.OperationalStatus.Operating },
				{ areaId: 2, status: ServiceArea.OperationalStatus.Pending },
			];
			const selectedAreas = [1, 2];
			const newActiveAreaId = 2; // Switching active area

			const result = buildProgressUpdate(existing, selectedAreas, newActiveAreaId, null);

			expect(result.find((p) => p.areaId === 1)).toMatchObject({
				status: ServiceArea.OperationalStatus.Completed,
			});
			expect(result.find((p) => p.areaId === 2)).toMatchObject({
				status: ServiceArea.OperationalStatus.Operating,
			});
		});

		it('should handle activeAreaId=null by leaving all entries unchanged in status', () => {
			const existing: ServiceArea.Progress[] = [
				{ areaId: 1, status: ServiceArea.OperationalStatus.Pending },
				{ areaId: 2, status: ServiceArea.OperationalStatus.Operating },
			];
			const selectedAreas = [1, 2];

			const result = buildProgressUpdate(existing, selectedAreas, null, null);

			// Status should remain unchanged when activeAreaId is null
			expect(result.find((p) => p.areaId === 1)).toMatchObject({
				status: ServiceArea.OperationalStatus.Pending,
			});
			expect(result.find((p) => p.areaId === 2)).toMatchObject({
				status: ServiceArea.OperationalStatus.Operating,
			});
		});
	});

	describe('selectedAreas filtering', () => {
		it('should remove entries not in selectedAreas', () => {
			const existing: ServiceArea.Progress[] = [
				{ areaId: 1, status: ServiceArea.OperationalStatus.Operating },
				{ areaId: 2, status: ServiceArea.OperationalStatus.Pending },
			];
			const selectedAreas = [1]; // Only area 1 is selected

			const result = buildProgressUpdate(existing, selectedAreas, 1, null);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({ areaId: 1 });
		});

		it('should add new entries for selectedAreas not in existing', () => {
			const existing: ServiceArea.Progress[] = [{ areaId: 1, status: ServiceArea.OperationalStatus.Operating }];
			const selectedAreas = [1, 2, 3]; // Adding 2 and 3

			const result = buildProgressUpdate(existing, selectedAreas, 1, null);

			expect(result).toHaveLength(3);
			expect(result.map((p) => p.areaId).sort()).toEqual([1, 2, 3]);
		});
	});

	describe('call-site integration with shouldPublishEstimatedEndTime gate', () => {
		it('should be called with estimatedTimeForActiveArea=null when estimatedEndTimeDisabled', () => {
			// This test documents the expected behavior at the call site
			// When configManager.isEstimatedEndTimeEnabled = false,
			// the caller should pass estimatedTimeForActiveArea = null
			const existing: ServiceArea.Progress[] = [];
			const selectedAreas = [1];
			const activeAreaId = 1;

			// Simulating disabled config: caller passes null
			const result = buildProgressUpdate(existing, selectedAreas, activeAreaId, null);

			// Entry should have estimatedTime: null
			expect(result[0]).toMatchObject({
				estimatedTime: null,
			});
		});

		it('should be called with estimatedTimeForActiveArea=computed value when estimatedEndTimeEnabled', () => {
			// This test documents the expected behavior at the call site
			// When configManager.isEstimatedEndTimeEnabled = true,
			// the caller should pass the value from computeAreaEstimatedTime()
			const existing: ServiceArea.Progress[] = [];
			const selectedAreas = [1];
			const activeAreaId = 1;
			const computedEstimatedTime = 180; // From computeAreaEstimatedTime(60, 25)

			// Simulating enabled config: caller passes computed value
			const result = buildProgressUpdate(existing, selectedAreas, activeAreaId, computedEstimatedTime);

			// Entry should have estimatedTime: 180
			expect(result[0]).toMatchObject({
				estimatedTime: 180,
			});
		});
	});
});

describe('resolveAreaFromCleaningInfo — V1 fallback when cleaningInfo is absent', () => {
	let robot: RoborockVacuumCleaner;

	beforeEach(() => {
		vi.clearAllMocks();
		robot = createMockRobot('test-duid-v1', 0);
	});

	it('should resolve currentArea from cached segment when V1 device has no cleaningInfo and cache is fresh', async () => {
		// Arrange
		const indexMap = createRoomIndexMapForSegment(42, 5, 0);
		const mockRoborockService = asPartial<RoborockService>({
			getSupportedAreas: vi.fn().mockReturnValue([{ areaId: 5, mapId: 0 } as ServiceArea.Area]),
			getSupportedAreasIndexMap: vi.fn().mockReturnValue(indexMap),
			getSelectedAreas: vi.fn().mockReturnValue([]), // Empty to enter else branch at line 233
			getProgress: vi.fn().mockReturnValue([]),
			setProgress: vi.fn(),
			getV1ResolvedSegment: vi.fn().mockReturnValue(42), // Cache hit with segmentId 42
			requestV1MapRefresh: vi.fn(),
		});

		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(),
			roborockService: mockRoborockService,
		});

		// Create robot with V1 protocol
		const robotV1 = asPartial<RoborockVacuumCleaner>({
			device: asPartial<Device>({ duid: 'test-duid-v1', pv: ProtocolVersion.V1 }),
			homeInFo: asPartial<HomeEntity>({ activeMapId: 0 }),
			updateAttribute: vi.fn().mockResolvedValue(undefined),
			getAttribute: vi.fn().mockReturnValue(undefined),
		});

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-v1',
			state: OperationStatusCode.Cleaning, // A CLEANING_STATE
			cleaningInfo: undefined, // Absent
			cleaningProcess: { clean_area: 100, clean_time: 60 }, // Non-zero required by line 211
		};

		// Act
		await handleServiceAreaUpdate(robotV1, message, platform);

		// Assert — getSupportedAreasIndexMap should be called first
		expect(mockRoborockService.getSupportedAreasIndexMap).toHaveBeenCalledWith('test-duid-v1');
		// getV1ResolvedSegment should be called to check cache
		expect(mockRoborockService.getV1ResolvedSegment).toHaveBeenCalledWith('test-duid-v1');
		// Refresh should NOT be called because cache is fresh
		expect(mockRoborockService.requestV1MapRefresh).not.toHaveBeenCalled();
		// updateAttribute should have been called with the mapped area (5)
		expect(vi.mocked(robotV1.updateAttribute).mock.calls.some((call) => call[2] === 5)).toBe(true);
	});

	it('should call requestV1MapRefresh when V1 device has no cleaningInfo and cache is empty', async () => {
		// Arrange
		const indexMap = createRoomIndexMapForSegment(42, 5, 0);
		const mockRoborockService = asPartial<RoborockService>({
			getSupportedAreas: vi.fn().mockReturnValue([{ areaId: 5, mapId: 0 } as ServiceArea.Area]),
			getSupportedAreasIndexMap: vi.fn().mockReturnValue(indexMap),
			getSelectedAreas: vi.fn().mockReturnValue([]), // Empty to enter else branch at line 233
			getProgress: vi.fn().mockReturnValue([]),
			setProgress: vi.fn(),
			getV1ResolvedSegment: vi.fn().mockReturnValue(undefined), // Cache miss
			requestV1MapRefresh: vi.fn(),
		});

		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(),
			roborockService: mockRoborockService,
		});

		// Create robot with V1 protocol
		const robotV1 = asPartial<RoborockVacuumCleaner>({
			device: asPartial<Device>({ duid: 'test-duid-v1-empty', pv: ProtocolVersion.V1 }),
			homeInFo: asPartial<HomeEntity>({ activeMapId: 0 }),
			updateAttribute: vi.fn().mockResolvedValue(undefined),
			getAttribute: vi.fn().mockReturnValue(undefined),
		});

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-v1-empty',
			state: OperationStatusCode.Cleaning, // A CLEANING_STATE
			cleaningInfo: undefined, // Absent
			cleaningProcess: { clean_area: 100, clean_time: 60 }, // Non-zero required by line 211
		};

		// Act
		await handleServiceAreaUpdate(robotV1, message, platform);

		// Assert — getV1ResolvedSegment should be called and return undefined (cache miss)
		expect(mockRoborockService.getV1ResolvedSegment).toHaveBeenCalledWith('test-duid-v1-empty');
		// Refresh should be called to populate the cache for next tick
		expect(mockRoborockService.requestV1MapRefresh).toHaveBeenCalledWith('test-duid-v1-empty');
	});

	it('should NOT call requestV1MapRefresh when V1 device has valid cleaningInfo (regression guard)', async () => {
		// Arrange
		const indexMap = createRoomIndexMapForSegment(42, 5, 0);
		const mockRoborockService = asPartial<RoborockService>({
			getSupportedAreas: vi.fn().mockReturnValue([{ areaId: 5, mapId: 0 } as ServiceArea.Area]),
			getSupportedAreasIndexMap: vi.fn().mockReturnValue(indexMap),
			getSelectedAreas: vi.fn().mockReturnValue([5]),
			getProgress: vi.fn().mockReturnValue([]),
			setProgress: vi.fn(),
			getV1ResolvedSegment: vi.fn(), // Should not be called
			requestV1MapRefresh: vi.fn(),
		});

		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(),
			roborockService: mockRoborockService,
		});

		robot.device.pv = ProtocolVersion.V1;
		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-v1',
			state: OperationStatusCode.RoomClean,
			cleaningInfo: {
				segment_id: 42,
				target_segment_id: INVALID_SEGMENT_ID,
				fan_power: 0,
				water_box_status: 0,
				mop_mode: 0,
			},
			cleaningProcess: { clean_area: 100, clean_time: 60 },
		};

		// Act
		await handleServiceAreaUpdate(robot, message, platform);

		// Assert — V1 fallback should be completely skipped when cleaningInfo is present
		expect(mockRoborockService.getV1ResolvedSegment).not.toHaveBeenCalled();
		expect(mockRoborockService.requestV1MapRefresh).not.toHaveBeenCalled();
		// Normal path should execute (area resolved from cleaningInfo)
		expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', 5, expect.anything());
	});

	it('should NOT call V1 fallback when device is not V1 (protocol gate)', async () => {
		// Arrange
		const indexMap = createRoomIndexMapForSegment(42, 5, 0);
		const mockRoborockService = asPartial<RoborockService>({
			getSupportedAreas: vi.fn().mockReturnValue([{ areaId: 5, mapId: 0 } as ServiceArea.Area]),
			getSupportedAreasIndexMap: vi.fn().mockReturnValue(indexMap),
			getSelectedAreas: vi.fn().mockReturnValue([5]),
			getProgress: vi.fn().mockReturnValue([]),
			setProgress: vi.fn(),
			getV1ResolvedSegment: vi.fn(),
			requestV1MapRefresh: vi.fn(),
		});

		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(),
			roborockService: mockRoborockService,
		});

		// Create robot with B01 protocol (not V1)
		const robotB01 = asPartial<RoborockVacuumCleaner>({
			device: asPartial<Device>({ duid: 'test-duid-b01', pv: ProtocolVersion.B01 }),
			homeInFo: asPartial<HomeEntity>({ activeMapId: 0 }),
			updateAttribute: vi.fn().mockResolvedValue(undefined),
			getAttribute: vi.fn().mockReturnValue(undefined),
		});

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-b01',
			state: OperationStatusCode.Cleaning, // A CLEANING_STATE
			cleaningInfo: undefined, // Absent
			cleaningProcess: { clean_area: 100, clean_time: 60 }, // Non-zero values required
		};

		// Act
		await handleServiceAreaUpdate(robotB01, message, platform);

		// Assert — V1 fallback should not be called for non-V1 devices
		expect(mockRoborockService.getV1ResolvedSegment).not.toHaveBeenCalled();
		expect(mockRoborockService.requestV1MapRefresh).not.toHaveBeenCalled();
	});

	it('should set currentArea to null when segment maps to no area (unmapped segment)', async () => {
		// Arrange
		const indexMap = createRoomIndexMapForSegment(42, 5, 0);
		const mockRoborockService = asPartial<RoborockService>({
			getSupportedAreas: vi.fn().mockReturnValue([{ areaId: 5, mapId: 0 } as ServiceArea.Area]),
			getSupportedAreasIndexMap: vi.fn().mockReturnValue(indexMap),
			getSelectedAreas: vi.fn().mockReturnValue([]), // Empty to enter else branch at line 233
			getProgress: vi.fn().mockReturnValue([]),
			setProgress: vi.fn(),
			getV1ResolvedSegment: vi.fn().mockReturnValue(999), // Unmapped segment ID
			requestV1MapRefresh: vi.fn(),
		});

		const platform = asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
			configManager: createMockConfigManager(),
			roborockService: mockRoborockService,
		});

		// Create robot with V1 protocol
		const robotV1 = asPartial<RoborockVacuumCleaner>({
			device: asPartial<Device>({ duid: 'test-duid-v1-unmapped', pv: ProtocolVersion.V1 }),
			homeInFo: asPartial<HomeEntity>({ activeMapId: 0 }),
			updateAttribute: vi.fn().mockResolvedValue(undefined),
			getAttribute: vi.fn().mockReturnValue(undefined),
		});

		const message: ServiceAreaUpdateMessage = {
			duid: 'test-duid-v1-unmapped',
			state: OperationStatusCode.Cleaning, // A CLEANING_STATE
			cleaningInfo: undefined,
			cleaningProcess: { clean_area: 100, clean_time: 60 }, // Non-zero required by line 211
		};

		// Act
		await handleServiceAreaUpdate(robotV1, message, platform);

		// Assert — currentArea should be set to null for unmapped segment
		expect(
			vi.mocked(robotV1.updateAttribute).mock.calls.some((call) => call[1] === 'currentArea' && call[2] === null),
		).toBe(true);
		// Refresh should NOT be called because we got a valid (but unmapped) segment from cache
		expect(mockRoborockService.requestV1MapRefresh).not.toHaveBeenCalled();
	});
});
