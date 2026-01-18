import { RvcCleanMode } from 'matterbridge/matter/clusters';
import { getSupportedCleanModesSmart } from '../behaviors/roborock.vacuum/smart/initialData.js';
import { getDefaultSupportedCleanModes } from '../behaviors/roborock.vacuum/default/initialData.js';
import { DeviceModel } from '../roborockCommunication/Zmodel/deviceModel.js';
import { ExperimentalFeatureSetting } from '../model/ExperimentalFeatureSetting.js';
import { SMART_MODELS } from '../constants/index.js';

export function getSupportedCleanModes(model: DeviceModel, enableExperimentalFeature: ExperimentalFeatureSetting | undefined): RvcCleanMode.ModeOption[] {
  if (enableExperimentalFeature?.advancedFeature?.forceRunAtDefault ?? false) {
    return getDefaultSupportedCleanModes(enableExperimentalFeature);
  }

  if (SMART_MODELS.has(model)) {
    return getSupportedCleanModesSmart(enableExperimentalFeature);
  }

  return getDefaultSupportedCleanModes(enableExperimentalFeature);
}
