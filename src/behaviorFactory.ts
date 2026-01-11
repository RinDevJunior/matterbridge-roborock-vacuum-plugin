import { AnsiLogger } from 'matterbridge/logger';
import { BehaviorDeviceGeneric } from './behaviors/BehaviorDeviceGeneric.js';
import RoborockService from './roborockService.js';
import { DefaultEndpointCommands, setDefaultCommandHandler } from './behaviors/roborock.vacuum/default/default.js';
import { CleanModeSettings } from './model/ExperimentalFeatureSetting.js';
import { EndpointCommandsSmart, setCommandHandlerSmart } from './behaviors/roborock.vacuum/smart/smart.js';
import { SMART_MODELS } from './constants/index.js';

export type BehaviorFactoryResult = BehaviorDeviceGeneric<DefaultEndpointCommands> | BehaviorDeviceGeneric<EndpointCommandsSmart>;

/**
 * Configure device behavior handler based on model capabilities.
 * Creates and initializes the appropriate command handler for the device model.
 * @param model - Device model identifier
 * @param duid - Device unique identifier
 * @param roborockService - Roborock service instance for device communication
 * @param cleanModeSettings - Custom cleaning mode settings
 * @param forceRunAtDefault - Force use of default behavior regardless of model
 * @param logger - Logger instance
 * @returns Configured behavior handler (Default or Smart)
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
