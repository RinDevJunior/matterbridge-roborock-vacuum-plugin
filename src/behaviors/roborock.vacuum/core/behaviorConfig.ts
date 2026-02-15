import { ModeHandlerRegistry } from './modeHandlerRegistry.js';
import { CleaningModeHandler } from '../handlers/cleaningModeHandler.js';
import { GoVacationHandler } from '../handlers/goVacationHandler.js';
import { DefaultCleanModeHandler } from '../handlers/defaultCleanModeHandler.js';
import { PresetCleanModeHandler } from '../handlers/presetCleanModeHandler.js';
import { CustomCleanModeHandler } from '../handlers/customCleanModeHandler.js';
import { SmartPlanHandler } from '../handlers/smartPlanHandler.js';
import { CleanModeSetting } from './CleanModeSetting.js';
import { baseCleanModeConfigs, CleanModeDisplayLabel, CleanModeLabelInfo, getModeDisplayMap, getModeSettingsMap, smartCleanModeConfigs } from './cleanModeConfig.js';
import { baseRunModeConfigs, RunModeConfig } from './runModeConfig.js';

const goVacationEntry = {
  [CleanModeLabelInfo[CleanModeDisplayLabel.GoVacation].mode]: CleanModeLabelInfo[CleanModeDisplayLabel.GoVacation].label,
};

const defaultCleanModes = { ...getModeDisplayMap(baseCleanModeConfigs), ...goVacationEntry };
const smartCleanModes = { ...getModeDisplayMap(smartCleanModeConfigs), ...goVacationEntry };

export interface BehaviorConfig {
  name: string;
  cleanModes: Record<number, string>;
  cleanSettings: Record<number, CleanModeSetting>;
  runModeConfigs: RunModeConfig[];
  registry: ModeHandlerRegistry;
}

export function createDefaultBehaviorConfig(): BehaviorConfig {
  const registry = new ModeHandlerRegistry()
    .register(new CleaningModeHandler())
    .register(new GoVacationHandler())
    .register(new DefaultCleanModeHandler())
    .register(new PresetCleanModeHandler())
    .register(new CustomCleanModeHandler());

  return {
    name: 'DefaultBehavior',
    cleanModes: defaultCleanModes,
    cleanSettings: getModeSettingsMap(baseCleanModeConfigs),
    runModeConfigs: baseRunModeConfigs,
    registry,
  };
}

export function createSmartBehaviorConfig(): BehaviorConfig {
  const registry = new ModeHandlerRegistry()
    .register(new CleaningModeHandler())
    .register(new GoVacationHandler())
    .register(new SmartPlanHandler())
    .register(new DefaultCleanModeHandler())
    .register(new PresetCleanModeHandler())
    .register(new CustomCleanModeHandler());

  return {
    name: 'BehaviorSmart',
    cleanModes: smartCleanModes,
    cleanSettings: getModeSettingsMap(smartCleanModeConfigs),
    runModeConfigs: baseRunModeConfigs,
    registry,
  };
}
