import { BehaviorDeviceGeneric, BehaviorRoborock, DeviceEndpointCommands } from '../../BehaviorDeviceGeneric.js';
import { RvcCleanMode as DefaultRvcCleanMode, CleanSetting as DefaultCleanSetting } from '../default/default.js';
import { CleanModeSetting } from '../core/CleanModeSetting.js';
export class BehaviorSmart extends BehaviorRoborock {
  declare state: BehaviorRoborockSmartState;
}

export interface BehaviorRoborockSmartState {
  device: BehaviorDeviceGeneric<DeviceEndpointCommands>;
}

// get_custom_mode
export enum VacuumSuctionPowerSmart {
  Quiet = 101,
  Balanced = 102,
  Turbo = 103,
  Max = 104,
  Off = 105,
  Custom = 106,
  MaxPlus = 108,
  Smart = 110,
}

// get_water_box_custom_mode
export enum MopWaterFlowSmart {
  Off = 200,
  Low = 201,
  Medium = 202,
  High = 203,
  Custom = 204,
  CustomizeWithDistanceOff = 207,
  Smart = 209,
}

// get_mop_mode
export enum MopRouteSmart {
  Standard = 300,
  Deep = 301,
  Custom = 302,
  DeepPlus = 303,
  Fast = 304,
  Smart = 306,
}

export const RvcCleanMode: Record<number, string> = {
  [4]: 'Smart Plan',
  ...DefaultRvcCleanMode,
};

// { suctionPower: [ 102 ], waterFlow: 200, distance_off: 0, mopRoute: [ 102 ] }
export const CleanSetting: Record<number, CleanModeSetting> = {
  [4]: { suctionPower: 0, waterFlow: 0, distance_off: 0, mopRoute: MopRouteSmart.Smart }, // 'Smart Plan'
  ...DefaultCleanSetting,
};
