import { decodeFeatureSet } from '../../../share/featureSetDecoder.js';
import { baseCleanModeConfigs, CleanModeConfig, vacFollowedByMopModeConfig } from './cleanModeConfig/index.js';

export function getExtraModes(_model: string, featureSet?: string, newFeatureSet?: string): CleanModeConfig[] {
	const hasFeatureContext = featureSet !== undefined || newFeatureSet !== undefined;

	if (!hasFeatureContext) {
		return [];
	}

	const features = decodeFeatureSet(featureSet, newFeatureSet);
	return features.is_clean_then_mop_mode_supported ? [vacFollowedByMopModeConfig] : [];
}

export function hasSmartPlan(_model: string, featureSet?: string, newFeatureSet?: string): boolean {
	const features = decodeFeatureSet(featureSet, newFeatureSet);
	return features.is_smart_clean_mode_set_supported;
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
	const uniqueByMode = new Map<number, CleanModeConfig>();
	for (const config of [vacFollowedByMopModeConfig, ...baseCleanModeConfigs]) {
		if (!uniqueByMode.has(config.mode)) {
			uniqueByMode.set(config.mode, config);
		}
	}
	return [...uniqueByMode.values()];
}
