import type { AnsiLogger } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MapInfo } from '../../core/application/models/MapInfo.js';
import { RoomMap } from '../../core/application/models/RoomMap.js';
import { HomeEntity } from '../../core/domain/entities/Home.js';
import type { PluginConfiguration, RoborockPluginPlatformConfig } from '../../model/RoborockPluginPlatformConfig.js';
import { PlatformConfigManager } from '../../platform/platformConfigManager.js';
import { type Device, DeviceModel } from '../../roborockCommunication/models/index.js';
import type { RoborockService } from '../../services/roborockService.js';
import type { RestoredRunSeed } from '../../share/cleaningRunSnapshot.js';
import { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';
import { asPartial, createMockLogger } from '../helpers/testUtils.js';

const seed: RestoredRunSeed = {
	activeMapId: 7,
	selectedAreas: [1, 2],
	currentArea: 2,
	progress: [
		{ areaId: 1, status: ServiceArea.OperationalStatus.Completed },
		{ areaId: 2, status: ServiceArea.OperationalStatus.Operating },
	],
};

describe('RoborockVacuumCleaner restored-run seeding (8th ctor arg)', () => {
	let device: Device;
	let homeInfo: HomeEntity;
	let logger: AnsiLogger;
	let configManager: PlatformConfigManager;
	let roborockService: RoborockService;

	function build(restoredRun?: RestoredRunSeed): RoborockVacuumCleaner {
		return new RoborockVacuumCleaner(
			device,
			homeInfo,
			configManager,
			roborockService,
			logger,
			[asPartial<ServiceArea.Area>({ areaId: 1, mapId: 7 }), asPartial<ServiceArea.Area>({ areaId: 2, mapId: 7 })],
			[],
			restoredRun,
		);
	}

	beforeEach(() => {
		vi.clearAllMocks();
		device = asPartial<Device>({
			duid: 'duid-seed',
			pv: '1.0',
			specs: asPartial<Device['specs']>({ model: DeviceModel.S7, firmwareVersion: '1.0.0' }),
			serialNumber: 'serial-seed',
			name: 'SeedVac',
			scenes: [],
		});
		homeInfo = new HomeEntity(1, 'Seed Home', new RoomMap([]), MapInfo.empty(), -1);
		logger = createMockLogger();
		configManager = PlatformConfigManager.create(
			asPartial<RoborockPluginPlatformConfig>({
				pluginConfiguration: asPartial<PluginConfiguration>({ enableMultipleMap: false, enableServerMode: false }),
			}),
			createMockLogger(),
		);
		roborockService = asPartial<RoborockService>({
			setSupportedRoutines: vi.fn(),
			setSupportedAreas: vi.fn(),
			setSupportedAreaIndexMap: vi.fn(),
			getSupportedAreas: vi.fn().mockReturnValue([]),
			getProgress: vi.fn().mockReturnValue([]),
			setProgress: vi.fn(),
			switchMap: vi.fn().mockResolvedValue(undefined),
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	/** Captures the ServiceArea seed the constructor hands to the cluster server builder. */
	function captureServiceAreaSeed(restoredRun?: RestoredRunSeed): {
		selectedAreas: number[] | undefined;
		currentArea: number | null | undefined;
		progress: ServiceArea.Progress[] | undefined;
	} {
		const spy = vi.spyOn(RoborockVacuumCleaner.prototype, 'createDefaultServiceAreaClusterServer');
		build(restoredRun);
		const args = spy.mock.calls[0];
		return { selectedAreas: args[1], currentArea: args[2], progress: args[4] };
	}

	it('should pass empty selectedAreas, null currentArea and empty progress without a seed', () => {
		const captured = captureServiceAreaSeed();

		expect(captured.selectedAreas).toBeUndefined();
		expect(captured.currentArea).toBeNull();
		expect(captured.progress).toEqual([]);
	});

	it('should pass the restored selectedAreas, currentArea and progress as the seed', () => {
		const captured = captureServiceAreaSeed(seed);

		expect(captured.selectedAreas).toEqual([1, 2]);
		expect(captured.currentArea).toBe(2);
		expect(captured.progress).toEqual(seed.progress);
	});

	it('should pass a seeded currentArea of 0 through unchanged (falsy-zero)', () => {
		const captured = captureServiceAreaSeed({ ...seed, selectedAreas: [0], currentArea: 0, progress: [] });

		expect(captured.currentArea).toBe(0);
	});
});
