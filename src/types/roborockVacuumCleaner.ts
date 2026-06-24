import { CommandHandlerData, MatterbridgeEndpointCommands } from 'matterbridge';
import { RoboticVacuumCleaner } from 'matterbridge/devices';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { ModeBase, RvcOperationalState, ServiceArea } from 'matterbridge/matter/clusters';

import { CommandNames } from '../behaviors/BehaviorDeviceGeneric.js';
import { CleanModeSetting } from '../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { baseRunModeConfigs, getRunModeOptions } from '../behaviors/roborock.vacuum/core/runModeConfig.js';
import { HomeEntity } from '../core/domain/entities/Home.js';
import { getOperationalStates, getSupportedCleanModes, getSupportedRoutines } from '../initialData/index.js';
import { DockStationStatus } from '../model/DockStationStatus.js';
import { PlatformConfigManager } from '../platform/platformConfigManager.js';
import { Device } from '../roborockCommunication/models/index.js';
import { RoborockService } from '../services/roborockService.js';
import { BehaviorFactoryResult } from '../share/behaviorFactory.js';

interface IdentifyCommandRequest {
	identifyTime?: number;
}

export class RoborockVacuumCleaner extends RoboticVacuumCleaner {
	dockStationStatus: DockStationStatus | undefined;
	cleanModeSetting: CleanModeSetting | undefined;
	lastUpdateAt: number | null = null;

	/**
	 * Create a new Roborock Vacuum Cleaner device.
	 * Initializes the device with supported cleaning modes, run modes, areas, and routines.
	 */
	constructor(
		public readonly device: Device,
		public readonly homeInFo: HomeEntity,
		configManager: PlatformConfigManager,
		private readonly roborockService: RoborockService,
		log: AnsiLogger,
	) {
		const deviceConfig = RoborockVacuumCleaner.initializeDeviceConfiguration(
			device,
			homeInFo,
			configManager,
			roborockService,
			log,
		);

		super(
			deviceConfig.deviceName,
			device.sn ?? device.duid,
			deviceConfig.bridgeMode,
			deviceConfig.runModeConfigs[0].mode,
			deviceConfig.runModeConfigs,
			deviceConfig.cleanModes[0].mode,
			deviceConfig.cleanModes,
			undefined,
			undefined,
			RvcOperationalState.OperationalState.Docked,
			deviceConfig.operationalState,
			deviceConfig.supportedAreaAndRoutines,
			undefined,
			null,
			deviceConfig.supportedMaps,
		);

		log.debug(
			`Creating RoborockVacuumCleaner for device: ${deviceConfig.deviceName}, 
      model: ${device.specs.model}, 
      forceRunAtDefault: ${configManager.forceRunAtDefault}
      bridgeMode: ${deviceConfig.bridgeMode},
      Supported Clean Modes: ${debugStringify(deviceConfig.cleanModes)},
      Supported Areas: ${debugStringify(deviceConfig.supportedAreas)},
      Supported Maps: ${debugStringify(deviceConfig.supportedMaps)}
      Supported Areas and Routines: ${debugStringify(deviceConfig.supportedAreaAndRoutines)},
      Supported Operational States: ${debugStringify(deviceConfig.operationalState)}`,
		);
	}

