import { RvcOperationalState, ServiceArea } from 'matterbridge/matter/clusters';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoomIndexMap } from '../../../core/application/models/index.js';
import { HomeEntity } from '../../../core/domain/entities/Home.js';
import { RoborockMatterbridgePlatform } from '../../../module.js';
import type { PlatformConfigManager } from '../../../platform/platformConfigManager.js';
import { OperationStatusCode, ProtocolVersion } from '../../../roborockCommunication/enums/index.js';
import { CleanProcess, Device } from '../../../roborockCommunication/models/index.js';
import { handleActiveMapChanged, handleServiceAreaUpdate } from '../../../runtimes/handlers/serviceAreaHandler.js';
import type { CleaningRunStateStore } from '../../../services/cleaningRunStateStore.js';
import type { RoborockService } from '../../../services/roborockService.js';
import type { ServiceAreaUpdateMessage } from '../../../types/MessagePayloads.js';
import { RoborockVacuumCleaner } from '../../../types/roborockVacuumCleaner.js';
import { asPartial, createMockLogger } from '../../helpers/testUtils.js';

const DUID = 'duid-persist';
const MAP_ID = 7;
const RUNNING = RvcOperationalState.OperationalState.Running;
const DOCKED = RvcOperationalState.OperationalState.Docked;

interface FakeService {
	service: RoborockService;
	progress: Map<string, ServiceArea.Progress[]>;
	selected: Map<string, number[]>;
	lastActive: Map<string, boolean>;
}

/** Stateful in-memory stand-in for the RoborockService methods the handler touches. */
function createFakeService(
	options: { areas?: ServiceArea.Area[]; indexMap?: RoomIndexMap | undefined; pending?: boolean } = {},
): FakeService {
	const progress = new Map<string, ServiceArea.Progress[]>();
	const selected = new Map<string, number[]>();
	const lastActive = new Map<string, boolean>();
	let pending = options.pending ?? false;
	const areas = options.areas ?? [
		asPartial<ServiceArea.Area>({ areaId: 0, mapId: MAP_ID }),
		asPartial<ServiceArea.Area>({ areaId: 1, mapId: MAP_ID }),
		asPartial<ServiceArea.Area>({ areaId: 2, mapId: MAP_ID }),
	];
	const indexMap =
		'indexMap' in options ? options.indexMap : asPartial<RoomIndexMap>({ getRoomId: (areaId: number) => areaId + 100 });

	const service = asPartial<RoborockService>({
		getSupportedAreas: vi.fn().mockReturnValue(areas),
		getSupportedAreasIndexMap: vi.fn().mockReturnValue(indexMap),
		getProgress: vi.fn().mockImplementation((duid: string) => progress.get(duid) ?? []),
		setProgress: vi.fn().mockImplementation((duid: string, rows: ServiceArea.Progress[]) => {
			progress.set(duid, rows);
		}),
		getSelectedAreas: vi.fn().mockImplementation((duid: string) => selected.get(duid) ?? []),
		setSelectedAreas: vi.fn().mockImplementation((duid: string, ids: number[]) => {
			selected.set(duid, ids);
		}),
		getLastActivelyCleaningState: vi.fn().mockImplementation((duid: string) => lastActive.get(duid) ?? false),
		setLastActivelyCleaningState: vi.fn().mockImplementation((duid: string, value: boolean) => {
			lastActive.set(duid, value);
		}),
		consumeRestoredRunPending: vi.fn().mockImplementation(() => {
			const wasPending = pending;
			pending = false;
			return wasPending;
		}),
		clearPendingRoomResolution: vi.fn(),
		setPendingRoomResolution: vi.fn(),
		consumePendingRoomResolution: vi.fn().mockReturnValue(undefined),
		ensureAreasForMap: vi.fn().mockResolvedValue(false),
	});
	return { service, progress, selected, lastActive };
}

function createStore(overrides: Partial<CleaningRunStateStore> = {}): CleaningRunStateStore {
	return asPartial<CleaningRunStateStore>({
		save: vi.fn().mockResolvedValue(undefined),
		clear: vi.fn().mockResolvedValue(undefined),
		load: vi.fn().mockResolvedValue(undefined),
		...overrides,
	});
}

