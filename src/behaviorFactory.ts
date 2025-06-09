import { AnsiLogger } from 'matterbridge/logger';
import { BehaviorDeviceGeneric } from './behaviors/BehaviorDeviceGeneric.js';
import RoborockService from './roborockService.js';
import { DefaultEndpointCommands, setDefaultCommandHandler } from './behaviors/roborock.vacuum/default/default.js';
import { DeviceModel } from './roborockCommunication/Zmodel/deviceModel.js';
import { CleanModeSettings } from './model/ExperimentalFeatureSetting.js';
import { EndpointCommandsSmart, setCommandHandlerSmart } from './behaviors/roborock.vacuum/smart/smart.js';

export type BehaviorFactoryResult = BehaviorDeviceGeneric<DefaultEndpointCommands> | BehaviorDeviceGeneric<EndpointCommandsSmart>;

export function configurateBehavior(
  model: string,
  duid: string,
  roborockService: RoborockService,
  cleanModeSettings: CleanModeSettings | undefined,
  logger: AnsiLogger,
): BehaviorFactoryResult {
  switch (model) {
    case DeviceModel.QREVO_EDGE_5V1: {
      const deviceHandler = new BehaviorDeviceGeneric<EndpointCommandsSmart>(logger);
      setCommandHandlerSmart(duid, deviceHandler, logger, roborockService, cleanModeSettings);
      return deviceHandler;
    }

    case DeviceModel.S7_MAXV:
    case DeviceModel.S8_PRO_ULTRA:
    case DeviceModel.S6_PURE:
    default: {
      const deviceHandler = new BehaviorDeviceGeneric<DefaultEndpointCommands>(logger);
      setDefaultCommandHandler(duid, deviceHandler, logger, roborockService, cleanModeSettings);
      return deviceHandler;
    }
  }
}
