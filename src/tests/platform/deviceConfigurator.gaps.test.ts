import type { MatterbridgeDynamicPlatform } from 'matterbridge';
import type { AnsiLogger } from 'matterbridge/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MatterOverrideSettings } from '../../model/RoborockPluginPlatformConfig.js';
import { DeviceConfigurator } from '../../platform/deviceConfigurator.js';
import type { DeviceRegistry } from '../../platform/deviceRegistry.js';
import type { PlatformConfigManager } from '../../platform/platformConfigManager.js';
import type { PlatformRunner } from '../../platformRunner.js';
import { type Device, DeviceModel, DeviceSpecs } from '../../roborockCommunication/models/index.js';
import type { RoborockService } from '../../services/roborockService.js';
import { configureBehavior } from '../../share/behaviorFactory.js';
import { NotifyMessageTypes } from '../../types/notifyMessageTypes.js';
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
		// Nameless devices yield an undefined deviceName so the configurator's `?? ''` arm is reachable.
		this.deviceName = device.name ? `Roborock-${device.duid}` : undefined;
		this.serialNumber = device.serialNumber ?? device.duid;
		this.configureHandler = vi.fn();
		this.getClusterServerOptions = vi.fn().mockReturnValue({
			softwareVersion: 1,
			softwareVersionString: '1.0.0',
			hardwareVersion: 1,
			hardwareVersionString: '1.0.0',
			deviceTypeList: [],
		});
		this.getAttribute = vi.fn().mockReturnValue(undefined);
		this.updateAttribute = vi.fn();
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

const DUID = 'duid-gap';
const MATTER_OVERRIDE_DEFAULTS = asPartial<MatterOverrideSettings>({
	matterVendorName: '',
	matterProductName: '',
	matterVendorId: 0x10000,
	matterProductId: 0,
});

function makeDevice(duid: string, overrides: Partial<Device> = {}): Device {
	return asPartial<Device>({
		duid,
		name: `Vacuum-${duid}`,
		rrHomeId: 1,
		serialNumber: 'serial-gap',
		fv: '1.0.0',
		specs: asPartial<DeviceSpecs>({ model: DeviceModel.S7, firmwareVersion: '1.0.0' }),
		store: asPartial<Device['store']>({
			homeData: { id: 1, name: 'Home', rooms: [], products: [], devices: [], receivedDevices: [] },
		}),
		...overrides,
	});
}

/**
 * Plain stand-in for a RoborockVacuumCleaner used when calling addDevice / applyVersionInfo /
 * overrideMatterConfiguration directly. `basicOptions` is returned for the BridgedDeviceBasicInformation
 * cluster so tests can assert the software/hardware version fields written by addDevice.
 */
function makeRvc(
	basicOptions: Record<string, unknown>,
	overrides: Partial<RoborockVacuumCleaner> = {},
): RoborockVacuumCleaner {
	return asPartial<RoborockVacuumCleaner>({
		device: makeDevice(DUID),
		deviceName: 'Roborock-gap',
		serialNumber: 'serial-gap',
		mode: 'matter',
		deviceTypes: new Map(),
		vendorId: 65521,
		vendorName: 'Matterbridge',
		productName: 'Roborock',
		productId: 32768,
		softwareVersion: 1,
		softwareVersionString: '1.0.0',
		hardwareVersion: 1,
		hardwareVersionString: '1.0.0',
		getClusterServerOptions: vi.fn().mockReturnValue(basicOptions),
		createDefaultIdentifyClusterServer: vi.fn(),
		createDefaultBridgedDeviceBasicInformationClusterServer: vi.fn(),
		...overrides,
	});
}

