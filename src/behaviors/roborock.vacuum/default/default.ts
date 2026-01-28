import { BehaviorDeviceGeneric, BehaviorRoborock, DeviceEndpointCommands } from '../../BehaviorDeviceGeneric.js';
import { CleanModeSetting } from '../core/CleanModeSetting.js';

export class DefaultBehavior extends BehaviorRoborock {
  declare state: DefaultBehaviorRoborockState;
}

export interface DefaultBehaviorRoborockState {
  device: BehaviorDeviceGeneric<DeviceEndpointCommands>;
}

// suction_power
export enum VacuumSuctionPower {
  Quiet = 101,
  Balanced = 102,
  Turbo = 103,
  Max = 104,
  Off = 105,
  Custom = 106,
  MaxPlus = 108,
}

// water_box_mode
export enum MopWaterFlow {
  Off = 200,
  Low = 201,
  Medium = 202,
  High = 203,
  Custom = 204,
  CustomizeWithDistanceOff = 207,
}

// set_mop_mode
export enum MopRoute {
  Standard = 300,
  Deep = 301,
  Custom = 302,
  DeepPlus = 303,
  Fast = 304,
}

export const RvcCleanMode: Record<number, string> = {
  [5]: 'Mop & Vacuum: Default',
  [6]: 'Mop & Vacuum: Quick',
  [7]: 'Mop & Vacuum: Max',
  [8]: 'Mop & Vacuum: Min',
  [9]: 'Mop & Vacuum: Quiet',
  [10]: 'Mop & Vacuum: Custom',

  [31]: 'Mop: Default',
  [32]: 'Mop: Max',
  [33]: 'Mop: Min',
  [34]: 'Mop: Quick',
  [35]: 'Mop: DeepClean',

  [66]: 'Vacuum: Default',
  [67]: 'Vacuum: Max',
  [68]: 'Vacuum: Quiet',
  [69]: 'Vacuum: Quick',

  [99]: 'Go Vacation',
};

export const CleanSetting: Record<number, CleanModeSetting> = {
  [5]: { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Standard }, // 'Vac & Mop Default'
  [6]: { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Fast }, // 'Vac & Mop Quick'

  [7]: { suctionPower: VacuumSuctionPower.Max, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Standard }, // 'Vac & Mop Max'
  [8]: { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Low, distance_off: 0, mopRoute: MopRoute.Standard }, // 'Vac & Mop Min'
  [9]: { suctionPower: VacuumSuctionPower.Quiet, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Standard }, // 'Vac & Mop Quiet'

  [10]: { suctionPower: VacuumSuctionPower.Custom, waterFlow: MopWaterFlow.Custom, distance_off: 0, mopRoute: MopRoute.Custom }, // 'Vac & Mop Custom -> LowEnergy'

  [31]: { suctionPower: VacuumSuctionPower.Off, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Standard }, // 'Mop Default'
  [32]: { suctionPower: VacuumSuctionPower.Off, waterFlow: MopWaterFlow.High, distance_off: 0, mopRoute: MopRoute.Standard }, // 'MopMax'
  [33]: { suctionPower: VacuumSuctionPower.Off, waterFlow: MopWaterFlow.Low, distance_off: 0, mopRoute: MopRoute.Standard }, // 'MopMin'
  [34]: { suctionPower: VacuumSuctionPower.Off, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Fast }, // 'MopQuick'
  [35]: { suctionPower: VacuumSuctionPower.Off, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Deep }, // 'MopDeepClean'

  [66]: { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Off, distance_off: 0, mopRoute: MopRoute.Standard }, // 'Vacuum Default'
  [67]: { suctionPower: VacuumSuctionPower.Max, waterFlow: MopWaterFlow.Off, distance_off: 0, mopRoute: MopRoute.Standard }, // 'VacuumMax'
  [68]: { suctionPower: VacuumSuctionPower.Quiet, waterFlow: MopWaterFlow.Off, distance_off: 0, mopRoute: MopRoute.Standard }, // 'VacuumQuiet'
  [69]: { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Off, distance_off: 0, mopRoute: MopRoute.Fast }, // 'VacuumQuick'
};
