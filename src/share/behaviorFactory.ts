import { AnsiLogger } from 'matterbridge/logger';
import { BehaviorDeviceGeneric } from '../behaviors/BehaviorDeviceGeneric.js';
import { RoborockService } from '../services/roborockService.js';
import { DefaultEndpointCommands, setDefaultCommandHandler } from '../behaviors/roborock.vacuum/default/default.js';
import { CleanModeSettings } from '../model/ExperimentalFeatureSetting.js';
import { EndpointCommandsSmart, setCommandHandlerSmart } from '../behaviors/roborock.vacuum/smart/smart.js';
import { SMART_MODELS } from '../constants/index.js';

export type BehaviorFactoryResult = BehaviorDeviceGeneric<DefaultEndpointCommands> | BehaviorDeviceGeneric<EndpointCommandsSmart>;

/**
 * Configure device behavior handler based on model capabilities.
 * Creates and initializes the appropriate command handler for the device model.
 */
export function configureBehavior(
  model: string,
  duid: string,
  roborockService: RoborockService,
  cleanModeSettings: CleanModeSettings | undefined,
  forceRunAtDefault: boolean,
  logger: AnsiLogger,
): BehaviorFactoryResult {
  // Check if device supports smart planning (unless forced to default)
  const useSmart = !forceRunAtDefault && SMART_MODELS.has(model);

  if (useSmart) {
    const deviceHandler = new BehaviorDeviceGeneric<EndpointCommandsSmart>(logger);
    setCommandHandlerSmart(duid, deviceHandler, logger, roborockService, cleanModeSettings);
    return deviceHandler;
  }

  // Default behavior for all other models
  const deviceHandler = new BehaviorDeviceGeneric<DefaultEndpointCommands>(logger);
  setDefaultCommandHandler(duid, deviceHandler, logger, roborockService, cleanModeSettings);
  return deviceHandler;
}
