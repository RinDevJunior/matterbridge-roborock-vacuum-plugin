import { CleanModeSetting } from '../behaviors/roborock.vacuum/default/default.js';
import { getCurrentCleanModeDefault } from '../behaviors/roborock.vacuum/default/runtimes.js';
import { getCurrentCleanModeSmart } from '../behaviors/roborock.vacuum/smart/runtimes.js';
import { DeviceModel } from '../roborockCommunication/models/index.js';
import { SMART_MODELS } from '../constants/index.js';

export type CleanModeFunc = (setting: CleanModeSetting) => number | undefined;

/**
 * Get the appropriate clean mode function based on device model.
 * Smart models use different clean mode mappings than default models.
 * @param model - Device model identifier
 * @param forceRunAtDefault - Force default behavior regardless of model
 * @returns Function to determine current clean mode from settings
 */
export function getCurrentCleanModeFunc(model: DeviceModel, forceRunAtDefault: boolean): CleanModeFunc {
  if (forceRunAtDefault) {
    return getCurrentCleanModeDefault;
  }

  return SMART_MODELS.has(model) ? getCurrentCleanModeSmart : getCurrentCleanModeDefault;
}
