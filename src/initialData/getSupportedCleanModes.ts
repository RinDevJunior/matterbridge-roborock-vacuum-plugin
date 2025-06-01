import { RvcCleanMode } from 'matterbridge/matter/clusters';
import { getSupportedCleanModesA187 } from '../behaviors/roborock.vacuum/QREVO_EDGE_5V1/initalData.js';
import { getDefaultSupportedCleanModes } from '../behaviors/roborock.vacuum/default/initalData.js';
import { DeviceModel } from '../roborockCommunication/Zmodel/deviceModel.js';
import { getSupportedCleanModesA27 } from '../behaviors/roborock.vacuum/S7_MAXV/initalData.js';

export function getSupportedCleanModes(model: string): RvcCleanMode.ModeOption[] {
  switch (model) {
    case DeviceModel.QREVO_EDGE_5V1:
      return getSupportedCleanModesA187();
    case DeviceModel.S7_MAXV:
      return getSupportedCleanModesA27();
    default:
      return getDefaultSupportedCleanModes();
  }
}