interface RobotOptions {
	pv?: string;
	activeMapId?: number;
	operationalState?: RvcOperationalState.OperationalState;
	selectedAreas?: number[];
	currentArea?: number | null;
}

/** Robot whose attributes are backed by a mutable record so handler writes are visible to later reads. */
function createRobot(options: RobotOptions = {}): { robot: RoborockVacuumCleaner; attrs: Record<string, unknown> } {
	const attrs: Record<string, unknown> = {
		operationalState: 'operationalState' in options ? options.operationalState : RUNNING,
		selectedAreas: options.selectedAreas ?? [1],
		currentArea: options.currentArea === undefined ? 1 : options.currentArea,
		supportedAreas: [],
	};
	const robot = asPartial<RoborockVacuumCleaner>({
		device: asPartial<Device>({ duid: DUID, pv: options.pv ?? ProtocolVersion.V1 }),
		homeInFo: asPartial<HomeEntity>({ activeMapId: options.activeMapId ?? MAP_ID }),
		getAttribute: vi.fn().mockImplementation((_cluster: unknown, name: string) => attrs[name]),
		updateAttribute: vi.fn().mockImplementation(async (_cluster: unknown, name: string, value: unknown) => {
			attrs[name] = value;
		}),
		buildPendingProgressSeed: vi.fn().mockReturnValue([]),
	});
	return { robot, attrs };
}

function createPlatform(
	service: RoborockService | undefined,
	store: CleaningRunStateStore | undefined,
): RoborockMatterbridgePlatform {
	return asPartial<RoborockMatterbridgePlatform>({
		log: createMockLogger(),
		configManager: asPartial<PlatformConfigManager>({
			isEstimatedEndTimeEnabled: false,
			isPersistCleaningStateEnabled: store !== undefined,
		}),
		roborockService: service,
		cleaningRunStateStore: store,
	});
}

function createMessage(
	state: OperationStatusCode,
	overrides: Partial<ServiceAreaUpdateMessage> = {},
): ServiceAreaUpdateMessage {
	return {
		duid: DUID,
		state,
		cleaningProcess: asPartial<CleanProcess>({ clean_area: 100, clean_time: 60 }),
		cleaningInfo: undefined,
		...overrides,
	};
}

