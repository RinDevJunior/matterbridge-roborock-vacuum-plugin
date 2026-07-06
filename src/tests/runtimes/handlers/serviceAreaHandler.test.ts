import { ServiceArea } from 'matterbridge/matter/clusters';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { INVALID_SEGMENT_ID } from '../../../constants/index.js';
import { RoomIndexMap } from '../../../core/application/models/index.js';
import { HomeEntity } from '../../../core/domain/entities/Home.js';
import { AreaInfo, SegmentInfo } from '../../../initialData/getSupportedAreas.js';
import { RoborockMatterbridgePlatform } from '../../../module.js';
import { PlatformConfigManager } from '../../../platform/platformConfigManager.js';
import { OperationStatusCode } from '../../../roborockCommunication/enums/index.js';
import { CleanInformation, Device } from '../../../roborockCommunication/models/index.js';
import {
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
): RoborockVacuumCleaner {
	return asPartial<RoborockVacuumCleaner>({
		device: asPartial<Device>({ duid }),
		homeInFo: asPartial<HomeEntity>({ activeMapId }),
		updateAttribute: vi.fn().mockResolvedValue(undefined),
		getAttribute: vi.fn().mockImplementation((_clusterId, attrName) => {
			if (attrName === 'supportedAreas') {
				return matterSupportedAreas;
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

	it('should finalize progress when state is Idle with Operating area', async () => {
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

		// Verify Operating area was marked Completed
		expect(mockRoborockService?.setProgress).toHaveBeenCalledWith(
			robot.device.duid,
			expect.arrayContaining([
				expect.objectContaining({
					areaId: 2,
					status: ServiceArea.OperationalStatus.Completed,
				}),
			]),
		);

		// Verify updateAttribute was called with finalized progress
		expect(robot.updateAttribute).toHaveBeenCalledWith(
			ServiceArea.id,
			'progress',
			expect.arrayContaining([
				expect.objectContaining({
					areaId: 2,
					status: ServiceArea.OperationalStatus.Completed,
				}),
			]),
			expect.anything(),
		);
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
		expect(setProgressCall[1]).toEqual([{ areaId: 10, status: ServiceArea.OperationalStatus.Operating }]);
	});

	it('should leave progress untouched when state is Idle without Operating areas', async () => {
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

		// Pending areas should remain Pending
		expect(mockRoborockService?.setProgress).toHaveBeenCalledWith(
			robot.device.duid,
			expect.arrayContaining([
				expect.objectContaining({
					areaId: 1,
					status: ServiceArea.OperationalStatus.Pending,
				}),
				expect.objectContaining({
					areaId: 2,
					status: ServiceArea.OperationalStatus.Pending,
				}),
			]),
		);
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
