import { RvcCleanMode } from 'matterbridge/matter/clusters';
import { getSupportedCleanModesSmart } from '../behaviors/roborock.vacuum/smart/initialData.js';
import { getDefaultSupportedCleanModes } from '../behaviors/roborock.vacuum/default/initialData.js';
import { DeviceModel } from '../roborockCommunication/models/index.js';
import { ExperimentalFeatureSetting } from '../model/ExperimentalFeatureSetting.js';
import { SMART_MODELS } from '../constants/index.js';

export function getSupportedCleanModes(model: DeviceModel, experimentalFeatureSetting: ExperimentalFeatureSetting | undefined): RvcCleanMode.ModeOption[] {
  if (experimentalFeatureSetting?.advancedFeature?.forceRunAtDefault ?? false) {
    return getDefaultSupportedCleanModes(experimentalFeatureSetting);
  }

  if (SMART_MODELS.has(model)) {
    return getSupportedCleanModesSmart(experimentalFeatureSetting);
  }

  return getDefaultSupportedCleanModes(experimentalFeatureSetting);
}