describe('handleServiceAreaUpdate cleaning-run persistence', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('flag OFF (no store)', () => {
		it('should not call consumeRestoredRunPending or throw when store is undefined', async () => {
			const fake = createFakeService({ pending: true });
			const { robot } = createRobot({ operationalState: RUNNING });
			const platform = createPlatform(fake.service, undefined);

			await expect(
				handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.Cleaning), platform),
			).resolves.toBeUndefined();

			expect(fake.service.consumeRestoredRunPending).not.toHaveBeenCalled();
		});
	});

	describe('persist while actively cleaning', () => {
		it('should save a snapshot with selectedAreas, currentArea, progress, activeMapId and fingerprint when Running', async () => {
			const fake = createFakeService();
			const store = createStore();
			const { robot } = createRobot({ operationalState: RUNNING, selectedAreas: [1], currentArea: 1 });
			const platform = createPlatform(fake.service, store);

			await handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.Cleaning), platform);

			expect(store.save).toHaveBeenCalledTimes(1);
			expect(store.save).toHaveBeenCalledWith(
				DUID,
				expect.objectContaining({
					version: 1,
					duid: DUID,
					activeMapId: MAP_ID,
					areaFingerprint: '7:0:100|7:1:101|7:2:102',
					selectedAreas: [1],
					currentArea: 1,
					progress: expect.arrayContaining([expect.objectContaining({ areaId: 1 })]),
				}),
			);
		});

		it('should persist currentArea 0 as 0 (falsy-zero)', async () => {
			const fake = createFakeService();
			const store = createStore();
			const { robot } = createRobot({ operationalState: RUNNING, selectedAreas: [0], currentArea: 0 });
			const platform = createPlatform(fake.service, store);

			await handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.Cleaning), platform);

			expect(store.save).toHaveBeenCalledWith(DUID, expect.objectContaining({ currentArea: 0 }));
		});

		it('should save when Paused because paused counts as actively cleaning', async () => {
			const fake = createFakeService();
			const store = createStore();
			const { robot } = createRobot({
				operationalState: RvcOperationalState.OperationalState.Paused,
				selectedAreas: [1],
			});
			const platform = createPlatform(fake.service, store);

			await handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.Paused), platform);

			expect(store.save).toHaveBeenCalledTimes(1);
			expect(store.clear).not.toHaveBeenCalled();
		});

		it('should neither save nor clear when fingerprint is undefined', async () => {
			const fake = createFakeService({ indexMap: undefined });
			const store = createStore();
			const { robot } = createRobot({ operationalState: RUNNING, selectedAreas: [1] });
			const platform = createPlatform(fake.service, store);

			await handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.Cleaning), platform);

			expect(store.save).not.toHaveBeenCalled();
			expect(store.clear).not.toHaveBeenCalled();
		});

		it('should clear instead of save when selectedAreas and progress are both empty', async () => {
			const fake = createFakeService();
			const store = createStore();
			const { robot } = createRobot({ operationalState: RUNNING, selectedAreas: [] });
			const platform = createPlatform(fake.service, store);

			await handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.Cleaning), platform);

			expect(store.clear).toHaveBeenCalledWith(DUID);
			expect(store.save).not.toHaveBeenCalled();
		});

		it('should skip persistence for a non-V1 device', async () => {
			const fake = createFakeService();
			const store = createStore();
			const { robot } = createRobot({ pv: '1.1', operationalState: RUNNING, selectedAreas: [1] });
			const platform = createPlatform(fake.service, store);

			await handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.Cleaning), platform);

			expect(store.save).not.toHaveBeenCalled();
			expect(store.clear).not.toHaveBeenCalled();
		});

		it('should not reject when store.save throws synchronously and still run core update', async () => {
			const fake = createFakeService();
			const store = createStore({
				save: vi.fn().mockImplementation(() => {
					throw new Error('save exploded');
				}),
			});
			const { robot, attrs } = createRobot({ operationalState: RUNNING, selectedAreas: [1] });
			const platform = createPlatform(fake.service, store);

			await expect(
				handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.Cleaning), platform),
			).resolves.toBeUndefined();
			expect(attrs.progress).toEqual(expect.any(Array));
		});

		it('should not reject when getSupportedAreas throws during persist', async () => {
			const fake = createFakeService();
			vi.mocked(fake.service.getSupportedAreas).mockImplementation(() => {
				throw new Error('areas unavailable');
			});
			const store = createStore();
			const { robot } = createRobot({ operationalState: RUNNING, selectedAreas: [1] });
			const platform = createPlatform(fake.service, store);

			await expect(
				handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.Cleaning), platform),
			).resolves.toBeUndefined();
			expect(store.save).not.toHaveBeenCalled();
		});

		it('should propagate core error but still attempt persist via finally', async () => {
			const fake = createFakeService();
			const store = createStore();
			const { robot } = createRobot({ operationalState: RUNNING, selectedAreas: [1] });
			vi.mocked(robot.updateAttribute).mockRejectedValue(new Error('core write failed'));
			const platform = createPlatform(fake.service, store);

			await expect(
				handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.Cleaning), platform),
			).rejects.toThrow('core write failed');
			expect(store.save).toHaveBeenCalledTimes(1);
		});
	});

	describe('run end and no-op states', () => {
		it('should clear when Docked/Charging run end is observed', async () => {
			const fake = createFakeService();
			const store = createStore();
			const { robot } = createRobot({ operationalState: DOCKED, selectedAreas: [1] });
			const platform = createPlatform(fake.service, store);

			await handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.Charging), platform);

			expect(store.clear).toHaveBeenCalledWith(DUID);
			expect(store.save).not.toHaveBeenCalled();
		});

		it('should clear when Docked run end is observed with a non-cleaning message.state', async () => {
			const fake = createFakeService();
			const store = createStore();
			const { robot } = createRobot({ operationalState: DOCKED, selectedAreas: [1] });
			const platform = createPlatform(fake.service, store);

			await handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.ReturningDock), platform);

			expect(store.clear).toHaveBeenCalledWith(DUID);
			expect(store.save).not.toHaveBeenCalled();
		});

		it('should clear when idle message.state is received', async () => {
			const fake = createFakeService();
			const store = createStore();
			const { robot } = createRobot({ operationalState: DOCKED, selectedAreas: [] });
			const platform = createPlatform(fake.service, store);

			await handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.Idle), platform);

			expect(store.clear).toHaveBeenCalledWith(DUID);
			expect(store.save).not.toHaveBeenCalled();
		});

		it.each([
			['Error', RvcOperationalState.OperationalState.Error, OperationStatusCode.InError],
			['ReturningDock with Stopped', RvcOperationalState.OperationalState.Stopped, OperationStatusCode.ReturningDock],
			['undefined operationalState', undefined, OperationStatusCode.ReturningDock],
		])('should neither save nor clear when operationalState is %s', async (_label, operationalState, state) => {
			const fake = createFakeService();
			const store = createStore();
			const { robot } = createRobot({ operationalState, selectedAreas: [1] });
			const platform = createPlatform(fake.service, store);

			await handleServiceAreaUpdate(robot, createMessage(state), platform);

			expect(store.save).not.toHaveBeenCalled();
			expect(store.clear).not.toHaveBeenCalled();
		});
	});

	describe('restore confirm-or-discard on first update', () => {
		it('should keep restored run and skip progress reset when Running confirms the restore', async () => {
			const restoredProgress = [
				asPartial<ServiceArea.Progress>({ areaId: 1, status: ServiceArea.OperationalStatus.Operating }),
			];
			const fake = createFakeService({ pending: true });
			fake.progress.set(DUID, restoredProgress);
			fake.lastActive.set(DUID, true);
			const store = createStore();
			const { robot } = createRobot({ operationalState: RUNNING, selectedAreas: [1] });
			const platform = createPlatform(fake.service, store);

			await handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.Cleaning), platform);

			expect(robot.buildPendingProgressSeed).not.toHaveBeenCalled();
			expect(robot.updateAttribute).not.toHaveBeenCalledWith(ServiceArea.id, 'progress', [], expect.anything());
			expect(fake.service.setLastActivelyCleaningState).toHaveBeenCalledWith(DUID, true);
		});

		it('should keep restored run when only message.state reports cleaning while operationalState attr is Docked', async () => {
			const fake = createFakeService({ pending: true });
			fake.lastActive.set(DUID, true);
			const store = createStore();
			const { robot } = createRobot({ operationalState: DOCKED, selectedAreas: [1] });
			const platform = createPlatform(fake.service, store);

			await handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.Cleaning), platform);

			expect(fake.service.setLastActivelyCleaningState).toHaveBeenCalledWith(DUID, true);
			expect(fake.lastActive.get(DUID)).toBe(true);
			expect(robot.updateAttribute).not.toHaveBeenCalledWith(ServiceArea.id, 'currentArea', null, expect.anything());
			expect(robot.updateAttribute).not.toHaveBeenCalledWith(
				ServiceArea.id,
				'estimatedEndTime',
				null,
				expect.anything(),
			);
		});

		it('should not clear store when confirmed restore has cleaning message.state while operationalState attr is Docked', async () => {
			const fake = createFakeService({ pending: true });
			fake.lastActive.set(DUID, true);
			const store = createStore();
			const { robot } = createRobot({ operationalState: DOCKED, selectedAreas: [1] });
			const platform = createPlatform(fake.service, store);

			await handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.Cleaning), platform);

			expect(store.clear).not.toHaveBeenCalled();
		});

		it('should discard restored run when Docked and idle message.state arrive first', async () => {
			const fake = createFakeService({ pending: true });
			fake.progress.set(DUID, [
				asPartial<ServiceArea.Progress>({ areaId: 1, status: ServiceArea.OperationalStatus.Operating }),
			]);
			fake.selected.set(DUID, [1]);
			fake.lastActive.set(DUID, true);
			const store = createStore();
			const { robot, attrs } = createRobot({ operationalState: DOCKED, selectedAreas: [1], currentArea: 1 });
			const platform = createPlatform(fake.service, store);

			await handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.Idle), platform);

			expect(fake.lastActive.get(DUID)).toBe(false);
			expect(fake.progress.get(DUID)).toEqual([]);
			expect(fake.selected.get(DUID)).toEqual([]);
			expect(attrs.progress).toEqual([]);
			expect(attrs.selectedAreas).toEqual([]);
			expect(attrs.currentArea).toBeNull();
			expect(store.clear).toHaveBeenCalledWith(DUID);
			expect(store.save).not.toHaveBeenCalled();
		});

		it('should only consume the pending flag once across updates', async () => {
			const fake = createFakeService({ pending: true });
			const store = createStore();
			const { robot } = createRobot({ operationalState: RUNNING, selectedAreas: [1] });
			const platform = createPlatform(fake.service, store);

			await handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.Cleaning), platform);
			await handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.Cleaning), platform);

			expect(fake.service.consumeRestoredRunPending).toHaveBeenCalledTimes(2);
			expect(vi.mocked(fake.service.consumeRestoredRunPending).mock.results.map((r) => r.value)).toEqual([true, false]);
		});

		it('should not consume pending when store is undefined even if a restore is pending', async () => {
			const fake = createFakeService({ pending: true });
			const { robot } = createRobot({ operationalState: DOCKED, selectedAreas: [] });
			const platform = createPlatform(fake.service, undefined);

			await handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.Idle), platform);

			expect(fake.service.consumeRestoredRunPending).not.toHaveBeenCalled();
		});

		it('should seed Pending progress on a normal not-cleaning to cleaning transition when no restore is pending', async () => {
			const fake = createFakeService({ pending: false });
			const store = createStore();
			const seed = [asPartial<ServiceArea.Progress>({ areaId: 1, status: ServiceArea.OperationalStatus.Pending })];
			const { robot } = createRobot({ operationalState: RUNNING, selectedAreas: [1] });
			vi.mocked(robot.buildPendingProgressSeed).mockReturnValue(seed);
			const platform = createPlatform(fake.service, store);

			await handleServiceAreaUpdate(robot, createMessage(OperationStatusCode.Cleaning), platform);

			expect(robot.buildPendingProgressSeed).toHaveBeenCalled();
			expect(fake.service.setProgress).toHaveBeenCalledWith(DUID, expect.any(Array));
		});
	});

	describe('handleActiveMapChanged with restored run', () => {
		it('should discard restored run before the normal map-change reset when pending', async () => {
			const areas = [asPartial<ServiceArea.Area>({ areaId: 5, mapId: 200 })];
			const fake = createFakeService({ areas, pending: true });
			fake.lastActive.set(DUID, true);
			const store = createStore();
			const { robot, attrs } = createRobot({ operationalState: undefined, selectedAreas: [1] });
			attrs.supportedAreas = [asPartial<ServiceArea.Area>({ areaId: 5, mapId: 200 })];
			const platform = createPlatform(fake.service, store);

			await handleActiveMapChanged(robot, 200, platform);

			expect(store.clear).toHaveBeenCalledWith(DUID);
			expect(fake.lastActive.get(DUID)).toBe(false);
			expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'selectedAreas', [5], expect.anything());
		});

		it('should leave restored state untouched beyond the normal path when not pending', async () => {
			const areas = [asPartial<ServiceArea.Area>({ areaId: 5, mapId: 200 })];
			const fake = createFakeService({ areas, pending: false });
			const store = createStore();
			const { robot, attrs } = createRobot({ operationalState: undefined, selectedAreas: [1] });
			attrs.supportedAreas = [asPartial<ServiceArea.Area>({ areaId: 5, mapId: 200 })];
			const platform = createPlatform(fake.service, store);

			await handleActiveMapChanged(robot, 200, platform);

			expect(store.clear).not.toHaveBeenCalled();
			expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.id, 'selectedAreas', [5], expect.anything());
		});
	});
});
