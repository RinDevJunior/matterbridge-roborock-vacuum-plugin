import { RvcCleanMode } from 'matterbridge/matter/clusters';
import { getSupportedCleanModesSmart } from '../behaviors/roborock.vacuum/smart/initalData.js';
import { getDefaultSupportedCleanModes } from '../behaviors/roborock.vacuum/default/initalData.js';
import { DeviceModel } from '../roborockCommunication/Zmodel/deviceModel.js';
import { ExperimentalFeatureSetting } from '../model/ExperimentalFeatureSetting.js';

export function getSupportedCleanModes(model: string, enableExperimentalFeature: ExperimentalFeatureSetting | undefined): RvcCleanMode.ModeOption[] {
  if (enableExperimentalFeature?.advancedFeature?.forceRunAtDefault ?? false) {
    return getDefaultSupportedCleanModes(enableExperimentalFeature);
  }

  switch (model) {
    case DeviceModel.QREVO_EDGE_5V1:
      return getSupportedCleanModesSmart(enableExperimentalFeature);

    case DeviceModel.S7_MAXV:
    case DeviceModel.S8_PRO_ULTRA:
    case DeviceModel.S6_PURE:
    default:
      return getDefaultSupportedCleanModes(enableExperimentalFeature);
  }
}
