import { MapEntry } from '../../core/application/models/index.js';
import { DeviceCategory } from './deviceCategory.js';
import { DeviceModel } from './deviceModel.js';
import { DeviceSchema } from './deviceSchema.js';
import { Home, NetworkInfoDTO, TimezoneInfo } from './index.js';
import { Scene } from './scene.js';
import { UserData } from './userData.js';

export interface DeviceSpecs {
  id: string;
  firmwareVersion: string;
  serialNumber: string;
  model: DeviceModel;
  category: DeviceCategory;
  batteryLevel: number;
}

export interface DeviceInformation {
  userData: UserData;
  localKey: string;
  pv: string;
  model: DeviceModel;
  homeData: Home;
}

export type DeviceStatusResponsetype = number | Record<string, number | string | boolean | NetworkInfoDTO | TimezoneInfo | Record<number, unknown>>;

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

  deviceStatus: Record<string, DeviceStatusResponsetype>;
  schema: DeviceSchema[];
  specs: DeviceSpecs;
  store: DeviceInformation;
  scenes?: Scene[];

  mapInfos: MapEntry[] | undefined;
}
