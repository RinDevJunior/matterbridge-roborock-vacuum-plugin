import { DeviceModel } from '../../../roborockCommunication/models/index.js';
import { decodeFeatureSet } from '../../../share/featureSetDecoder.js';
import {
	baseCleanModeConfigs,
	CleanModeConfig,
	CleanModeDisplayLabel,
	smartPlanModeConfig,
	vacAndMopDeepModeConfig,
	vacFollowedByMopModeConfig,
} from './cleanModeConfig/index.js';

/**
 * Registry mapping device models to their extra clean mode capabilities.
 *
 * === HOW TO ADD SUPPORT FOR YOUR DEVICE ===
 * Add a new entry with the device model and the list of extra modes it supports.
 * Example (device that only has VacFollowedByMop):
 *   [DeviceModel.MY_NEW_DEVICE]: [vacFollowedByMopModeConfig],
 *
 * === HOW TO ADD A NEW CLEAN MODE ===
 * 1. Add the label to CleanModeDisplayLabel in cleanModeConfig.ts
 * 2. Add the mode entry in CleanModeLabelInfo in cleanModeConfig.ts
 * 3. Create a new CleanModeConfig const in cleanModeConfig.ts and export it
 * 4. If the mode needs special handling, add a new handler in handlers/
 * 5. Register the handler in buildBehaviorConfig() in behaviorConfig.ts
 * 6. Add the mode to the relevant device entries below
 */
export const DEVICE_EXTRA_MODES: Partial<Record<string, CleanModeConfig[]>> = {
	[DeviceModel.QREVO_EDGE_5V1]: [smartPlanModeConfig, vacFollowedByMopModeConfig],
	[DeviceModel.QREVO_PLUS]: [smartPlanModeConfig, vacFollowedByMopModeConfig],
	[DeviceModel.QREVO_MAXV]: [smartPlanModeConfig, vacFollowedByMopModeConfig],
	[DeviceModel.Q10_S5_PLUS]: [vacFollowedByMopModeConfig, vacAndMopDeepModeConfig],
};

/**
 * Get the extra clean modes for a device beyond the base modes.
 * Returns an empty array if the device has no extra modes.
 * If featureSet and/or newFeatureSet are provided, dynamically filters modes
 * based on device capabilities (e.g., VacFollowedByMop gated on is_clean_then_mop_mode_supported).
 */
export function getExtraModes(model: string, featureSet?: string, newFeatureSet?: string): CleanModeConfig[] {
	const staticModes = DEVICE_EXTRA_MODES[model] ?? [];
	const hasFeatureContext = featureSet !== undefined || newFeatureSet !== undefined;

	if (!hasFeatureContext) {
		return staticModes;
	}

	const features = decodeFeatureSet(featureSet, newFeatureSet);
	return staticModes.filter((config) => {
		if (config.mode === vacFollowedByMopModeConfig.mode) {
			return features.is_clean_then_mop_mode_supported;
		}
		return true; // Smart Plan, VacAndMopDeep — static only, always pass through
	});
}

/**
 * Check if a device supports the Smart Plan clean mode.
 */
export function hasSmartPlan(model: string): boolean {
	return getExtraModes(model).some((c) => c.label === CleanModeDisplayLabel.SmartPlan);
}

/**
 * Get all clean modes for a device: extra modes first, then base modes.
 * If featureSet and/or newFeatureSet are provided, dynamically filters modes
 * based on device capabilities.
 */
export function getAllModesForDevice(model: string, featureSet?: string, newFeatureSet?: string): CleanModeConfig[] {
	return [...getExtraModes(model, featureSet, newFeatureSet), ...baseCleanModeConfigs];
}

/**
 * Get all known clean mode configs across all devices and base modes (deduped by mode number).
 * Useful for mode label lookups when the device model is not available.
 */
export function getAllKnownModeConfigs(): CleanModeConfig[] {
	const allExtra = (Object.values(DEVICE_EXTRA_MODES) as CleanModeConfig[][]).flat();
	const uniqueByMode = new Map<number, CleanModeConfig>();
	for (const config of [...allExtra, ...baseCleanModeConfigs]) {
		if (!uniqueByMode.has(config.mode)) {
			uniqueByMode.set(config.mode, config);
		}
	}
	return [...uniqueByMode.values()];
}
