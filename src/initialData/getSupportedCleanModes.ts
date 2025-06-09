import { RvcCleanMode } from 'matterbridge/matter/clusters';
import { getSupportedCleanModesSmart } from '../behaviors/roborock.vacuum/smart/initalData.js';
import { getDefaultSupportedCleanModes } from '../behaviors/roborock.vacuum/default/initalData.js';
import { DeviceModel } from '../roborockCommunication/Zmodel/deviceModel.js';

export function getSupportedCleanModes(model: string): RvcCleanMode.ModeOption[] {
  switch (model) {
    case DeviceModel.QREVO_EDGE_5V1:
      return getSupportedCleanModesSmart();

    case DeviceModel.S7_MAXV:
    case DeviceModel.S8_PRO_ULTRA:
    case DeviceModel.S6_PURE:
    default:
      return getDefaultSupportedCleanModes();
  }
}
