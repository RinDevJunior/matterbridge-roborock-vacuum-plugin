import { RoboticVacuumCleaner } from 'matterbridge/devices';
import { CommandHandlerData, MatterbridgeEndpointCommands } from 'matterbridge';
import { RoomMap } from './model/RoomMap.js';
import { Device } from './roborockCommunication/index.js';
import { getOperationalStates, getSupportedAreas, getSupportedCleanModes, getSupportedRunModes } from './initialData/index.js';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { BehaviorFactoryResult } from './behaviorFactory.js';
import { ModeBase, RvcOperationalState, ServiceArea } from 'matterbridge/matter/clusters';
import { ExperimentalFeatureSetting } from './model/ExperimentalFeatureSetting.js';
import { CommandNames } from './behaviors/BehaviorDeviceGeneric.js';
import { DockingStationStatus } from './model/DockingStationStatus.js';

interface IdentifyCommandRequest {
  identifyTime?: number;
}

export class RoborockVacuumCleaner extends RoboticVacuumCleaner {
  username: string | undefined;
  device: Device;
  roomInfo: RoomMap | undefined;
  dockStationStatus: DockingStationStatus | undefined;

  /**
   * Create a new Roborock Vacuum Cleaner device.
   * Initializes the device with supported cleaning modes, run modes, areas, and routines.
   * @param username - User's account email
   * @param device - Device information from Roborock API
   * @param roomMap - Room mapping information
   * @param routineAsRoom - Cleaning routines represented as areas
   * @param enableExperimentalFeature - Experimental feature settings
   * @param log - Logger instance
   */
  constructor(
    username: string,
    device: Device,
    roomMap: RoomMap,
    routineAsRoom: ServiceArea.Area[],
    enableExperimentalFeature: ExperimentalFeatureSetting | undefined,
    log: AnsiLogger,
  ) {
    const deviceConfig = RoborockVacuumCleaner.initializeDeviceConfiguration(device, roomMap, routineAsRoom, enableExperimentalFeature, log);

    super(
      deviceConfig.deviceName,
      device.duid,
      deviceConfig.bridgeMode,
      deviceConfig.supportedRunModes[0].mode,
      deviceConfig.supportedRunModes,
      deviceConfig.cleanModes[0].mode,
      deviceConfig.cleanModes,
      undefined,
      undefined,
      RvcOperationalState.OperationalState.Docked,
      deviceConfig.operationalState,
      deviceConfig.supportedAreaAndRoutines,
      undefined,
      deviceConfig.supportedAreas[0].areaId,
      deviceConfig.supportedMaps,
    );

    this.username = username;
    this.device = device;
  }

  /**
   * Configure command handlers for the vacuum device.
   * Sets up handlers for identify, area selection, mode changes, and cleaning operations.
   * @param behaviorHandler - Behavior handler that executes device commands
   */
  public configureHandler(behaviorHandler: BehaviorFactoryResult): void {
    this.addCommandHandlerWithErrorHandling(CommandNames.IDENTIFY, async ({ request, cluster, attributes, endpoint }) => {
      this.log.info(`Identify command received for endpoint ${endpoint}, cluster ${cluster}, attributes ${debugStringify(attributes)}, request: ${JSON.stringify(request)}`);
      behaviorHandler.executeCommand(CommandNames.PLAY_SOUND_TO_LOCATE, (request as IdentifyCommandRequest).identifyTime ?? 5);
    });

    this.addCommandHandlerWithErrorHandling(CommandNames.SELECT_AREAS, async ({ request }) => {
      const { newAreas } = request as ServiceArea.SelectAreasRequest;
      if (!newAreas || newAreas.length === 0) {
        this.log.warn('selectAreas called with empty or undefined areas');
        return;
      }
      this.log.info(`Selecting areas: ${newAreas.join(', ')}`);
      behaviorHandler.executeCommand(CommandNames.SELECT_AREAS, newAreas);
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
  }

  /**
   * Initialize device configuration including modes, areas, and maps.
   * @private
   */
  private static initializeDeviceConfiguration(
    device: Device,
    roomMap: RoomMap,
    routineAsRoom: ServiceArea.Area[],
    enableExperimentalFeature: ExperimentalFeatureSetting | undefined,
    log: AnsiLogger,
  ) {
    const cleanModes = getSupportedCleanModes(device.data.model, enableExperimentalFeature);
    const supportedRunModes = getSupportedRunModes();
    const enableMultipleMap = enableExperimentalFeature?.enableExperimentalFeature && enableExperimentalFeature?.advancedFeature?.enableMultipleMap;
    const operationalState = getOperationalStates();

    const { supportedAreas, supportedMaps } = getSupportedAreas(device.rooms, roomMap, enableMultipleMap, log);
    const supportedAreaAndRoutines = [...supportedAreas, ...routineAsRoom];
    const deviceName = `${device.name}-${device.duid}`.replace(/\s+/g, '');

    const bridgeMode: 'server' | 'matter' | undefined =
      enableExperimentalFeature?.enableExperimentalFeature && enableExperimentalFeature?.advancedFeature?.enableServerMode ? 'server' : undefined;

    log.debug(
      `Creating RoborockVacuumCleaner for device: ${deviceName}, 
      model: ${device.data.model}, 
      forceRunAtDefault: ${enableExperimentalFeature?.advancedFeature?.forceRunAtDefault}
      bridgeMode: ${bridgeMode},
      Supported Clean Modes: ${debugStringify(cleanModes)},
      Supported Run Modes: ${debugStringify(supportedRunModes)},
      Supported Areas: ${debugStringify(supportedAreas)},
      Supported Maps: ${debugStringify(supportedMaps)}
      Supported Operational States: ${debugStringify(operationalState)}`,
    );

    return {
      cleanModes,
      supportedRunModes,
      supportedAreas,
      supportedMaps,
      supportedAreaAndRoutines,
      deviceName,
      bridgeMode,
      operationalState,
    };
  }

  /**
   * Helper method to add command handler with error handling.
   * Wraps handler logic in try-catch to avoid code duplication.
   * @param commandName - Name of the command for logging
   * @param handler - Async handler function
   * @private
   */
  private addCommandHandlerWithErrorHandling<K extends keyof MatterbridgeEndpointCommands>(commandName: K, handler: (context: CommandHandlerData) => Promise<void>): void {
    this.addCommandHandler(commandName, async (context: CommandHandlerData) => {
      try {
        await handler(context);
      } catch (error) {
        this.log.error(`Error executing ${String(commandName)} command: ${error}`);
        throw error;
      }
    });
  }
}
