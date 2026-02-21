import { ModeHandlerRegistry } from './modeHandlerRegistry.js';
import { CleaningModeHandler } from '../handlers/cleaningModeHandler.js';
import { GoVacationHandler } from '../handlers/goVacationHandler.js';
import { DefaultCleanModeHandler } from '../handlers/defaultCleanModeHandler.js';
import { PresetCleanModeHandler } from '../handlers/presetCleanModeHandler.js';
import { CustomCleanModeHandler } from '../handlers/customCleanModeHandler.js';
import { SmartPlanHandler } from '../handlers/smartPlanHandler.js';
import { CleanModeSetting } from './CleanModeSetting.js';
import { CleanModeDisplayLabel, CleanModeLabelInfo, getModeDisplayMap, getModeSettingsMap } from './cleanModeConfig.js';
import { baseRunModeConfigs, RunModeConfig } from './runModeConfig.js';
import { getAllModesForDevice, hasSmartPlan } from './deviceCapabilityRegistry.js';
import { DeviceModel } from '../../../roborockCommunication/models/index.js';

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
export function buildBehaviorConfig(model: string): BehaviorConfig {
  if (configCache.has(model)) {
    return configCache.get(model)!;
  }

  const withSmartPlan = hasSmartPlan(model);
  const allModes = getAllModesForDevice(model);

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

  configCache.set(model, config);
  return config;
}

/**
 * @deprecated Use buildBehaviorConfig(model) instead.
 */
export function createDefaultBehaviorConfig(): BehaviorConfig {
  return buildBehaviorConfig('');
}

/**
 * @deprecated Use buildBehaviorConfig(model) instead.
 */
export function createSmartBehaviorConfig(): BehaviorConfig {
  return buildBehaviorConfig(DeviceModel.QREVO_EDGE_5V1);
}
