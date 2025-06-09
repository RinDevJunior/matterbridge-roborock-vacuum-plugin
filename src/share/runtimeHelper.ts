import { getCurrentCleanModeDefault } from '../behaviors/roborock.vacuum/default/runtimes.js';
import { getCurrentCleanModeSmart } from '../behaviors/roborock.vacuum/smart/runtimes.js';
import { DeviceModel } from '../roborockCommunication/Zmodel/deviceModel.js';

export type CleanModeFunc = (setting: { suctionPower: number; waterFlow: number; distance_off: number; mopRoute: number }) => number | undefined;

export function getCurrentCleanModeFunc(model: string): CleanModeFunc {
  switch (model) {
    case DeviceModel.QREVO_EDGE_5V1:
      return getCurrentCleanModeSmart;

    case DeviceModel.S7_MAXV:
    case DeviceModel.S8_PRO_ULTRA:
    case DeviceModel.S6_PURE:
    default:
      return getCurrentCleanModeDefault;
  }
}
