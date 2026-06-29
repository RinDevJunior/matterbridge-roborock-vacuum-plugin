import { baseCleanModeConfigs } from '../behaviors/roborock.vacuum/core/cleanModeConfig/index.js';
import { getAllModesForDevice, hasSmartPlan } from '../behaviors/roborock.vacuum/core/deviceCapabilityRegistry.js';
import {
	createDefaultModeResolver,
	createSmartModeResolver,
	ModeResolver,
} from '../behaviors/roborock.vacuum/core/modeResolver.js';
import { DeviceModel } from '../roborockCommunication/models/index.js';

const defaultModeResolver = createDefaultModeResolver(baseCleanModeConfigs);
const resolverCache = new Map<string, ModeResolver>();

/**
 * Get the appropriate clean mode resolver based on device model capabilities.
 * Resolvers are cached per model+featureSet combination for efficiency.
 */
export function getCleanModeResolver(
	model: DeviceModel,
	forceRunAtDefault: boolean,
	featureSet?: string,
	newFeatureSet?: string,
): ModeResolver {
	if (forceRunAtDefault) {
		return defaultModeResolver;
	}

	const key = `${model}|${featureSet ?? ''}|${newFeatureSet ?? ''}`;
	if (!resolverCache.has(key)) {
		const modes = getAllModesForDevice(model, featureSet, newFeatureSet);
		const resolver = hasSmartPlan(model, featureSet, newFeatureSet)
			? createSmartModeResolver(modes)
			: createDefaultModeResolver(modes);
		resolverCache.set(key, resolver);
	}

	return resolverCache.get(key) as ModeResolver;
}
