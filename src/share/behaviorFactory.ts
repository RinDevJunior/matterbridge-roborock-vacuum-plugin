import { AnsiLogger } from 'matterbridge/logger';
import { BehaviorDeviceGeneric, CommandNames, DeviceEndpointCommands } from '../behaviors/BehaviorDeviceGeneric.js';
import { RoborockService } from '../services/roborockService.js';
import { CleanModeSettings } from '../model/ExperimentalFeatureSetting.js';
import { SMART_MODELS } from '../constants/index.js';
import { BehaviorConfig, createDefaultBehaviorConfig, createSmartBehaviorConfig } from '../behaviors/roborock.vacuum/core/behaviorConfig.js';
import { registerCommonCommands } from '../behaviors/roborock.vacuum/core/commonCommands.js';
import { HandlerContext } from '../behaviors/roborock.vacuum/core/modeHandler.js';
import { DeviceModel } from '../roborockCommunication/models/index.js';
import { getRunModeDisplayMap } from '../behaviors/roborock.vacuum/core/runModeConfig.js';

export type BehaviorFactoryResult = BehaviorDeviceGeneric<DeviceEndpointCommands>;
const smartConfig = createSmartBehaviorConfig();
const defaultConfig = createDefaultBehaviorConfig();

/**
 * Configure device behavior handler based on model capabilities.
 * Creates and initializes the appropriate command handler for the device model.
 */
export function configureBehavior(
  model: DeviceModel | string,
  duid: string,
  roborockService: RoborockService,
  cleanModeSettings: CleanModeSettings | undefined,
  forceRunAtDefault: boolean,
  logger: AnsiLogger,
): BehaviorFactoryResult {
  const useSmart = !forceRunAtDefault && SMART_MODELS.has(model as DeviceModel);

  const deviceHandler = new BehaviorDeviceGeneric<DeviceEndpointCommands>(logger);

  if (useSmart) {
    setCommandHandler(duid, deviceHandler, logger, roborockService, cleanModeSettings, smartConfig);
    return deviceHandler;
  }

  setCommandHandler(duid, deviceHandler, logger, roborockService, cleanModeSettings, defaultConfig);
  return deviceHandler;
}

/**
 * Register command handlers for smart device behavior.
 * Smart models support additional 'Smart Plan' mode and enhanced clean mode mappings.
 */
function setCommandHandler(
  duid: string,
  handler: BehaviorDeviceGeneric<DeviceEndpointCommands>,
  logger: AnsiLogger,
  roborockService: RoborockService,
  cleanModeSettings: CleanModeSettings | undefined,
  config: BehaviorConfig = defaultConfig,
): void {
  const runModeMap = getRunModeDisplayMap(config.runModeConfigs);
  handler.setCommandHandler(CommandNames.CHANGE_TO_MODE, async (newMode: number) => {
    const activity = runModeMap[newMode] || config.cleanModes[newMode];
    const context: HandlerContext = {
      roborockService,
      logger,
      cleanModeSettings,
      cleanSettings: config.cleanSettings,
      behaviorName: config.name,
    };
    await config.registry.handle(duid, newMode, activity, context);
  });

  registerCommonCommands(duid, handler, logger, roborockService, config.name);
}
