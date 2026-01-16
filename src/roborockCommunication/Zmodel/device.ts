import { DeviceModel } from './deviceModel.js';
import { DeviceSchema } from './deviceSchema.js';
import { Room } from './room.js';
import { Scene } from './scene.js';
import { UserData } from './userData.js';

export interface DeviceData {
  id: string;
  firmwareVersion: string;
  serialNumber: string;
  model: DeviceModel;
  category: string;
  batteryLevel: number;
}

interface DeviceInformation {
  userData: UserData;
  localKey: string;
  pv: string;
  model?: string;
}

export interface Device {
  duid: string;
  name: string;
  sn: string;
  serialNumber: string;

  featureSet?: string;
  newFeatureSet?: string;
  silentOtaSwitch?: boolean;

  activeTime: number;
  createTime: number;
  localKey: string;

  /** The protocol version of the robot. */
  pv: string;
  online: boolean;
  productId: string;
  rrHomeId: number;
  /** The firmware version of the robot. */
  fv: string;

  deviceStatus: Record<string, number>;
  rooms: Room[];
  schema: DeviceSchema[];
  data: DeviceData;
  store?: DeviceInformation;
  scenes?: Scene[];
}
