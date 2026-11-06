import { RvcOperationalState, ServiceArea } from 'matterbridge/matter/clusters';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { INVALID_SEGMENT_ID } from '../../../constants/index.js';
import { RoomIndexMap } from '../../../core/application/models/index.js';
import { HomeEntity } from '../../../core/domain/entities/Home.js';
import { AreaInfo, SegmentInfo } from '../../../initialData/getSupportedAreas.js';
import { RoborockMatterbridgePlatform } from '../../../module.js';
import { PlatformConfigManager } from '../../../platform/platformConfigManager.js';
import { OperationStatusCode, ProtocolVersion } from '../../../roborockCommunication/enums/index.js';
import { CleanInformation, CleanProcess, Device } from '../../../roborockCommunication/models/index.js';
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

const DUID = 'test-duid';

interface MockRobotOptions {
	pv?: ProtocolVersion;
	activeMapId?: number;
	operationalState?: RvcOperationalState.OperationalState;
	attributes?: Record<string, unknown>;
}

function createMockRobot(options: MockRobotOptions = {}): RoborockVacuumCleaner {
	const attributes = options.attributes ?? {};
	return asPartial<RoborockVacuumCleaner>({
		device: asPartial<Device>({ duid: DUID, pv: options.pv }),
		homeInFo: asPartial<HomeEntity>({ activeMapId: options.activeMapId ?? 0 }),
		updateAttribute: vi.fn().mockResolvedValue(undefined),
		buildPendingProgressSeed: vi.fn().mockReturnValue([]),
		getAttribute: vi.fn().mockImplementation((_clusterId: unknown, attrName: string) => {
			if (attrName === 'operationalState') {
				return options.operationalState;
			}
			return attributes[attrName];
		}),
	});
}

function createDefaultMockRoborockService(overrides: Partial<RoborockService> = {}): RoborockService {
	return asPartial<RoborockService>({
		getSupportedAreas: vi.fn().mockReturnValue([]),
		getSupportedAreasIndexMap: vi.fn().mockReturnValue(undefined),
		getSelectedAreas: vi.fn().mockReturnValue([]),
		getProgress: vi.fn().mockReturnValue([]),
		setProgress: vi.fn(),
		getLastActivelyCleaningState: vi.fn().mockReturnValue(false),
		setLastActivelyCleaningState: vi.fn(),
		ensureAreasForMap: vi.fn().mockResolvedValue(false),
		setPendingRoomResolution: vi.fn(),
		clearPendingRoomResolution: vi.fn(),
		...overrides,
	});
}

function makePlatform(
	serviceOverrides: Partial<RoborockService> = {},
	withService = true,
): RoborockMatterbridgePlatform {
	return asPartial<RoborockMatterbridgePlatform>({
		log: createMockLogger(),
		configManager: asPartial<PlatformConfigManager>({ isEstimatedEndTimeEnabled: false }),
		roborockService: withService ? createDefaultMockRoborockService(serviceOverrides) : undefined,
	});
}

function createRoomIndexMapForSegment(segmentId: number, areaId: number, mapId = 100): RoomIndexMap {
	const roomMapData = new Map<number, AreaInfo>([[areaId, { roomId: segmentId, mapId, roomName: `Room ${areaId}` }]]);
	const roomInfo = new Map<string, SegmentInfo>([
		[`${segmentId}-${mapId}`, { areaId, mapId, roomName: `Room ${areaId}` }],
	]);
	return new RoomIndexMap(roomMapData, roomInfo);
}

function createUpdateMessage(
	state: OperationStatusCode,
	overrides: Partial<ServiceAreaUpdateMessage> = {},
): ServiceAreaUpdateMessage {
	return asPartial<ServiceAreaUpdateMessage>({
		duid: DUID,
		state,
		cleaningProcess: asPartial<CleanProcess>({ clean_area: 10, clean_time: 10 }),
		cleaningInfo: undefined,
		...overrides,
	});
}

function getUpdateCallsFor(robot: RoborockVacuumCleaner, attrName: string): unknown[][] {
	return vi.mocked(robot.updateAttribute).mock.calls.filter((call) => call[1] === attrName);
}

