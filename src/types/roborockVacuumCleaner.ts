import { RoboticVacuumCleaner } from 'matterbridge/devices';
import { CommandHandlerData, MatterbridgeEndpointCommands } from 'matterbridge';
import { getOperationalStates, getSupportedAreas, getSupportedCleanModes } from '../initialData/index.js';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { BehaviorFactoryResult } from '../share/behaviorFactory.js';
import { ModeBase, RvcOperationalState, ServiceArea } from 'matterbridge/matter/clusters';
import { CommandNames } from '../behaviors/BehaviorDeviceGeneric.js';
import { DockStationStatus } from '../model/DockStationStatus.js';
import { Device } from '../roborockCommunication/models/index.js';
import { PlatformConfigManager } from '../platform/platformConfigManager.js';
import { baseRunModeConfigs, getRunModeOptions } from '../behaviors/roborock.vacuum/core/runModeConfig.js';
import { CleanModeSetting } from '../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { HomeEntity } from '../core/domain/entities/Home.js';

interface IdentifyCommandRequest {
  identifyTime?: number;
}

export class RoborockVacuumCleaner extends RoboticVacuumCleaner {
  username: string | undefined;
  device: Device;
  dockStationStatus: DockStationStatus | undefined;
  cleanModeSetting: CleanModeSetting | undefined;
  homeInfo: HomeEntity;

  /**
   * Create a new Roborock Vacuum Cleaner device.
   * Initializes the device with supported cleaning modes, run modes, areas, and routines.
   */
  constructor(username: string, device: Device, homeInFo: HomeEntity, routineAsRoom: ServiceArea.Area[], configManager: PlatformConfigManager, log: AnsiLogger) {
    const deviceConfig = RoborockVacuumCleaner.initializeDeviceConfiguration(device, homeInFo, routineAsRoom, configManager, log);
    const firstSupportedMap = deviceConfig.supportedMaps.length > 0 ? deviceConfig.supportedMaps[0] : undefined;
    const supportedMaps = deviceConfig.supportedMaps;
    if (!configManager.isMultipleMapEnabled) {
      supportedMaps.splice(1); // Keep only the first map
      deviceConfig.supportedAreas = deviceConfig.supportedAreas.filter((area) => area.mapId === firstSupportedMap?.mapId);
      deviceConfig.supportedAreaAndRoutines = deviceConfig.supportedAreaAndRoutines.filter((area) => area.mapId === firstSupportedMap?.mapId);
    }

    super(
      deviceConfig.deviceName,
      device.duid,
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
      deviceConfig.supportedAreas[0].areaId,
      supportedMaps,
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

    this.username = username;
    this.device = device;
    this.homeInfo = homeInFo;
  }

  /**
   * Configure command handlers for the vacuum device.
   * Sets up handlers for identify, area selection, mode changes, and cleaning operations.
   */
  public configureHandler(behaviorHandler: BehaviorFactoryResult): void {
    this.addCommandHandlerWithErrorHandling(CommandNames.IDENTIFY, async ({ request, cluster, attributes, endpoint }) => {
      this.log.info(`Identify command received for endpoint ${endpoint}, cluster ${cluster}, attributes ${debugStringify(attributes)}, request: ${JSON.stringify(request)}`);
      behaviorHandler.executeCommand(CommandNames.IDENTIFY, (request as IdentifyCommandRequest).identifyTime ?? 5);
    });

    this.addCommandHandlerWithErrorHandling(CommandNames.SELECT_AREAS, async ({ request }) => {
      const { newAreas } = request as ServiceArea.SelectAreasRequest;
      if (!newAreas || newAreas.length === 0) {
        this.log.info('selectAreas called with empty or undefined areas, it means selecting no areas or all areas, ignoring.');
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

    this.addCommandHandlerWithErrorHandling(CommandNames.STOP, async () => {
      this.log.info('Stop command received');
      behaviorHandler.executeCommand(CommandNames.STOP);
    });
  }

  /**
   * Initialize device configuration including modes, areas, and maps.
   */
  private static initializeDeviceConfiguration(device: Device, homeInFo: HomeEntity, routineAsRoom: ServiceArea.Area[], configManager: PlatformConfigManager, log: AnsiLogger) {
    const cleanModes = getSupportedCleanModes(device.specs.model, configManager);
    const operationalState = getOperationalStates();

    const { supportedAreas, supportedMaps } = getSupportedAreas(homeInFo, log);
    const supportedAreaAndRoutines = [...supportedAreas, ...routineAsRoom];
    const runModeConfigs = getRunModeOptions(baseRunModeConfigs);
    const deviceName = `${device.name}-${device.duid}`.replace(/\s+/g, '');

    const bridgeMode: 'server' | 'matter' = configManager.isServerModeEnabled ? 'server' : 'matter';

    return {
      deviceName,
      bridgeMode,
      cleanModes,
      runModeConfigs,
      supportedAreas,
      supportedMaps,
      supportedAreaAndRoutines,
      operationalState,
    };
  }

  /**
   * Helper method to add command handler with error handling.
   * Wraps handler logic in try-catch to avoid code duplication.
   */
  private addCommandHandlerWithErrorHandling(commandName: keyof MatterbridgeEndpointCommands, handler: (context: CommandHandlerData) => Promise<void>): void {
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
