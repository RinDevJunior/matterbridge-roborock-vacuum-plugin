import { CommandHandlerData, CommandHandlers } from 'matterbridge';
import { MatterbridgeRvcCleanModeServer, RoboticVacuumCleaner } from 'matterbridge/devices';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { CommonAreaNamespaceTag } from 'matterbridge/matter';
import { ModeBase, RvcCleanMode, RvcOperationalState, ServiceArea } from 'matterbridge/matter/clusters';

import { CommandNames } from '../behaviors/BehaviorDeviceGeneric.js';
import { CleanModeSetting } from '../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { baseRunModeConfigs, getRunModeOptions } from '../behaviors/roborock.vacuum/core/runModeConfig.js';
import { RoborockServiceAreaServer } from '../behaviors/roborockServiceAreaServer.js';
import { ROUTINE_MAP_ID } from '../constants/ids.js';
import { HomeEntity } from '../core/domain/entities/Home.js';
import { getOperationalStates, getSupportedCleanModes, getSupportedRoutines } from '../initialData/index.js';
import { DockStationStatus } from '../model/DockStationStatus.js';
import { PlatformConfigManager } from '../platform/platformConfigManager.js';
import { Device } from '../roborockCommunication/models/index.js';
import { getNextPendingArea, markAreaSkipped } from '../runtimes/handlers/serviceAreaHandler.js';
import { RoborockService } from '../services/roborockService.js';
import { BehaviorFactoryResult } from '../share/behaviorFactory.js';

interface IdentifyCommandRequest {
	identifyTime?: number;
}

