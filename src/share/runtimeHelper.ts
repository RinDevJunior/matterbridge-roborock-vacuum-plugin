import { CleanModeSetting } from '../behaviors/roborock.vacuum/default/default.js';
import { getCurrentCleanModeDefault } from '../behaviors/roborock.vacuum/default/runtimes.js';
import { getCurrentCleanModeSmart } from '../behaviors/roborock.vacuum/smart/runtimes.js';
import { DeviceModel } from '../roborockCommunication/Zmodel/deviceModel.js';

export type CleanModeFunc = (setting: CleanModeSetting) => number | undefined;

export function getCurrentCleanModeFunc(model: string, forceRunAtDefault: boolean): CleanModeFunc {
  if (forceRunAtDefault) {
    return getCurrentCleanModeDefault;
  }

  switch (model) {
    case DeviceModel.QREVO_EDGE_5V1:
    case DeviceModel.QREVO_PLUS:
      return getCurrentCleanModeSmart;

    case DeviceModel.S7_MAXV:
    case DeviceModel.S8_PRO_ULTRA:
    case DeviceModel.S6_PURE:
    default:
      return getCurrentCleanModeDefault;
  }
}
