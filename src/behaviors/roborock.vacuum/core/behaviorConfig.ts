import { DeviceModel } from '../../../roborockCommunication/models/index.js';
import { CleaningModeHandler } from '../handlers/cleaningModeHandler.js';
import { CustomCleanModeHandler } from '../handlers/customCleanModeHandler.js';
import { DefaultCleanModeHandler } from '../handlers/defaultCleanModeHandler.js';
import { GoVacationHandler } from '../handlers/goVacationHandler.js';
import { PresetCleanModeHandler } from '../handlers/presetCleanModeHandler.js';
import { SmartPlanHandler } from '../handlers/smartPlanHandler.js';
import {
	CleanModeDisplayLabel,
	CleanModeLabelInfo,
	getModeDisplayMap,
	getModeSettingsMap,
} from './cleanModeConfig/index.js';
import { CleanModeSetting } from './CleanModeSetting.js';
import { getAllModesForDevice, hasSmartPlan } from './deviceCapabilityRegistry.js';
import { ModeHandlerRegistry } from './modeHandlerRegistry.js';
import { baseRunModeConfigs, RunModeConfig } from './runModeConfig.js';

const goVacationEntry = {
	[CleanModeLabelInfo[CleanModeDisplayLabel.GoVacation].mode]:
		CleanModeLabelInfo[CleanModeDisplayLabel.GoVacation].label,
};

export interface BehaviorConfig {
	name: string;
	cleanModes: Record<number, string>;
	cleanSettings: Record<number, CleanModeSetting>;
	runModeConfigs: RunModeConfig[];
	registry: ModeHandlerRegistry;
}

const configCache = new Map<string, BehaviorConfig>();

/**
 * Build a BehaviorConfig for the given device model.
 * Extra modes are resolved from the device capability registry.
 * Results are cached per model for efficiency.
 */
export function buildBehaviorConfig(model: string, featureSet?: string, newFeatureSet?: string): BehaviorConfig {
	const cacheKey = `${model}|${featureSet ?? ''}|${newFeatureSet ?? ''}`;
	if (configCache.has(cacheKey)) {
		return configCache.get(cacheKey) as BehaviorConfig;
	}

	const withSmartPlan = hasSmartPlan(model, featureSet, newFeatureSet);
	const allModes = getAllModesForDevice(model, featureSet, newFeatureSet);

	const registry = new ModeHandlerRegistry().register(new CleaningModeHandler()).register(new GoVacationHandler());

	if (withSmartPlan) {
		registry.register(new SmartPlanHandler());
	}

	registry
		.register(new DefaultCleanModeHandler())
		.register(new PresetCleanModeHandler())
		.register(new CustomCleanModeHandler());

	const config: BehaviorConfig = {
		name: withSmartPlan ? 'BehaviorSmart' : 'DefaultBehavior',
		cleanModes: { ...getModeDisplayMap(allModes), ...goVacationEntry },
		cleanSettings: getModeSettingsMap(allModes),
		runModeConfigs: baseRunModeConfigs,
		registry,
	};

	configCache.set(cacheKey, config);
	return config;
}

/**
 * @deprecated Use buildBehaviorConfig(model) instead.
 */
export function createDefaultBehaviorConfig(): BehaviorConfig {
	return buildBehaviorConfig('');
}

/**
 * @deprecated Use buildBehaviorConfig(model, featureSet, newFeatureSet) instead.
 */
export function createSmartBehaviorConfig(): BehaviorConfig {
	return buildBehaviorConfig(DeviceModel.QREVO_EDGE_5V1, '2247397454282751', '00040040282834C9C2FA8F5C7EDEFFFE');
}
