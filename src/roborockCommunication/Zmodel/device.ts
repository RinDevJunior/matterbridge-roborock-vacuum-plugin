import { DeviceSchema } from './deviceSchema.js';
import { Room } from './room.js';
import { Scene } from './scene.js';
import { UserData } from './userData.js';

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

  data: {
    id: string;
    firmwareVersion: string;
    serialNumber: string;
    model: string;
    category: string;
    batteryLevel: number;
  };

  store?: {
    userData: UserData;
    localKey: string;
    pv: string;
    model?: string;
  };

  scenes?: Scene[];
}
