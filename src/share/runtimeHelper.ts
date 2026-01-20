import { CleanModeDTO, getCurrentCleanModeSmart, getCurrentCleanModeDefault } from '../behaviors/index.js';
import { DeviceModel } from '@/roborockCommunication/index.js';
import { SMART_MODELS } from '@/constants/index.js';

export type CleanModeFunc = (setting: CleanModeDTO) => number | undefined;

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