describe('serviceAreaHandler coverage gaps', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('getNextPendingArea', () => {
		it('should return null when afterSkippedId is not in selectedAreas', () => {
			// Arrange
			const selectedAreas = [1, 2];
			// Act
			const result = getNextPendingArea(selectedAreas, [], 99);
			// Assert
			expect(result).toBeNull();
		});

		it('should skip non-pending areas and return the next pending one', () => {
			// Arrange
			const selectedAreas = [1, 2, 3];
			const progress: ServiceArea.Progress[] = [
				{ areaId: 2, status: ServiceArea.OperationalStatus.Completed },
				{ areaId: 3, status: ServiceArea.OperationalStatus.Pending },
			];
			// Act
			const result = getNextPendingArea(selectedAreas, progress, 1);
			// Assert
			expect(result).toBe(3);
		});

		it('should return null when all following areas are not pending', () => {
			// Arrange
			const selectedAreas = [1, 2, 3];
			const progress: ServiceArea.Progress[] = [
				{ areaId: 2, status: ServiceArea.OperationalStatus.Completed },
				{ areaId: 3, status: ServiceArea.OperationalStatus.Skipped },
			];
			// Act
			const result = getNextPendingArea(selectedAreas, progress, 1);
			// Assert
			expect(result).toBeNull();
		});
	});

	describe('markAreaSkipped', () => {
		it('should add missing selected areas as Pending before marking skipped and next', () => {
			// Arrange
			const progress: ServiceArea.Progress[] = [];
			// Act
			const result = markAreaSkipped(progress, [1, 2], 1, 2);
			// Assert
			expect(result).toEqual([
				{ areaId: 1, status: ServiceArea.OperationalStatus.Skipped },
				{ areaId: 2, status: ServiceArea.OperationalStatus.Operating },
			]);
			expect(progress).toHaveLength(0);
		});

		it('should leave entries unchanged when skipped area is not in progress and next is null', () => {
			// Arrange
			const progress: ServiceArea.Progress[] = [{ areaId: 1, status: ServiceArea.OperationalStatus.Pending }];
			// Act
			const result = markAreaSkipped(progress, [1], 99, null);
			// Assert
			expect(result).toEqual([{ areaId: 1, status: ServiceArea.OperationalStatus.Pending }]);
		});

		it('should mark skipped area and ignore unknown next area id', () => {
			// Arrange
			const progress: ServiceArea.Progress[] = [{ areaId: 1, status: ServiceArea.OperationalStatus.Pending }];
			// Act
			const result = markAreaSkipped(progress, [1], 1, 99);
			// Assert
			expect(result).toEqual([{ areaId: 1, status: ServiceArea.OperationalStatus.Skipped }]);
		});
	});

	describe('handleServiceAreaUpdate fallbacks', () => {
		it('should publish progress for a single selected area when getProgress returns undefined', async () => {
			// Arrange
			const platform = makePlatform({ getProgress: vi.fn() });
			const robot = createMockRobot({ attributes: { selectedAreas: [5] } });
			const expected = [{ areaId: 5, status: ServiceArea.OperationalStatus.Operating, estimatedTime: null }];
			// Act
			await handleServiceAreaUpdate(robot, createUpdateMessage(OperationStatusCode.Cleaning), platform);
			// Assert
			expect(platform.roborockService?.setProgress).toHaveBeenCalledWith(DUID, expected);
			expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'progress', expected, expect.anything());
		});

		it('should still publish progress when the platform has no roborockService', async () => {
			// Arrange
			const platform = makePlatform({}, false);
			const robot = createMockRobot({ attributes: { selectedAreas: [5] } });
			const expected = [{ areaId: 5, status: ServiceArea.OperationalStatus.Operating, estimatedTime: null }];
			// Act
			await handleServiceAreaUpdate(robot, createUpdateMessage(OperationStatusCode.Cleaning), platform);
			// Assert
			expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'progress', expected, expect.anything());
		});

		it('should not publish progress on run end when getProgress returns undefined', async () => {
			// Arrange
			const platform = makePlatform({
				getLastActivelyCleaningState: vi.fn().mockReturnValue(true),
				getProgress: vi.fn(),
			});
			const robot = createMockRobot({
				operationalState: RvcOperationalState.OperationalState.Docked,
				attributes: { selectedAreas: [5] },
			});
			// Act
			await handleServiceAreaUpdate(robot, createUpdateMessage(OperationStatusCode.Cleaning), platform);
			// Assert
			expect(platform.roborockService?.setProgress).not.toHaveBeenCalled();
			expect(getUpdateCallsFor(robot, 'progress')).toHaveLength(0);
			expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', null, expect.anything());
			expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'estimatedEndTime', null, expect.anything());
		});

		it('should reset progress to empty when idle and getProgress returns undefined', async () => {
			// Arrange
			const platform = makePlatform({
				getSelectedAreas: vi.fn().mockReturnValue([1]),
				getProgress: vi.fn(),
			});
			const robot = createMockRobot();
			// Act
			await handleServiceAreaUpdate(robot, createUpdateMessage(OperationStatusCode.Idle), platform);
			// Assert
			expect(platform.roborockService?.setProgress).toHaveBeenCalledWith(DUID, []);
			expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'progress', [], expect.anything());
		});

		it('should fall back to the first selected area without V1 lookups when no index map exists', async () => {
			// Arrange
			const getV1ResolvedSegment = vi.fn();
			const requestV1MapRefresh = vi.fn();
			const platform = makePlatform({
				getSupportedAreasIndexMap: vi.fn().mockReturnValue(undefined),
				getV1ResolvedSegment,
				requestV1MapRefresh,
			});
			const robot = createMockRobot({ pv: ProtocolVersion.V1, attributes: { selectedAreas: [1, 2] } });
			// Act
			await handleServiceAreaUpdate(robot, createUpdateMessage(OperationStatusCode.Cleaning), platform);
			// Assert
			expect(getV1ResolvedSegment).not.toHaveBeenCalled();
			expect(requestV1MapRefresh).not.toHaveBeenCalled();
			expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', 1, expect.anything());
		});
	});

	describe('handleServiceAreaUpdate cleaningInfo segment resolution', () => {
		it('should resolve currentArea from target_segment_id when segment_id is undefined', async () => {
			// Arrange
			const platform = makePlatform({
				getSupportedAreasIndexMap: vi.fn().mockReturnValue(createRoomIndexMapForSegment(10, 1, 0)),
			});
			const robot = createMockRobot({ activeMapId: 0, attributes: { selectedAreas: [1] } });
			const message = createUpdateMessage(OperationStatusCode.Cleaning, {
				cleaningInfo: asPartial<CleanInformation>({ segment_id: undefined, target_segment_id: 10 }),
			});
			// Act
			await handleServiceAreaUpdate(robot, message, platform);
			// Assert
			expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', 1, expect.anything());
		});

		// Pins CURRENT behaviour (not necessarily desired): see workspace/issue-161-test-coverage/plan.md, production issue 3
		it.each([
			['segment_id is INVALID_SEGMENT_ID and target_segment_id is undefined', INVALID_SEGMENT_ID, undefined],
			['segment_id and target_segment_id are both undefined', undefined, undefined],
		])(
			'pins CURRENT behaviour: currentArea is not reset when there is no active segment (%s; see workspace/issue-161-test-coverage/plan.md, production issue 3)',
			async (_label, segmentId, targetSegmentId) => {
				// Arrange
				const platform = makePlatform({
					getSupportedAreasIndexMap: vi.fn().mockReturnValue(createRoomIndexMapForSegment(10, 1, 0)),
				});
				const robot = createMockRobot({ attributes: { selectedAreas: [1] } });
				const message = createUpdateMessage(OperationStatusCode.Cleaning, {
					cleaningInfo: asPartial<CleanInformation>({ segment_id: segmentId, target_segment_id: targetSegmentId }),
				});
				// Act
				await handleServiceAreaUpdate(robot, message, platform);
				// Assert
				expect(platform.log.debug).toHaveBeenCalledWith('No active segment, skipping currentArea update');
				expect(getUpdateCallsFor(robot, 'currentArea')).toHaveLength(0);
				expect(platform.roborockService?.setPendingRoomResolution).not.toHaveBeenCalled();
			},
		);
	});

	describe('handleActiveMapChanged reload and fallbacks', () => {
		it('should reload areas for the new map and select them when ensureAreasForMap succeeds', async () => {
			// Arrange
			const getSupportedAreas = vi
				.fn()
				.mockReturnValueOnce([])
				.mockReturnValueOnce([
					{ areaId: 1, mapId: 100 },
					{ areaId: 2, mapId: 100 },
				]);
			const ensureAreasForMap = vi.fn().mockResolvedValue(true);
			const platform = makePlatform({ getSupportedAreas, ensureAreasForMap });
			const robot = createMockRobot({
				activeMapId: 100,
				attributes: {
					supportedAreas: [asPartial<ServiceArea.Area>({ areaId: 1 }), asPartial<ServiceArea.Area>({ areaId: 2 })],
				},
			});
			// Act
			await handleActiveMapChanged(robot, 100, platform);
			// Assert
			expect(ensureAreasForMap).toHaveBeenCalledWith(DUID, 100);
			expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'selectedAreas', [1, 2], expect.anything());
		});

		it('should return early without updates when reload yields no areas for the map', async () => {
			// Arrange
			const getSupportedAreas = vi.fn().mockReturnValueOnce([]).mockReturnValueOnce(undefined);
			const platform = makePlatform({
				getSupportedAreas,
				ensureAreasForMap: vi.fn().mockResolvedValue(true),
			});
			const robot = createMockRobot({
				activeMapId: 100,
				attributes: { supportedAreas: [asPartial<ServiceArea.Area>({ areaId: 1 })] },
			});
			// Act
			await handleActiveMapChanged(robot, 100, platform);
			// Assert
			expect(robot.updateAttribute).not.toHaveBeenCalled();
			expect(platform.roborockService?.clearPendingRoomResolution).not.toHaveBeenCalled();
		});

		it('should return early without updates when the robot has no Matter supportedAreas', async () => {
			// Arrange
			const platform = makePlatform({
				getSupportedAreas: vi.fn().mockReturnValue([
					{ areaId: 1, mapId: 100 },
					{ areaId: 2, mapId: 100 },
				]),
			});
			const robot = createMockRobot({ activeMapId: 100 });
			// Act
			await handleActiveMapChanged(robot, 100, platform);
			// Assert
			expect(robot.updateAttribute).not.toHaveBeenCalled();
			expect(platform.roborockService?.clearPendingRoomResolution).not.toHaveBeenCalled();
		});
	});
});
