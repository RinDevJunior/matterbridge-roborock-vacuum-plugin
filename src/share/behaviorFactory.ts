import { AnsiLogger } from 'matterbridge/logger';
import { BehaviorDeviceGeneric, CommandNames, DeviceEndpointCommands } from '../behaviors/BehaviorDeviceGeneric.js';
import { RoborockService } from '../services/roborockService.js';
import { BehaviorConfig, buildBehaviorConfig } from '../behaviors/roborock.vacuum/core/behaviorConfig.js';
import { registerCommonCommands } from '../behaviors/roborock.vacuum/core/commonCommands.js';
import { HandlerContext } from '../behaviors/roborock.vacuum/core/modeHandler.js';
import { DeviceModel } from '../roborockCommunication/models/index.js';
import { getRunModeDisplayMap } from '../behaviors/roborock.vacuum/core/runModeConfig.js';
import { CleanModeSettings } from '../model/RoborockPluginPlatformConfig.js';

export type BehaviorFactoryResult = BehaviorDeviceGeneric<DeviceEndpointCommands>;

/**
 * Configure device behavior handler based on model capabilities.
 * Creates and initializes the appropriate command handler for the device model.
 */
export function configureBehavior(
  model: DeviceModel | string,
  duid: string,
  roborockService: RoborockService,
  enableCleanModeMapping: boolean,
  cleanModeSettings: CleanModeSettings | undefined,
  forceRunAtDefault: boolean,
  logger: AnsiLogger,
): BehaviorFactoryResult {
  const modelKey = forceRunAtDefault ? '' : (model as string);
  const config = buildBehaviorConfig(modelKey);
  const deviceHandler = new BehaviorDeviceGeneric<DeviceEndpointCommands>(logger);
  setCommandHandler(duid, deviceHandler, logger, roborockService, enableCleanModeMapping, cleanModeSettings, config);
  return deviceHandler;
}

function setCommandHandler(
  duid: string,
  handler: BehaviorDeviceGeneric<DeviceEndpointCommands>,
  logger: AnsiLogger,
  roborockService: RoborockService,
  enableCleanModeMapping: boolean,
  cleanModeSettings: CleanModeSettings | undefined,
  config: BehaviorConfig,
): void {
  const runModeMap = getRunModeDisplayMap(config.runModeConfigs);
  handler.setCommandHandler(CommandNames.CHANGE_TO_MODE, async (newMode: number) => {
    const activity = runModeMap[newMode] || config.cleanModes[newMode];
    const context: HandlerContext = {
      roborockService,
      logger,
      enableCleanModeMapping: enableCleanModeMapping,
      cleanModeSettings,
      cleanSettings: config.cleanSettings,
      behaviorName: config.name,
    };
    await config.registry.handle(duid, newMode, activity, context);
  });

  registerCommonCommands(duid, handler, logger, roborockService, config.name);
}
