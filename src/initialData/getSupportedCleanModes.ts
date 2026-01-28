import { RvcCleanMode } from 'matterbridge/matter/clusters';
import { getSmartSupportedCleanModes } from '../behaviors/roborock.vacuum/smart/initialData.js';
import { getDefaultSupportedCleanModes } from '../behaviors/roborock.vacuum/default/initialData.js';
import { DeviceModel } from '../roborockCommunication/models/index.js';
import { SMART_MODELS } from '../constants/index.js';
import { PlatformConfigManager } from '../platform/platformConfig.js';

export function getSupportedCleanModes(model: DeviceModel, configManager: PlatformConfigManager): RvcCleanMode.ModeOption[] {
  if (configManager.forceRunAtDefault) {
    return getDefaultSupportedCleanModes(configManager);
  }

  if (SMART_MODELS.has(model)) {
    return getSmartSupportedCleanModes(configManager);
  }

  return getDefaultSupportedCleanModes(configManager);
}
