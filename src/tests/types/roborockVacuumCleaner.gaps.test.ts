import type { AnsiLogger } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ROUTINE_MAP_ID, SCENE_AREA_ID_MIN } from '../../constants/ids.js';
import { MapInfo } from '../../core/application/models/MapInfo.js';
import { RoomMap } from '../../core/application/models/RoomMap.js';
import { HomeEntity } from '../../core/domain/entities/Home.js';
import {
	AdvancedFeatureConfiguration,
	AdvancedFeatureSetting,
	PluginConfiguration,
	RoborockPluginPlatformConfig,
} from '../../model/RoborockPluginPlatformConfig.js';
import { PlatformConfigManager } from '../../platform/platformConfigManager.js';
import { type Device, DeviceModel, type Scene } from '../../roborockCommunication/models/index.js';
import type { RoborockService } from '../../services/roborockService.js';
import type { BehaviorFactoryResult } from '../../share/behaviorFactory.js';
import type { RestoredRunSeed } from '../../share/cleaningRunSnapshot.js';
import { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';
import { asPartial, asType, createMockLogger } from '../helpers/testUtils.js';

function createMockDevice(scenes?: Scene[]): Device {
	return asPartial<Device>({
		duid: 'duid-gap',
		pv: '1.0',
		specs: asPartial<Device['specs']>({ model: DeviceModel.S7, firmwareVersion: '1.0.0' }),
		serialNumber: 'serial-gap',
		name: 'GapVac',
		scenes,
	});
}

function createMockRoborockService(): RoborockService {
	return asPartial<RoborockService>({
		setSupportedRoutines: vi.fn(),
		setSupportedAreas: vi.fn(),
		setSupportedAreaIndexMap: vi.fn(),
		getSupportedAreas: vi.fn().mockReturnValue([]),
		getProgress: vi.fn().mockReturnValue([]),
		setProgress: vi.fn(),
		switchMap: vi.fn().mockResolvedValue(undefined),
	});
}

function createMockHomeInfo(activeMapId: number): HomeEntity {
	return new HomeEntity(1, 'Gap Home', new RoomMap([]), MapInfo.empty(), activeMapId);
}

function createMockConfigManager(showRoutinesAsRoom: boolean): PlatformConfigManager {
	return PlatformConfigManager.create(
		asPartial<RoborockPluginPlatformConfig>({
			pluginConfiguration: asPartial<PluginConfiguration>({ enableMultipleMap: false, enableServerMode: false }),
			advancedFeature: asPartial<AdvancedFeatureConfiguration>({
				enableAdvancedFeature: true,
				settings: asPartial<AdvancedFeatureSetting>({ showRoutinesAsRoom }),
			}),
		}),
		createMockLogger(),
	);
}

function createMockBehaviorHandler(log: AnsiLogger): BehaviorFactoryResult {
	return {
		executeCommand: vi.fn(),
		setCommandHandler: vi.fn(),
		log,
		commands: {},
	} satisfies BehaviorFactoryResult;
}

describe('RoborockVacuumCleaner gap coverage', () => {
	let logger: AnsiLogger;
	let roborockService: RoborockService;

	interface BuildOptions {
		activeMapId?: number;
		scenes?: Scene[];
		showRoutines?: boolean;
		restoredRun?: RestoredRunSeed;
	}

	function buildVacuum(options: BuildOptions = {}): RoborockVacuumCleaner {
		const vacuum = new RoborockVacuumCleaner(
			createMockDevice(options.scenes),
			createMockHomeInfo(options.activeMapId ?? -1),
			createMockConfigManager(options.showRoutines ?? false),
			roborockService,
			logger,
			[],
			[],
			options.restoredRun,
		);
		vi.spyOn(vacuum.log, 'info').mockImplementation(() => {});
		vi.spyOn(vacuum.log, 'error').mockImplementation(() => {});
		return vacuum;
	}

	beforeEach(() => {
		vi.clearAllMocks();
		logger = createMockLogger();
		roborockService = createMockRoborockService();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('createDefaultServiceAreaClusterServer defaults', () => {
		it('should seed the demo areas, empty selection, currentArea 1 and empty progress when called without arguments', () => {
			const vacuum = buildVacuum();
			const requireSpy = vi.spyOn(vacuum.behaviors, 'require');

			vacuum.createDefaultServiceAreaClusterServer();

			expect(requireSpy).toHaveBeenCalledTimes(1);
			expect(requireSpy.mock.calls[0][1]).toMatchObject({
				supportedAreas: [
					{ areaId: 1, mapId: null },
					{ areaId: 2, mapId: null },
					{ areaId: 3, mapId: null },
					{ areaId: 4, mapId: null },
				],
				selectedAreas: [],
				currentArea: 1,
				supportedMaps: [],
				progress: [],
			});
		});

		it('should pass an explicit currentArea of null through instead of defaulting to 1', () => {
			const vacuum = buildVacuum();
			const requireSpy = vi.spyOn(vacuum.behaviors, 'require');

			vacuum.createDefaultServiceAreaClusterServer(undefined, [7], null);

			expect(requireSpy.mock.calls[0][1]).toMatchObject({ selectedAreas: [7], currentArea: null });
		});
	});

	describe('configureHandler commands', () => {
		it('should execute identify with a default 5 second time when identifyTime is omitted', async () => {
			const vacuum = buildVacuum();
			const behaviorHandler = createMockBehaviorHandler(logger);
			vacuum.configureHandler(behaviorHandler);

			await vacuum.executeCommandHandler('identify', asType<never>({}), 'identify', asType<never>({}), vacuum);

			expect(behaviorHandler.executeCommand).toHaveBeenCalledWith('identify', 5);
		});

		it('should execute selectAreas with an empty list when newAreas is omitted', async () => {
			const vacuum = buildVacuum();
			const behaviorHandler = createMockBehaviorHandler(logger);
			vacuum.configureHandler(behaviorHandler);

			await vacuum.executeCommandHandler('selectAreas', asType<never>({}), 'serviceArea', asType<never>({}), vacuum);

			expect(behaviorHandler.executeCommand).toHaveBeenCalledWith('selectAreas', []);
		});

		it('should log and execute the stop command when stop is received', async () => {
			const vacuum = buildVacuum();
			const behaviorHandler = createMockBehaviorHandler(logger);
			vacuum.configureHandler(behaviorHandler);

			await vacuum.executeCommandHandler('stop', {}, 'operationalState', asType<never>({}), vacuum);

			expect(vacuum.log.info).toHaveBeenCalledWith('Stop command received');
			expect(behaviorHandler.executeCommand).toHaveBeenCalledWith('stop');
		});
	});

	describe('showRoutinesAsRoom routine seeding', () => {
		it('should register an empty routine list and no Routine map when scenes are undefined', () => {
			buildVacuum({ showRoutines: true });

			expect(roborockService.setSupportedRoutines).toHaveBeenCalledWith('duid-gap', []);
		});

		it('should append a Routine map and routine areas with ROUTINE_MAP_ID when scenes exist', () => {
			const spy = vi.spyOn(RoborockVacuumCleaner.prototype, 'createDefaultServiceAreaClusterServer');
			const scenes = [asPartial<Scene>({ id: 3, name: 'Night', enabled: true })];

			buildVacuum({ showRoutines: true, scenes });

			const expectedAreaId = SCENE_AREA_ID_MIN + 3;
			expect(roborockService.setSupportedRoutines).toHaveBeenCalledWith('duid-gap', [
				expect.objectContaining({ areaId: expectedAreaId, mapId: ROUTINE_MAP_ID }),
			]);
			expect(spy.mock.calls[0][0]).toEqual([
				expect.objectContaining({ areaId: expectedAreaId, mapId: ROUTINE_MAP_ID }),
			]);
			expect(spy.mock.calls[0][3]).toEqual([{ mapId: ROUTINE_MAP_ID, name: 'Routine' }]);
		});
	});

	describe('buildPendingProgressSeed with undefined selection', () => {
		it('should fall back to all rooms of the active map when selectedAreas attribute is undefined', () => {
			const vacuum = buildVacuum();
			vi.spyOn(vacuum, 'getAttribute').mockReturnValue(undefined);
			const resolveSpy = vi.spyOn(vacuum, 'resolveAllRoomsForActiveMap').mockReturnValue([5]);

			const result = vacuum.buildPendingProgressSeed();

			expect(resolveSpy).toHaveBeenCalledTimes(1);
			expect(result).toEqual([{ areaId: 5, status: ServiceArea.OperationalStatus.Pending }]);
		});
	});

	describe('finalizeSkipArea with undefined selection', () => {
		it('should clear currentArea to null when selectedAreas attribute is undefined', async () => {
			const vacuum = buildVacuum();
			vi.spyOn(vacuum, 'getAttribute').mockReturnValue(undefined);
			const updateSpy = vi.spyOn(vacuum, 'updateAttribute').mockResolvedValue(true);

			const result = await vacuum.finalizeSkipArea(3);

			expect(result.nextAreaId).toBeNull();
			expect(roborockService.setProgress).toHaveBeenCalledWith('duid-gap', result.updatedProgress);
			expect(updateSpy).toHaveBeenCalledWith(ServiceArea.id, 'currentArea', null, expect.anything());
		});
	});

	describe('trySwitchMap', () => {
		it('should not switch when the selected area is not in supportedAreas', async () => {
			const vacuum = buildVacuum();
			vi.mocked(roborockService.getSupportedAreas).mockReturnValue([
				asPartial<ServiceArea.Area>({ areaId: 1, mapId: 3 }),
			]);

			await vacuum.trySwitchMap([9]);

			expect(roborockService.switchMap).not.toHaveBeenCalled();
		});

		it('should not switch when the matched area has a null mapId', async () => {
			const vacuum = buildVacuum();
			vi.mocked(roborockService.getSupportedAreas).mockReturnValue([
				asPartial<ServiceArea.Area>({ areaId: 1, mapId: null }),
			]);

			await vacuum.trySwitchMap([1]);

			expect(roborockService.switchMap).not.toHaveBeenCalled();
		});

		it('should not switch when the target map is already the active map', async () => {
			const vacuum = buildVacuum({ activeMapId: 7 });
			vi.mocked(roborockService.getSupportedAreas).mockReturnValue([
				asPartial<ServiceArea.Area>({ areaId: 1, mapId: 7 }),
			]);

			await vacuum.trySwitchMap([1]);

			expect(roborockService.switchMap).not.toHaveBeenCalled();
		});

		it('should switch to the target map and log when it differs from the active map', async () => {
			const vacuum = buildVacuum({ activeMapId: -1 });
			vi.mocked(roborockService.getSupportedAreas).mockReturnValue([
				asPartial<ServiceArea.Area>({ areaId: 1, mapId: 3 }),
			]);

			await vacuum.trySwitchMap([1]);

			expect(roborockService.switchMap).toHaveBeenCalledWith('duid-gap', 3);
			expect(vacuum.log.info).toHaveBeenCalledWith('[duid-gap] Switching map from -1 to 3');
		});

		it('should switch to map 0 because a falsy map id is still a valid target', async () => {
			const vacuum = buildVacuum({ activeMapId: -1 });
			vi.mocked(roborockService.getSupportedAreas).mockReturnValue([
				asPartial<ServiceArea.Area>({ areaId: 1, mapId: 0 }),
			]);

			await vacuum.trySwitchMap([1]);

			expect(roborockService.switchMap).toHaveBeenCalledWith('duid-gap', 0);
		});

		it('should log an error and not throw when switchMap rejects', async () => {
			const vacuum = buildVacuum({ activeMapId: -1 });
			vi.mocked(roborockService.getSupportedAreas).mockReturnValue([
				asPartial<ServiceArea.Area>({ areaId: 1, mapId: 3 }),
			]);
			vi.mocked(roborockService.switchMap).mockRejectedValueOnce(new Error('boom'));

			await expect(vacuum.trySwitchMap([1])).resolves.toBeUndefined();

			expect(vacuum.log.error).toHaveBeenCalledWith('[duid-gap] Failed to switch map: Error: boom');
		});
	});

	describe('resolveAllRoomsForActiveMap fallbacks', () => {
		const twoMapAreas = [
			asPartial<ServiceArea.Area>({ areaId: 1, mapId: 0 }),
			asPartial<ServiceArea.Area>({ areaId: 2, mapId: 0 }),
			asPartial<ServiceArea.Area>({ areaId: 3, mapId: 1 }),
		];

		it('should use the first area map when the selectedAreas attribute is undefined and no active map is known', () => {
			const vacuum = buildVacuum({ activeMapId: -1 });
			vi.mocked(roborockService.getSupportedAreas).mockReturnValue(twoMapAreas);
			vi.spyOn(vacuum, 'getAttribute').mockReturnValue(undefined);

			expect(vacuum.resolveAllRoomsForActiveMap()).toEqual([1, 2]);
		});

		it('should use the first area map when homeInfo.activeMapId is not present in supportedAreas', () => {
			const vacuum = buildVacuum({ activeMapId: 9 });
			vi.mocked(roborockService.getSupportedAreas).mockReturnValue(twoMapAreas);
			vi.spyOn(vacuum, 'getAttribute').mockReturnValue([]);

			expect(vacuum.resolveAllRoomsForActiveMap()).toEqual([1, 2]);
		});
	});
});
