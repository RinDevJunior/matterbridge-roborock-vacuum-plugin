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
import { isV1Device } from '../roborockCommunication/protocol/dispatcher/dispatcherFactory.js';
import {
	buildProgressUpdate,
	getNextPendingArea,
	isActivelyCleaningOperationalState,
	markAreaSkipped,
} from '../runtimes/handlers/serviceAreaHandler.js';
import { RoborockService } from '../services/roborockService.js';
import { BehaviorFactoryResult } from '../share/behaviorFactory.js';
import type { RestoredRunSeed } from '../share/cleaningRunSnapshot.js';

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
	private readonly supportsFilterMonitoring: boolean;

	/**
	 * Create a new Roborock Vacuum Cleaner device.
	 * Initializes the device with supported cleaning modes, run modes, areas, and routines.
	 */
	constructor(
		public readonly device: Device,
		public readonly homeInFo: HomeEntity,
		configManager: PlatformConfigManager,
		public readonly roborockService: RoborockService,
		log: AnsiLogger,
		resolvedAreas: ServiceArea.Area[] = [],
		resolvedMaps: ServiceArea.Map[] = [],
		restoredRun?: RestoredRunSeed,
	) {
		const deviceConfig = RoborockVacuumCleaner.initializeDeviceConfiguration(
			device,
			configManager,
			roborockService,
			log,
			resolvedAreas,
			resolvedMaps,
		);

		super(deviceConfig.deviceName, device.sn ?? device.duid, {
			mode: deviceConfig.bridgeMode,
			currentRunMode: deviceConfig.runModeConfigs[0].mode,
			supportedRunModes: deviceConfig.runModeConfigs,
			currentCleanMode: deviceConfig.cleanModes[0].mode,
			supportedCleanModes: deviceConfig.cleanModes,
			currentPhase: null,
			phaseList: null,
			operationalState: RvcOperationalState.OperationalState.Docked,
			operationalStateList: deviceConfig.operationalState,
			supportedAreas: deviceConfig.supportedAreaAndRoutines,
			selectedAreas: restoredRun?.selectedAreas,
			currentArea: restoredRun?.currentArea ?? null,
			supportedMaps: deviceConfig.supportedMaps,
			progress: restoredRun?.progress ?? [],
		});

		this.supportsFilterMonitoring = deviceConfig.supportsFilterMonitoring;

		if (deviceConfig.supportsFilterMonitoring) {
			this.createDefaultHepaFilterMonitoringClusterServer();
		}

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
	 * ProgressReporting is always enabled for this plugin; the native `progress` option seeds initial progress.
	 */
	override createDefaultServiceAreaClusterServer(
		supportedAreas?: ServiceArea.Area[],
		selectedAreas?: number[],
		currentArea?: number | null,
		supportedMaps?: ServiceArea.Map[],
		progress?: ServiceArea.Progress[],
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
				progress: progress ?? [],
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
				behaviorHandler
					.executeCommand(CommandNames.IDENTIFY, (request as IdentifyCommandRequest).identifyTime ?? 5)
					.catch((error: unknown) => {
						this.log.error(`Identify command failed: ${error instanceof Error ? error.message : String(error)}`);
					});
			},
		);

		this.addCommandHandlerWithErrorHandling(CommandNames.SELECT_AREAS, async ({ request }) => {
			const { newAreas } = request as ServiceArea.SelectAreasRequest;
			const requestedAreas = newAreas ?? [];
			this.log.info(`Selecting areas: ${requestedAreas.join(', ')}`);
			behaviorHandler.executeCommand(CommandNames.SELECT_AREAS, requestedAreas).catch((error: unknown) => {
				this.log.error(`Select areas command failed: ${error instanceof Error ? error.message : String(error)}`);
			});
		});

		this.addCommandHandlerWithErrorHandling(CommandNames.SKIP_AREA, async ({ request }) => {
			const { skippedArea } = request as ServiceArea.SkipAreaRequest;
			this.log.info(`Skipping area: ${skippedArea}`);
			await behaviorHandler.executeCommand(CommandNames.SKIP_AREA, skippedArea);
		});

		this.addCommandHandlerWithErrorHandling(CommandNames.CHANGE_TO_MODE, async ({ request }) => {
			const { newMode } = request as ModeBase.ChangeToModeRequest;
			this.log.info(`Changing to mode: ${newMode}`);
			// Do NOT await: awaiting would make resetProgressForNewRun's updateAttribute wait on this command's own transaction and deadlock.
			behaviorHandler.executeCommand(CommandNames.CHANGE_TO_MODE, newMode).catch((error: unknown) => {
				this.log.error(`Change to mode command failed: ${error instanceof Error ? error.message : String(error)}`);
			});
		});

		this.addCommandHandlerWithErrorHandling(CommandNames.PAUSE, async () => {
			this.log.info('Pause command received');
			behaviorHandler.executeCommand(CommandNames.PAUSE).catch((error: unknown) => {
				this.log.error(`Pause command failed: ${error instanceof Error ? error.message : String(error)}`);
			});
		});

		this.addCommandHandlerWithErrorHandling(CommandNames.RESUME, async () => {
			this.log.info('Resume command received');
			behaviorHandler.executeCommand(CommandNames.RESUME).catch((error: unknown) => {
				this.log.error(`Resume command failed: ${error instanceof Error ? error.message : String(error)}`);
			});
		});

		this.addCommandHandlerWithErrorHandling(CommandNames.GO_HOME, async () => {
			this.log.info('GoHome command received');
			behaviorHandler.executeCommand(CommandNames.GO_HOME).catch((error: unknown) => {
				this.log.error(`GoHome command failed: ${error instanceof Error ? error.message : String(error)}`);
			});
		});

		this.addCommandHandlerWithErrorHandling(CommandNames.STOP, async () => {
			this.log.info('Stop command received');
			behaviorHandler.executeCommand(CommandNames.STOP).catch((error: unknown) => {
				this.log.error(`Stop command failed: ${error instanceof Error ? error.message : String(error)}`);
			});
		});

		if (this.supportsFilterMonitoring) {
			this.addCommandHandlerWithErrorHandling('HepaFilterMonitoring.resetCondition', async () => {
				this.log.info('Reset filter condition command received');
				await behaviorHandler.executeCommand(CommandNames.RESET_FILTER);
			});
		}
	}

	/**
	 * Initialize device configuration including modes, areas, and maps.
	 */
	private static initializeDeviceConfiguration(
		device: Device,
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
			supportsFilterMonitoring: isV1Device(device.pv, device.specs.model) && configManager.isFilterMonitoringEnabled,
		};
	}

	/**
	 * Native skipArea already marked the area Skipped; this advances currentArea to the next pending
	 * room (marked Operating) and syncs the AreaManagementService progress mirror.
	 */
	public async finalizeSkipArea(skippedArea: number): Promise<{
		updatedProgress: ServiceArea.Progress[];
		nextAreaId: number | null;
	}> {
		const selectedAreas = this.getAttribute(ServiceArea.id, 'selectedAreas', this.log) ?? [];
		const existingProgress = this.roborockService.getProgress(this.device.duid);
		const nextAreaId = getNextPendingArea(selectedAreas, existingProgress, skippedArea);
		const updatedProgress = markAreaSkipped(existingProgress, selectedAreas, skippedArea, nextAreaId);
		this.roborockService.setProgress(this.device.duid, updatedProgress);
		return { updatedProgress, nextAreaId };
	}

	public buildPendingProgressSeed(): ServiceArea.Progress[] {
		const selectedAreas: number[] = this.getAttribute(ServiceArea.id, 'selectedAreas', this.log) ?? [];
		const areaIds = selectedAreas.length > 0 ? selectedAreas : this.resolveAllRoomsForActiveMap();
		return buildProgressUpdate([], areaIds, null);
	}

	/**
	 * Seeds Pending progress rows when a new clean starts. No-op while already actively cleaning
	 * (e.g. a resume from Paused) so live progress is not wiped.
	 */
	public async resetProgressForNewRun(): Promise<void> {
		const operationalState = this.getAttribute(RvcOperationalState.id, 'operationalState', this.log) as
			RvcOperationalState.OperationalState | undefined;
		if (isActivelyCleaningOperationalState(operationalState)) {
			this.log.debug(
				`[${this.device.duid}] Skipping progress reset: already actively cleaning (operationalState=${operationalState})`,
			);
			return;
		}
		const seed = this.buildPendingProgressSeed();
		this.roborockService.setProgress(this.device.duid, seed);
		await this.updateAttribute(ServiceArea.id, 'progress', seed, this.log);
	}

	public async trySwitchMap(selectedAreaIds: number[]): Promise<void> {
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

	public resolveAllRoomsForActiveMap(): number[] {
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
