import { DeviceModel } from '../roborockCommunication/models/index.js';
import { SMART_MODELS } from '../constants/index.js';
import { baseCleanModeConfigs, smartCleanModeConfigs } from '../behaviors/roborock.vacuum/core/cleanModeConfig.js';
import { createDefaultModeResolver, createSmartModeResolver, ModeResolver } from '../behaviors/roborock.vacuum/core/modeResolver.js';

const smartModeResolver = createSmartModeResolver(smartCleanModeConfigs);
const defaultModeResolver = createDefaultModeResolver(baseCleanModeConfigs);

/**
 * Get the appropriate clean mode function based on device model.
 * Smart models use different clean mode mappings than default models.
 */
export function getCleanModeResolver(model: DeviceModel, forceRunAtDefault: boolean): ModeResolver {
  if (forceRunAtDefault) {
    return defaultModeResolver;
  }

  return SMART_MODELS.has(model) ? smartModeResolver : defaultModeResolver;
}
