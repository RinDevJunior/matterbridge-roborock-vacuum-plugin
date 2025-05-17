import { MatterbridgeEndpoint, roboticVacuumCleaner } from 'matterbridge';
import RoomMap from './model/RoomMap.js';
import Device from './roborockCommunication/Zmodel/device.js';

export class RoborockVacuumCleaner extends MatterbridgeEndpoint {
  username: string | undefined;
  device: Device;
  rrHomeId: number;
  roomInfo: RoomMap | undefined;

  constructor(username: string, device: Device, isDebug = false) {
    super(roboticVacuumCleaner, { uniqueStorageKey: `${device.name}-${device.duid}` }, isDebug);

    this.username = username;
    this.device = device;
    this.rrHomeId = device.rrHomeId;
  }
}
