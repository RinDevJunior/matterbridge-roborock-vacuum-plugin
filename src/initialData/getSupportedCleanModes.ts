import { RvcCleanMode } from 'matterbridge/matter/clusters';
import { DeviceModel } from '../roborockCommunication/models/index.js';
import { PlatformConfigManager } from '../platform/platformConfigManager.js';
import {
  baseCleanModeConfigs,
  CleanModeDisplayLabel,
  CleanModeLabelInfo,
  getModeOptions,
} from '../behaviors/roborock.vacuum/core/cleanModeConfig.js';
import { getAllModesForDevice } from '../behaviors/roborock.vacuum/core/deviceCapabilityRegistry.js';

const defaultModes = getModeOptions(baseCleanModeConfigs);

export function getSupportedCleanModes(
  model: DeviceModel,
  configManager: PlatformConfigManager,
): RvcCleanMode.ModeOption[] {
  if (configManager.forceRunAtDefault) {
    return getDefaultSupportedCleanModes(configManager, [...defaultModes]);
  }

  const supportedModes = getModeOptions(getAllModesForDevice(model as string));
  return getDefaultSupportedCleanModes(configManager, supportedModes);
}

function getDefaultSupportedCleanModes(
  configManager: PlatformConfigManager,
  supportedModes: RvcCleanMode.ModeOption[],
): RvcCleanMode.ModeOption[] {
  // Add vacation mode if enabled
  if (configManager.useVacationModeToSendVacuumToDock) {
    supportedModes.push({
      mode: CleanModeLabelInfo[CleanModeDisplayLabel.GoVacation].mode,
      label: CleanModeLabelInfo[CleanModeDisplayLabel.GoVacation].label,
      modeTags: [
        { value: RvcCleanMode.ModeTag.Mop },
        { value: RvcCleanMode.ModeTag.Vacuum },
        { value: RvcCleanMode.ModeTag.Vacation },
      ],
    });
  }

  return supportedModes;
}