export class RoborockVacuumCleaner extends RoboticVacuumCleaner {
	dockStationStatus: DockStationStatus | undefined;
	cleanModeSetting: CleanModeSetting | undefined;
	lastUpdateAt: number | null = null;
	operationSessionStartMs: number | null = null;
	operationPausedSinceMs: number | null = null;
	operationPausedAccumMs = 0;
	skipAreaHandler?: (skippedArea: number) => Promise<void>;

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
		resolvedAreas: ServiceArea.Area[] = [],
		resolvedMaps: ServiceArea.Map[] = [],
	) {
		const deviceConfig = RoborockVacuumCleaner.initializeDeviceConfiguration(
			device,
			homeInFo,
			configManager,
			roborockService,
			log,
			resolvedAreas,
			resolvedMaps,
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
	 * Override to enable ServiceArea.Feature.ProgressReporting for per-room cleaning status.
	 * Adds progress attribute to track area cleaning completion (Pending/Operating/Completed/Skipped).
	 */
	override createDefaultServiceAreaClusterServer(
		supportedAreas?: ServiceArea.Area[],
		selectedAreas?: number[],
		currentArea?: number | null,
		supportedMaps?: ServiceArea.Map[],
	): this {
		this.behaviors.require(
			RoborockServiceAreaServer.with(ServiceArea.Feature.Maps, ServiceArea.Feature.ProgressReporting),
			{
				supportedAreas: supportedAreas ?? [
					{
						areaId: 1,
						mapId: null,
						areaInfo: {
							locationInfo: { locationName: 'Living', floorNumber: 0, areaType: CommonAreaNamespaceTag.LivingRoom.tag },
							landmarkInfo: null,
						},
					},
					{
						areaId: 2,
						mapId: null,
						areaInfo: {
							locationInfo: { locationName: 'Kitchen', floorNumber: 0, areaType: CommonAreaNamespaceTag.Kitchen.tag },
							landmarkInfo: null,
						},
					},
					{
						areaId: 3,
						mapId: null,
						areaInfo: {
							locationInfo: { locationName: 'Bedroom', floorNumber: 1, areaType: CommonAreaNamespaceTag.Bedroom.tag },
							landmarkInfo: null,
						},
					},
					{
						areaId: 4,
						mapId: null,
						areaInfo: {
							locationInfo: { locationName: 'Bathroom', floorNumber: 1, areaType: CommonAreaNamespaceTag.Bathroom.tag },
							landmarkInfo: null,
						},
					},
				],
				selectedAreas: selectedAreas ?? [],
				currentArea: currentArea !== undefined ? currentArea : 1,
				supportedMaps: supportedMaps ?? [],
				estimatedEndTime: null,
				progress: [],
			},
		);
		return this;
	}

	/**
	 * Override to enable RvcCleanMode.Feature.DirectModeChange for mode changes during active cleaning.
	 * Allows controllers to change clean mode (e.g., suction power/water flow) without requiring idle state.
	 */
	override createDefaultRvcCleanModeClusterServer(
		currentMode?: number,
		supportedModes?: RvcCleanMode.ModeOption[],
	): this {
		this.behaviors.require(MatterbridgeRvcCleanModeServer.with(RvcCleanMode.Feature.DirectModeChange), {
			supportedModes: supportedModes ?? [
				{ label: 'Vacuum', mode: 1, modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }] },
				{ label: 'Mop', mode: 2, modeTags: [{ value: RvcCleanMode.ModeTag.Mop }] },
				{ label: 'Clean', mode: 3, modeTags: [{ value: RvcCleanMode.ModeTag.DeepClean }] },
			],
			currentMode: currentMode ?? 1,
		});
		return this;
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
			const requestedAreas = newAreas ?? [];

			if (requestedAreas.length === 0) {
				const allRoomsForActiveMap = this.resolveAllRoomsForActiveMap();
				if (allRoomsForActiveMap.length > 0) {
					this.log.info(
						`Populating selected areas with all rooms of active map for global cleaning: ${allRoomsForActiveMap.join(', ')}`,
					);
				} else {
					this.log.info('Clearing selected areas (global cleaning on next start)');
				}
				// No trySwitchMap here: these rooms were resolved FROM the active map, so there is
				// never a map to switch to — see "trySwitchMap reachability fix" in Approach.
				behaviorHandler.executeCommand(CommandNames.SELECT_AREAS, allRoomsForActiveMap);
				return;
			}

			this.log.info(`Selecting areas: ${requestedAreas.join(', ')}`);
			await this.trySwitchMap(requestedAreas);
			behaviorHandler.executeCommand(CommandNames.SELECT_AREAS, requestedAreas);
		});

		this.skipAreaHandler = async (skippedArea: number) => {
			await behaviorHandler.executeCommand(CommandNames.SKIP_AREA, skippedArea);
		};

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
		resolvedAreas: ServiceArea.Area[] = [],
		resolvedMaps: ServiceArea.Map[] = [],
	) {
		const cleanModes = getSupportedCleanModes(
			device.specs.model,
			configManager,
			device.featureSet,
			device.newFeatureSet,
		);
		const operationalState = getOperationalStates();
		const runModeConfigs = getRunModeOptions(baseRunModeConfigs);

		const bridgeMode: 'server' | 'matter' = configManager.isServerModeEnabled ? 'server' : 'matter';

		const supportedMaps: ServiceArea.Map[] = [...resolvedMaps];

		let routineAsRooms: ServiceArea.Area[] = [];
		if (configManager.showRoutinesAsRoom) {
			routineAsRooms = getSupportedRoutines(device.scenes ?? [], log);
			roborockService.setSupportedRoutines(device.duid, routineAsRooms);
		}

		if (routineAsRooms.length > 0) {
			const mapForRoutine: ServiceArea.Map = { mapId: ROUTINE_MAP_ID, name: 'Routine' };
			supportedMaps.push(mapForRoutine);
			routineAsRooms.forEach((rt) => {
				rt.mapId = ROUTINE_MAP_ID;
			});
		}

		const supportedAreaAndRoutines = [...resolvedAreas, ...routineAsRooms];
		const deviceName = device.name;

		return {
			deviceName,
			bridgeMode,
			cleanModes,
			runModeConfigs,
			supportedAreas: resolvedAreas,
			supportedMaps,
			supportedAreaAndRoutines,
			operationalState,
		};
	}

	public async finalizeSkipArea(skippedArea: number): Promise<{
		updatedProgress: ServiceArea.Progress[];
		nextAreaId: number | null;
	}> {
		const selectedAreas = this.getAttribute(ServiceArea.id, 'selectedAreas', this.log) ?? [];
		const existingProgress = this.roborockService.getProgress(this.device.duid);
		const nextAreaId = getNextPendingArea(selectedAreas, existingProgress, skippedArea);
		const updatedProgress = markAreaSkipped(existingProgress, selectedAreas, skippedArea, nextAreaId);
		this.roborockService.setProgress(this.device.duid, updatedProgress);
		await this.updateAttribute(ServiceArea.id, 'progress', updatedProgress, this.log);
		await this.updateAttribute(ServiceArea.id, 'currentArea', nextAreaId, this.log);
		return { updatedProgress, nextAreaId };
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

	private resolveAllRoomsForActiveMap(): number[] {
		const duid = this.device.duid;
		const supportedAreas = this.roborockService.getSupportedAreas(duid);
		if (supportedAreas.length === 0) return [];

		const currentSelectedAreas: number[] = this.getAttribute(ServiceArea.id, 'selectedAreas', this.log) ?? [];
		let activeMapId = supportedAreas.find((a) => currentSelectedAreas.includes(a.areaId))?.mapId;

		if (activeMapId === undefined && this.homeInFo.activeMapId !== -1) {
			activeMapId = this.homeInFo.activeMapId;
		}
		if (activeMapId === undefined || !supportedAreas.some((a) => a.mapId === activeMapId)) {
			activeMapId = supportedAreas[0].mapId;
		}

		return supportedAreas.filter((a) => a.mapId === activeMapId).map((a) => a.areaId);
	}

	/**
	 * Helper method to add command handler with error handling.
	 * Wraps handler logic in try-catch to avoid code duplication.
	 */
	private addCommandHandlerWithErrorHandling(
		commandName: CommandHandlers,
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
