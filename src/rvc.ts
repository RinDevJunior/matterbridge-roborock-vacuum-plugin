import { RoboticVacuumCleaner } from 'matterbridge';
import RoomMap from './model/RoomMap.js';
import { Device } from './roborockCommunication/index.js';
import { getOperationalStates, getSupportedAreas, getSupportedCleanModes, getSupportedRunModes } from './initialData/index.js';
import { AnsiLogger } from 'matterbridge/logger';
import { BehaviorFactoryResult } from './behaviorFactory.js';
import { ModeBase, RvcOperationalState, ServiceArea } from 'matterbridge/matter/clusters';

export class RoborockVacuumCleaner extends RoboticVacuumCleaner {
  username: string | undefined;
  device: Device;
  rrHomeId: number;
  roomInfo: RoomMap | undefined;

  constructor(username: string, device: Device, roomMap: RoomMap, log: AnsiLogger) {
    const cleanModes = getSupportedCleanModes(device.data.model);
    const supportedRunModes = getSupportedRunModes(device.data.model);
    const supportedAreas = getSupportedAreas(device.rooms, roomMap, log);
    super(
      device.name, //name
      device.duid, //serial
      supportedRunModes[0].mode, //currentRunMode
      supportedRunModes, //supportedRunModes
      cleanModes[0].mode, //currentCleanMode
      cleanModes, //supportedCleanModes
      undefined, //currentPhase
      undefined, //phaseList
      RvcOperationalState.OperationalState.Docked, //operationalState
      getOperationalStates(device.data.model), //operationalStateList
      supportedAreas, //supportedAreas
      undefined, //selectedAreas
      supportedAreas[0].areaId, //currentArea
    );

    this.username = username;
    this.device = device;
    this.rrHomeId = device.rrHomeId;
  }

  public configurateHandler(behaviorHandler: BehaviorFactoryResult): void {
    this.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      behaviorHandler.executeCommand('PlaySoundToLocate', identifyTime as number);
    });

    this.addCommandHandler('selectAreas', async ({ request }: { request: ServiceArea.SelectAreasRequest }) => {
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
