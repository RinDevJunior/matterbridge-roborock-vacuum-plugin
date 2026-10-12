import type { MatterbridgeDynamicPlatform } from 'matterbridge';
import type { AnsiLogger } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoomIndexMap } from '../../core/application/models/index.js';
import { DeviceConfigurator } from '../../platform/deviceConfigurator.js';
import type { DeviceRegistry } from '../../platform/deviceRegistry.js';
import type { PlatformConfigManager } from '../../platform/platformConfigManager.js';
import type { PlatformRunner } from '../../platformRunner.js';
import { ProtocolVersion } from '../../roborockCommunication/enums/index.js';
import { type Device, DeviceModel, DeviceSpecs } from '../../roborockCommunication/models/index.js';
import type { CleaningRunStateStore } from '../../services/cleaningRunStateStore.js';
import type { RoborockService } from '../../services/roborockService.js';
import { CLEANING_RUN_SNAPSHOT_VERSION, type CleaningRunSnapshot } from '../../share/cleaningRunSnapshot.js';
import { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';
import type { WssSendSnackbarMessage } from '../../types/WssSendSnackbarMessage.js';
import {
	asPartial,
	createMockConfigManager,
	createMockDeviceRegistry,
	createMockLogger,
	createMockRoborockService,
} from '../helpers/testUtils.js';

vi.mock('../../share/behaviorFactory.js', () => ({
	configureBehavior: vi.fn().mockReturnValue({
		onBatteryUpdate: vi.fn(),
		onStatusChanged: vi.fn(),
		onCleanModeUpdate: vi.fn(),
		onServiceAreaUpdate: vi.fn(),
		onError: vi.fn(),
		onAdditionalProps: vi.fn(),
	}),
}));

vi.mock('../../types/roborockVacuumCleaner.js', () => ({
	RoborockVacuumCleaner: vi.fn(function (this: Record<string, unknown>, device: Device) {
		this.device = device;
		this.deviceName = `Roborock-${device.duid}`;
		this.serialNumber = device.serialNumber ?? device.duid;
		this.configureHandler = vi.fn();
		this.getClusterServerOptions = vi.fn().mockReturnValue({
			softwareVersion: 1,
			softwareVersionString: '1.0.0',
			hardwareVersion: 1,
			hardwareVersionString: '1.0.0',
			deviceTypeList: [],
		});
		this.createDefaultIdentifyClusterServer = vi.fn();
		this.createDefaultBridgedDeviceBasicInformationClusterServer = vi.fn();
		this.mode = undefined;
		this.deviceTypes = new Map();
		this.softwareVersion = 1;
		this.softwareVersionString = '1.0.0';
		this.hardwareVersion = 1;
		this.hardwareVersionString = '1.0.0';
		this.vendorName = 'Matterbridge';
		this.productName = 'Roborock';
		this.vendorId = 65521;
		this.productId = 32768;
	}),
}));

const DUID = 'duid-restore';
const MAP_ID = 7;
const AREA_FINGERPRINT = '7:1:101|7:2:102';

function makeDevice(duid: string, pv: string = ProtocolVersion.V1): Device {
	return asPartial<Device>({
		duid,
		name: `Vacuum-${duid}`,
		rrHomeId: 1,
		pv,
		serialNumber: 'serial-restore',
		fv: '1.0.0',
		specs: asPartial<DeviceSpecs>({ model: DeviceModel.S7, firmwareVersion: '1.0.0' }),
		store: asPartial<Device['store']>({
			homeData: { id: 1, name: 'Home', rooms: [], products: [], devices: [], receivedDevices: [] },
		}),
	});
}

function makeAreas(): ServiceArea.Area[] {
	return [
		asPartial<ServiceArea.Area>({ areaId: 1, mapId: MAP_ID }),
		asPartial<ServiceArea.Area>({ areaId: 2, mapId: MAP_ID }),
	];
}

function makeIndexMap(): RoomIndexMap {
	return asPartial<RoomIndexMap>({ getRoomId: (areaId: number) => areaId + 100 });
}

function makeSnapshot(overrides: Partial<CleaningRunSnapshot> = {}): CleaningRunSnapshot {
	return {
		version: CLEANING_RUN_SNAPSHOT_VERSION,
		duid: DUID,
		savedAtMs: Date.now(),
		activeMapId: MAP_ID,
		areaFingerprint: AREA_FINGERPRINT,
		selectedAreas: [1, 2],
		currentArea: 1,
		progress: [
			{ areaId: 1, status: ServiceArea.OperationalStatus.Operating },
			{ areaId: 2, status: ServiceArea.OperationalStatus.Pending },
		],
		...overrides,
	};
}

describe('DeviceConfigurator cleaning-run restore', () => {
	let log: AnsiLogger;
	let configManager: PlatformConfigManager;
	let platformRunner: PlatformRunner;
	let platform: MatterbridgeDynamicPlatform & { cleaningRunStateStore?: CleaningRunStateStore };
	let roborockService: RoborockService;
	let snackbarMessage: WssSendSnackbarMessage;
	let store: CleaningRunStateStore;

	function buildConfigurator(device: Device): DeviceConfigurator {
		const registry: DeviceRegistry = createMockDeviceRegistry({
			hasDevices: vi.fn().mockReturnValue(true),
			getAllDevices: vi.fn().mockReturnValue([device]),
		});
		return new DeviceConfigurator(platform, configManager, registry, () => platformRunner, snackbarMessage, log);
	}

	function createService(overrides: Partial<RoborockService> = {}): RoborockService {
		return createMockRoborockService({
			resolveInitialAreas: vi.fn().mockResolvedValue({ supportedAreas: makeAreas(), supportedMaps: [] }),
			getSupportedAreas: vi.fn().mockReturnValue(makeAreas()),
			getSupportedAreasIndexMap: vi.fn().mockReturnValue(makeIndexMap()),
			initializeMessageClientForLocal: vi.fn().mockResolvedValue(true),
			registerAreasListener: vi.fn(),
			startPeriodicAreaRefresh: vi.fn(),
			setDeviceNotify: vi.fn(),
			activateDeviceNotify: vi.fn(),
			setSelectedAreas: vi.fn(),
			setProgress: vi.fn(),
			setLastActivelyCleaningState: vi.fn(),
			markRestoredRunPending: vi.fn(),
			...overrides,
		});
	}

	beforeEach(() => {
		vi.clearAllMocks();
		log = createMockLogger();
		snackbarMessage = vi.fn() as unknown as WssSendSnackbarMessage;
		configManager = createMockConfigManager({
			isCustomCleanModeMappingEnabled: false,
			forceRunAtDefault: false,
			overrideMatterConfiguration: false,
		});
		Object.defineProperty(configManager, 'cleanModeSettings', { get: () => ({}), configurable: true });
		platformRunner = asPartial<PlatformRunner>({
			updateRobotWithPayload: vi.fn(),
			requestHomeData: vi.fn().mockResolvedValue(undefined),
			activateHandlerFunctions: vi.fn(),
		});
		store = asPartial<CleaningRunStateStore>({
			load: vi.fn().mockResolvedValue(undefined),
			clear: vi.fn().mockResolvedValue(undefined),
		});
		platform = asPartial<MatterbridgeDynamicPlatform & { cleaningRunStateStore?: CleaningRunStateStore }>({
			version: '1.0.0',
			matterbridge: asPartial<MatterbridgeDynamicPlatform['matterbridge']>({ matterbridgeVersion: '3.5.5' }),
			log: createMockLogger(),
			validateDevice: vi.fn().mockReturnValue(true),
			setSelectDevice: vi.fn(),
			registerDevice: vi.fn().mockResolvedValue(undefined),
			onConfigChanged: vi.fn().mockResolvedValue(undefined),
			cleaningRunStateStore: store,
		});
		roborockService = createService();
	});

	it('should not call load and pass undefined restore seed when store is undefined', async () => {
		platform.cleaningRunStateStore = undefined;
		const configurator = buildConfigurator(makeDevice(DUID));

		await configurator.onConfigureDevice(roborockService);

		expect(store.load).not.toHaveBeenCalled();
		expect(vi.mocked(RoborockVacuumCleaner).mock.calls[0][7]).toBeUndefined();
		expect(roborockService.setSelectedAreas).not.toHaveBeenCalled();
		expect(roborockService.markRestoredRunPending).not.toHaveBeenCalled();
	});

	it('should not call load when device protocol is not V1', async () => {
		const configurator = buildConfigurator(makeDevice(DUID, '1.1'));

		await configurator.onConfigureDevice(roborockService);

		expect(store.load).not.toHaveBeenCalled();
		expect(roborockService.markRestoredRunPending).not.toHaveBeenCalled();
	});

	it('should run fresh path without seeding when load returns undefined', async () => {
		const configurator = buildConfigurator(makeDevice(DUID));

		await configurator.onConfigureDevice(roborockService);

		expect(store.load).toHaveBeenCalledWith(DUID);
		expect(vi.mocked(RoborockVacuumCleaner).mock.calls[0][7]).toBeUndefined();
		expect(roborockService.setSelectedAreas).not.toHaveBeenCalled();
		expect(roborockService.markRestoredRunPending).not.toHaveBeenCalled();
		expect(store.clear).not.toHaveBeenCalled();
	});

	it('should pass seed as 8th ctor arg and seed mirror state when snapshot is valid', async () => {
		vi.mocked(store.load).mockResolvedValue(makeSnapshot());
		const configurator = buildConfigurator(makeDevice(DUID));

		await configurator.onConfigureDevice(roborockService);

		expect(vi.mocked(RoborockVacuumCleaner).mock.calls[0][7]).toEqual({
			activeMapId: MAP_ID,
			selectedAreas: [1, 2],
			currentArea: 1,
			progress: [
				{ areaId: 1, status: ServiceArea.OperationalStatus.Operating },
				{ areaId: 2, status: ServiceArea.OperationalStatus.Pending },
			],
		});
		expect(roborockService.setSelectedAreas).toHaveBeenCalledTimes(1);
		expect(roborockService.setSelectedAreas).toHaveBeenCalledWith(DUID, [1, 2]);
		expect(roborockService.setProgress).toHaveBeenCalledTimes(1);
		expect(roborockService.setLastActivelyCleaningState).toHaveBeenCalledTimes(1);
		expect(roborockService.setLastActivelyCleaningState).toHaveBeenCalledWith(DUID, true);
		expect(roborockService.markRestoredRunPending).toHaveBeenCalledTimes(1);
		expect(roborockService.markRestoredRunPending).toHaveBeenCalledWith(DUID);
	});

	it('should set homeInfo.activeMapId from the snapshot when it is not -1', async () => {
		vi.mocked(store.load).mockResolvedValue(makeSnapshot({ activeMapId: MAP_ID }));
		const configurator = buildConfigurator(makeDevice(DUID));

		await configurator.onConfigureDevice(roborockService);

		const homeInfo = vi.mocked(RoborockVacuumCleaner).mock.calls[0][1];
		expect(homeInfo.activeMapId).toBe(MAP_ID);
	});

	it('should keep homeInfo.activeMapId at -1 when snapshot activeMapId is -1', async () => {
		vi.mocked(store.load).mockResolvedValue(makeSnapshot({ activeMapId: -1 }));
		const configurator = buildConfigurator(makeDevice(DUID));

		await configurator.onConfigureDevice(roborockService);

		const homeInfo = vi.mocked(RoborockVacuumCleaner).mock.calls[0][1];
		expect(homeInfo.activeMapId).toBe(-1);
		expect(roborockService.markRestoredRunPending).toHaveBeenCalledWith(DUID);
	});

	it.each([
		['fingerprint mismatch', { areaFingerprint: '7:1:999' }, 'room list changed'],
		['stale snapshot', { savedAtMs: Date.now() - 4 * 60 * 60 * 1000 }, 'snapshot too old'],
		['unknown area id', { selectedAreas: [1, 42] }, 'unknown area id'],
	] as [string, Partial<CleaningRunSnapshot>, string][])(
		'should clear store and continue fresh when snapshot is invalid (%s)',
		async (_label, overrides) => {
			vi.mocked(store.load).mockResolvedValue(makeSnapshot(overrides));
			const configurator = buildConfigurator(makeDevice(DUID));

			const result = await configurator['configureDevice'](makeDevice(DUID), roborockService);

			expect(store.clear).toHaveBeenCalledWith(DUID);
			expect(vi.mocked(RoborockVacuumCleaner).mock.calls[0][7]).toBeUndefined();
			expect(roborockService.markRestoredRunPending).not.toHaveBeenCalled();
			expect(result).toBe(true);
		},
	);

	it('should warn and continue fresh when load rejects', async () => {
		vi.mocked(store.load).mockRejectedValue(new Error('disk read failed'));
		const configurator = buildConfigurator(makeDevice(DUID));

		const result = await configurator['configureDevice'](makeDevice(DUID), roborockService);

		expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('disk read failed'));
		expect(vi.mocked(RoborockVacuumCleaner).mock.calls[0][7]).toBeUndefined();
		expect(result).toBe(true);
	});

	it('should warn and continue fresh when building the area fingerprint throws', async () => {
		vi.mocked(store.load).mockResolvedValue(makeSnapshot());
		roborockService = createService({
			getSupportedAreasIndexMap: vi.fn().mockImplementation(() => {
				throw new Error('index map unavailable');
			}),
		});
		const configurator = buildConfigurator(makeDevice(DUID));

		const result = await configurator['configureDevice'](makeDevice(DUID), roborockService);

		expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('index map unavailable'));
		expect(vi.mocked(RoborockVacuumCleaner).mock.calls[0][7]).toBeUndefined();
		expect(result).toBe(true);
	});
});