describe('DeviceConfigurator gap coverage', () => {
	let log: AnsiLogger;
	let configManager: PlatformConfigManager;
	let platformRunner: PlatformRunner;
	let platform: MatterbridgeDynamicPlatform;
	let roborockService: RoborockService;
	let snackbarMessage: WssSendSnackbarMessage;

	function makeConfigManager(): PlatformConfigManager {
		const cfg = createMockConfigManager({ forceRunAtDefault: false, isMultipleMapEnabled: false });
		return Object.assign(cfg, {
			isCustomCleanModeMappingEnabled: false,
			cleanModeSettings: {},
			overrideMatterConfiguration: false,
			matterOverrideSettings: MATTER_OVERRIDE_DEFAULTS,
			rawConfig: {},
			getProductNameForDevice: vi.fn().mockReturnValue(undefined),
			ensureDeviceProductNameEntry: vi.fn().mockReturnValue(false),
		});
	}

	function makePlatform(): MatterbridgeDynamicPlatform {
		return asPartial<MatterbridgeDynamicPlatform>({
			version: '1.0.0',
			matterbridge: asPartial<MatterbridgeDynamicPlatform['matterbridge']>({ matterbridgeVersion: '3.5.5' }),
			log: createMockLogger(),
			validateDevice: vi.fn().mockReturnValue(true),
			setSelectDevice: vi.fn(),
			registerDevice: vi.fn().mockResolvedValue(undefined),
			onConfigChanged: vi.fn().mockResolvedValue(undefined),
		});
	}

	function createService(overrides: Partial<RoborockService> = {}): RoborockService {
		return createMockRoborockService({
			resolveInitialAreas: vi.fn().mockResolvedValue({ supportedAreas: [], supportedMaps: [] }),
			getSupportedAreas: vi.fn().mockReturnValue([]),
			getSupportedAreasIndexMap: vi.fn().mockReturnValue(new Map()),
			initializeMessageClientForLocal: vi.fn().mockResolvedValue(true),
			setDeviceRooms: vi.fn(),
			registerAreasListener: vi.fn(),
			startPeriodicAreaRefresh: vi.fn(),
			setDeviceNotify: vi.fn(),
			activateDeviceNotify: vi.fn(),
			...overrides,
		});
	}

	function buildConfigurator(devices: Device[], robots?: Map<string, RoborockVacuumCleaner>): DeviceConfigurator {
		const registry: DeviceRegistry = createMockDeviceRegistry(
			{
				hasDevices: vi.fn().mockReturnValue(true),
				getAllDevices: vi.fn().mockReturnValue(devices),
			},
			robots,
		);
		return new DeviceConfigurator(platform, configManager, registry, () => platformRunner, snackbarMessage, log);
	}

	beforeEach(() => {
		vi.clearAllMocks();
		log = createMockLogger();
		snackbarMessage = vi.fn() as unknown as WssSendSnackbarMessage;
		configManager = makeConfigManager();
		platformRunner = asPartial<PlatformRunner>({
			updateRobotWithPayload: vi.fn(),
			requestHomeData: vi.fn().mockResolvedValue(undefined),
			activateHandlerFunctions: vi.fn(),
			burstPolling: asPartial<PlatformRunner['burstPolling']>({ startBurstPolling: vi.fn() }),
		});
		platform = makePlatform();
		roborockService = createService();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('onConfigureDevice', () => {
		it('should forward device notify payloads to updateRobotWithPayload when the notify callback fires', async () => {
			const configurator = buildConfigurator([]);
			await configurator.onConfigureDevice(roborockService);

			const notify = vi.mocked(roborockService.setDeviceNotify).mock.calls[0][0];
			const payload = asPartial<Parameters<PlatformRunner['updateRobotWithPayload']>[0]>({
				type: NotifyMessageTypes.ServiceAreaUpdate,
			});
			await notify(payload);

			expect(platformRunner.updateRobotWithPayload).toHaveBeenCalledWith(payload);
		});

		it('should skip activation and periodic refresh for a failed device without taking its rrHomeId', async () => {
			const okDevice = makeDevice('duid-ok', { rrHomeId: 2 });
			const failedDevice = makeDevice('duid-failed', { rrHomeId: 1 });
			const robots = new Map<string, RoborockVacuumCleaner>([
				['duid-ok', asPartial<RoborockVacuumCleaner>({ device: okDevice })],
				['duid-failed', asPartial<RoborockVacuumCleaner>({ device: failedDevice })],
			]);
			const configurator = buildConfigurator([okDevice, failedDevice], robots);
			// configureDevice always returns true in production; stub the private seam to exercise the skip path.
			configurator['configureDevice'] = vi
				.fn()
				.mockImplementation((vacuum: Device) => Promise.resolve(vacuum.duid === 'duid-ok'));

			await configurator.onConfigureDevice(roborockService);

			expect(configurator.rrHomeId).toBe(2);
			expect(roborockService.activateDeviceNotify).toHaveBeenCalledTimes(1);
			expect(roborockService.activateDeviceNotify).toHaveBeenCalledWith(okDevice);
			expect(roborockService.startPeriodicAreaRefresh).toHaveBeenCalledTimes(1);
			expect(roborockService.startPeriodicAreaRefresh).toHaveBeenCalledWith('duid-ok');
		});

		it('should log the raw value when requestHomeData rejects with a non-Error', async () => {
			vi.mocked(platformRunner.requestHomeData).mockRejectedValue('raw failure');
			const configurator = buildConfigurator([]);

			await configurator.onConfigureDevice(roborockService);

			expect(log.error).toHaveBeenCalledWith(expect.stringContaining('raw failure'));
			expect(platformRunner.activateHandlerFunctions).toHaveBeenCalledTimes(1);
		});

		it('should start burst polling for the device when the behavior callback fires', async () => {
			const configurator = buildConfigurator([makeDevice(DUID)]);
			await configurator.onConfigureDevice(roborockService);

			const startBurst = vi.mocked(configureBehavior).mock.calls[0][7];
			startBurst();

			expect(platformRunner.burstPolling.startBurstPolling).toHaveBeenCalledWith(DUID);
		});
	});

	describe('configureDevice', () => {
		it('should warn and skip registration when the robot has no deviceName', async () => {
			const configurator = buildConfigurator([]);

			const result = await configurator['configureDevice'](makeDevice(DUID, { name: undefined }), roborockService);

			expect(platform.validateDevice).toHaveBeenCalledWith('');
			expect(platform.registerDevice).not.toHaveBeenCalled();
			expect(log.warn).toHaveBeenCalledWith('Cannot add device: missing rvc or deviceName');
			expect(result).toBe(true);
		});
	});

	describe('addDevice', () => {
		it('should return undefined and skip registration when validateDevice rejects the device name', async () => {
			vi.mocked(platform.validateDevice).mockReturnValue(false);
			const configurator = buildConfigurator([]);

			const result = await configurator['addDevice'](makeRvc({}));

			expect(result).toBeUndefined();
			expect(platform.registerDevice).not.toHaveBeenCalled();
		});

		it.each(['matter', 'server'] as const)(
			'should never add the bridged-node device type or BridgedDeviceBasicInformation cluster itself when mode is %s',
			async (mode) => {
				// Arrange
				const registry = createMockDeviceRegistry({
					hasDevices: vi.fn().mockReturnValue(true),
					getAllDevices: vi.fn().mockReturnValue([]),
				});
				const configurator = new DeviceConfigurator(
					platform,
					configManager,
					registry,
					() => platformRunner,
					snackbarMessage,
					log,
				);
				const rvc = makeRvc({}, { mode });

				// Act
				const result = await configurator['addDevice'](rvc);

				// Assert
				expect(result).toBe(rvc);
				expect(rvc.deviceTypes.size).toBe(0);
				expect(rvc.createDefaultBridgedDeviceBasicInformationClusterServer).not.toHaveBeenCalled();
				expect(platform.registerDevice).toHaveBeenCalledWith(rvc);
				expect(registry.registerRobot).toHaveBeenCalledWith(rvc);
			},
		);

		it('should default hardwareVersion to 1 when the firmware version has no digits', async () => {
			const configurator = buildConfigurator([]);
			const basicOptions: Record<string, unknown> = {};
			const device = makeDevice(DUID, {
				specs: asPartial<DeviceSpecs>({ model: DeviceModel.S7, firmwareVersion: 'abc' }),
			});
			const rvc = makeRvc(basicOptions, { device });

			await configurator['addDevice'](rvc);

			expect(basicOptions.hardwareVersion).toBe(1);
			expect(basicOptions.hardwareVersionString).toBe('abc');
		});
	});

	describe('applyVersionInfo', () => {
		it.each([
			['65535', 65535],
			['65536', undefined],
			['abc', undefined],
		])('should keep hardwareVersion only when the parsed value fits UINT16 (hardware "%s")', (hardware, expected) => {
			const configurator = buildConfigurator([]);
			const rvc = makeRvc({});

			configurator['applyVersionInfo'](rvc, hardware);

			expect(rvc.hardwareVersion).toBe(expected);
			expect(rvc.hardwareVersionString).toBe(hardware);
		});
	});

	describe('overrideMatterConfiguration', () => {
		it('should fall back to vendorId 65521 when matterVendorId is not a valid Matter vendor id', () => {
			const configurator = buildConfigurator([]);
			const rvc = makeRvc({}, { serialNumber: 'serial-gap' });

			configurator['overrideMatterConfiguration'](rvc, makeDevice(DUID).specs, MATTER_OVERRIDE_DEFAULTS);

			expect(rvc.vendorId).toBe(65521);
		});

		it('should look up product name and ensure entry with an empty key when serialNumber is undefined', () => {
			vi.mocked(configManager.ensureDeviceProductNameEntry).mockReturnValue(true);
			const configurator = buildConfigurator([]);
			const rvc = makeRvc({}, { serialNumber: undefined });

			const configChanged = configurator['overrideMatterConfiguration'](
				rvc,
				makeDevice(DUID).specs,
				MATTER_OVERRIDE_DEFAULTS,
			);

			expect(configManager.getProductNameForDevice).toHaveBeenCalledWith('');
			expect(configManager.ensureDeviceProductNameEntry).toHaveBeenCalledWith('', DeviceModel.S7);
			expect(configChanged).toBe(true);
		});
	});
});