	/**
	 * Configure command handlers for the vacuum device.
	 * Sets up handlers for identify, area selection, mode changes, and cleaning operations.
	 */
	public configureHandler(behaviorHandler: BehaviorFactoryResult): void {
		this.addCommandHandlerWithErrorHandling(
			CommandNames.IDENTIFY,
			async ({ request, cluster, attributes, endpoint }) => {
				this.log.info(
					`Identify command received for endpoint ${endpoint}, cluster ${cluster}, attributes ${debugStringify(attributes)}, request: ${JSON.stringify(request)}`,
				);
				behaviorHandler.executeCommand(CommandNames.IDENTIFY, (request as IdentifyCommandRequest).identifyTime ?? 5);
			},
		);

		this.addCommandHandlerWithErrorHandling(CommandNames.SELECT_AREAS, async ({ request }) => {
			const { newAreas } = request as ServiceArea.SelectAreasRequest;
			const areas = newAreas ?? [];
			this.log.info(
				areas.length === 0
					? 'Clearing selected areas (global cleaning on next start)'
					: `Selecting areas: ${areas.join(', ')}`,
			);

			if (areas.length > 0) {
				await this.trySwitchMap(areas);
			}

			behaviorHandler.executeCommand(CommandNames.SELECT_AREAS, areas);
		});

		this.addCommandHandlerWithErrorHandling(CommandNames.CHANGE_TO_MODE, async ({ request }) => {
			const { newMode } = request as ModeBase.ChangeToModeRequest;
			this.log.info(`Changing to mode: ${newMode}`);
			behaviorHandler.executeCommand(CommandNames.CHANGE_TO_MODE, newMode);
		});

		this.addCommandHandlerWithErrorHandling(CommandNames.PAUSE, async () => {
			this.log.info('Pause command received');
			behaviorHandler.executeCommand(CommandNames.PAUSE);
		});

		this.addCommandHandlerWithErrorHandling(CommandNames.RESUME, async () => {
			this.log.info('Resume command received');
			behaviorHandler.executeCommand(CommandNames.RESUME);
		});

		this.addCommandHandlerWithErrorHandling(CommandNames.GO_HOME, async () => {
			this.log.info('GoHome command received');
			behaviorHandler.executeCommand(CommandNames.GO_HOME);
		});

		this.addCommandHandlerWithErrorHandling(CommandNames.STOP, async () => {
			this.log.info('Stop command received');
			behaviorHandler.executeCommand(CommandNames.STOP);
		});
	}

	/**
	 * Initialize device configuration including modes, areas, and maps.
	 */
	private static initializeDeviceConfiguration(
		device: Device,
		homeInFo: HomeEntity,
		configManager: PlatformConfigManager,
		roborockService: RoborockService,
		log: AnsiLogger,
	) {
		const cleanModes = getSupportedCleanModes(device.specs.model, configManager);
		const operationalState = getOperationalStates();
		const runModeConfigs = getRunModeOptions(baseRunModeConfigs);

		const bridgeMode: 'server' | 'matter' = configManager.isServerModeEnabled ? 'server' : 'matter';

		const supportedMaps: ServiceArea.Map[] = [];

		let routineAsRooms: ServiceArea.Area[] = [];
		if (configManager.showRoutinesAsRoom) {
			routineAsRooms = getSupportedRoutines(device.scenes ?? [], log);
			roborockService.setSupportedRoutines(device.duid, routineAsRooms);
		}

		// temporary use map id 999 for routine
		if (routineAsRooms.length > 0) {
			const mapForRoutine: ServiceArea.Map = { mapId: 999, name: 'Routine' };
			supportedMaps.push(mapForRoutine);
			routineAsRooms.forEach((rt) => {
				rt.mapId = 999;
			});
		}

		const supportedAreaAndRoutines = [...routineAsRooms];
		const deviceName = device.name;

		return {
			deviceName,
			bridgeMode,
			cleanModes,
			runModeConfigs,
			supportedAreas: [],
			supportedMaps,
			supportedAreaAndRoutines,
			operationalState,
		};
	}

	private async trySwitchMap(selectedAreaIds: number[]): Promise<void> {
		const duid = this.device.duid;
		const supportedAreas = this.roborockService.getSupportedAreas(duid);
		const targetMapId = supportedAreas.find((a) => a.areaId === selectedAreaIds[0])?.mapId;

		if (targetMapId === undefined || targetMapId === null) return;
		if (targetMapId === this.homeInFo.activeMapId) return;

		this.log.info(`[${duid}] Switching map from ${this.homeInFo.activeMapId} to ${targetMapId}`);
		try {
			await this.roborockService.switchMap(duid, targetMapId);
		} catch (err) {
			this.log.error(`[${duid}] Failed to switch map: ${String(err)}`);
		}
	}

	/**
	 * Helper method to add command handler with error handling.
	 * Wraps handler logic in try-catch to avoid code duplication.
	 */
	private addCommandHandlerWithErrorHandling(
		commandName: keyof MatterbridgeEndpointCommands,
		handler: (context: CommandHandlerData) => Promise<void>,
	): void {
		this.addCommandHandler(commandName, async (context: CommandHandlerData) => {
			try {
				await handler(context);
			} catch (error) {
				this.log.error(`Error executing ${commandName} command: ${error}`);
				throw error;
			}
		});
	}
}
