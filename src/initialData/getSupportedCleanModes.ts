import { RvcCleanMode } from 'matterbridge/matter/clusters';
import { DeviceModel } from '../roborockCommunication/models/index.js';
import { SMART_MODELS } from '../constants/index.js';
import { PlatformConfigManager } from '../platform/platformConfig.js';
import { baseCleanModeConfigs, CleanModeDisplayLabel, CleanModeLabelInfo, getModeOptions, smartCleanModeConfigs } from '../behaviors/roborock.vacuum/core/cleanModeConfig.js';

const smartModes = getModeOptions(smartCleanModeConfigs);
const defaultModes = getModeOptions(baseCleanModeConfigs);

export function getSupportedCleanModes(model: DeviceModel, configManager: PlatformConfigManager): RvcCleanMode.ModeOption[] {
  if (configManager.forceRunAtDefault) {
    return getDefaultSupportedCleanModes(configManager, defaultModes);
  }

  let supportedModes = defaultModes;
  if (SMART_MODELS.has(model)) {
    return (supportedModes = smartModes);
  }

  return getDefaultSupportedCleanModes(configManager, supportedModes);
}

function getDefaultSupportedCleanModes(configManager: PlatformConfigManager, supportedModes: RvcCleanMode.ModeOption[]): RvcCleanMode.ModeOption[] {
  // Add vacation mode if enabled
  if (configManager.useVacationModeToSendVacuumToDock) {
    supportedModes.push({
      mode: CleanModeLabelInfo[CleanModeDisplayLabel.GoVacation].mode,
      label: CleanModeLabelInfo[CleanModeDisplayLabel.GoVacation].label,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }, { value: RvcCleanMode.ModeTag.Vacation }],
    });
  }

  return supportedModes;
}
