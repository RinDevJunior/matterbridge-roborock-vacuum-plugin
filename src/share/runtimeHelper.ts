import { DeviceModel } from '../roborockCommunication/models/index.js';
import { baseCleanModeConfigs } from '../behaviors/roborock.vacuum/core/cleanModeConfig.js';
import {
  createDefaultModeResolver,
  createSmartModeResolver,
  ModeResolver,
} from '../behaviors/roborock.vacuum/core/modeResolver.js';
import { getAllModesForDevice, hasSmartPlan } from '../behaviors/roborock.vacuum/core/deviceCapabilityRegistry.js';

const defaultModeResolver = createDefaultModeResolver(baseCleanModeConfigs);
const resolverCache = new Map<string, ModeResolver>();

/**
 * Get the appropriate clean mode resolver based on device model capabilities.
 * Resolvers are cached per model for efficiency.
 */
export function getCleanModeResolver(model: DeviceModel, forceRunAtDefault: boolean): ModeResolver {
  if (forceRunAtDefault) {
    return defaultModeResolver;
  }

  const key = model as string;
  if (!resolverCache.has(key)) {
    const modes = getAllModesForDevice(key);
    const resolver = hasSmartPlan(key) ? createSmartModeResolver(modes) : createDefaultModeResolver(modes);
    resolverCache.set(key, resolver);
  }

  return resolverCache.get(key)!;
}
