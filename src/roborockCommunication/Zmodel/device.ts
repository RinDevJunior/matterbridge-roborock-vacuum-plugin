import { DeviceSchema } from './deviceSchema.js';
import { Room } from './room.js';

export interface Device {
  duid: string;
  name: string;
  sn: string;
  serialNumber: string;

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
}
