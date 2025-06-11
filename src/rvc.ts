import { RoboticVacuumCleaner } from 'matterbridge';
import RoomMap from './model/RoomMap.js';
import { Device } from './roborockCommunication/index.js';
import { getOperationalStates, getSupportedAreas, getSupportedCleanModes, getSupportedRunModes } from './initialData/index.js';
import { AnsiLogger } from 'matterbridge/logger';
import { BehaviorFactoryResult } from './behaviorFactory.js';
import { ModeBase, RvcOperationalState, ServiceArea } from 'matterbridge/matter/clusters';
import { ExperimentalFeatureSetting } from './model/ExperimentalFeatureSetting.js';

export class RoborockVacuumCleaner extends RoboticVacuumCleaner {
  username: string | undefined;
  device: Device;
  rrHomeId: number;
  roomInfo: RoomMap | undefined;

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

    super(
      deviceName, // name
      device.duid, // serial
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
    this.rrHomeId = device.rrHomeId;
  }

  public configurateHandler(behaviorHandler: BehaviorFactoryResult): void {
    this.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      behaviorHandler.executeCommand('playSoundToLocate', identifyTime as number);
    });

    this.addCommandHandler('selectAreas', async ({ request }: { request: ServiceArea.SelectAreasRequest }) => {
      this.log.info(`Selecting areas: ${request.newAreas.join(', ')}`);
      behaviorHandler.executeCommand('selectAreas', request.newAreas);
    });

    this.addCommandHandler('changeToMode', async ({ request }: { request: ModeBase.ChangeToModeRequest }) => {
      behaviorHandler.executeCommand('changeToMode', request.newMode);
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
