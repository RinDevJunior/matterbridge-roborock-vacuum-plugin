import { RoboticVacuumCleaner } from 'matterbridge/devices';
import RoomMap from './model/RoomMap.js';
import { Device } from './roborockCommunication/index.js';
import { getOperationalStates, getSupportedAreas, getSupportedCleanModes, getSupportedRunModes } from './initialData/index.js';
import { AnsiLogger } from 'matterbridge/logger';
import { BehaviorFactoryResult } from './behaviorFactory.js';
import { ModeBase, RvcOperationalState, ServiceArea } from 'matterbridge/matter/clusters';
import { ExperimentalFeatureSetting } from './model/ExperimentalFeatureSetting.js';
import { DockingStationStatus } from './model/DockingStationStatus.js';

export class RoborockVacuumCleaner extends RoboticVacuumCleaner {
  username: string | undefined;
  device: Device;
  roomInfo: RoomMap | undefined;
  dockStationStatus: DockingStationStatus | undefined;

  constructor(
    username: string,
    device: Device,
    roomMap: RoomMap,
    routineAsRoom: ServiceArea.Area[],
    enableExperimentalFeature: ExperimentalFeatureSetting | undefined,
    log: AnsiLogger,
  ) {
    const cleanModes = getSupportedCleanModes(device.data.model, enableExperimentalFeature);
    const supportedRunModes = getSupportedRunModes();
    const supportedAreas = [...getSupportedAreas(device.rooms, roomMap, log), ...routineAsRoom];
    const deviceName = `${device.name}-${device.duid}`.replace(/\s+/g, '');

    log.debug(
      `Creating RoborockVacuumCleaner for device: ${deviceName}, model: ${device.data.model}, forceRunAtDefault: ${enableExperimentalFeature?.advancedFeature?.forceRunAtDefault}`,
    );
    log.debug(`Supported Clean Modes: ${JSON.stringify(cleanModes)}`);
    log.debug(`Supported Run Modes: ${JSON.stringify(supportedRunModes)}`);

    const bridgeMode = enableExperimentalFeature?.advancedFeature.enableServerMode ? 'server' : undefined;
    super(
      deviceName, // name
      device.duid, // serial
      bridgeMode, // mode
      supportedRunModes[0].mode, // currentRunMode
      supportedRunModes, // supportedRunModes
      cleanModes[0].mode, // currentCleanMode
      cleanModes, // supportedCleanModes
      undefined, // currentPhase
      undefined, // phaseList
      RvcOperationalState.OperationalState.Docked, // operationalState
      getOperationalStates(), // operationalStateList
      supportedAreas, // supportedAreas
      undefined, // selectedAreas
      supportedAreas[0].areaId, // currentArea
    );

    this.username = username;
    this.device = device;
  }

  public configurateHandler(behaviorHandler: BehaviorFactoryResult): void {
    this.addCommandHandler('identify', async ({ request, cluster, attributes, endpoint }) => {
      this.log.info(`Identify command received for endpoint ${endpoint}, cluster ${cluster}, attributes ${attributes}, request: ${JSON.stringify(request)}`);
      behaviorHandler.executeCommand('playSoundToLocate', (request as { identifyTime?: number }).identifyTime ?? 0);
    });

    this.addCommandHandler('selectAreas', async ({ request }) => {
      const { newAreas } = request as ServiceArea.SelectAreasRequest;
      this.log.info(`Selecting areas: ${newAreas?.join(', ')}`);
      behaviorHandler.executeCommand('selectAreas', newAreas);
    });

    this.addCommandHandler('changeToMode', async ({ request }) => {
      const { newMode } = request as ModeBase.ChangeToModeRequest;
      behaviorHandler.executeCommand('changeToMode', newMode);
    });

    this.addCommandHandler('pause', async () => {
      behaviorHandler.executeCommand('pause');
    });

    this.addCommandHandler('resume', async () => {
      behaviorHandler.executeCommand('resume');
    });

    this.addCommandHandler('goHome', async () => {
      behaviorHandler.executeCommand('goHome');
    });
  }
}
