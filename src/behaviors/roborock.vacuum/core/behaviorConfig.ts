import { ModeHandlerRegistry } from './modeHandlerRegistry.js';
import { CleaningModeHandler } from '../handlers/cleaningModeHandler.js';
import { GoVacationHandler } from '../handlers/goVacationHandler.js';
import { DefaultCleanModeHandler } from '../handlers/defaultCleanModeHandler.js';
import { PresetCleanModeHandler } from '../handlers/presetCleanModeHandler.js';
import { CustomCleanModeHandler } from '../handlers/customCleanModeHandler.js';
import { SmartPlanHandler } from '../handlers/smartPlanHandler.js';
import { CleanModeSetting } from './CleanModeSetting.js';
import { DefaultRvcCleanMode, SmartRvcCleanMode } from './cleanMode.js';
import { DefaultCleanSetting, SmartCleanSetting } from './cleanSetting.js';
import { baseRunModeConfigs, RunModeConfig } from './runModeConfig.js';

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
    cleanModes: DefaultRvcCleanMode,
    cleanSettings: DefaultCleanSetting,
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
    cleanModes: SmartRvcCleanMode,
    cleanSettings: SmartCleanSetting,
    runModeConfigs: baseRunModeConfigs,
    registry,
  };
}
