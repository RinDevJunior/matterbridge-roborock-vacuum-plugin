import { AnsiLogger } from 'matterbridge/logger';
import { BehaviorDeviceGeneric } from './behaviors/BehaviorDeviceGeneric.js';
import { EndpointCommandsA187, setCommandHandlerA187 } from './behaviors/roborock.vacuum/QREVO_EDGE_5V1/a187.js';
import RoborockService from './roborockService.js';
import { DefaultEndpointCommands, setDefaultCommandHandler } from './behaviors/roborock.vacuum/default/default.js';
import { DeviceModel } from './roborockCommunication/Zmodel/deviceModel.js';

export type BehaviorFactoryResult = BehaviorDeviceGeneric<DefaultEndpointCommands> | BehaviorDeviceGeneric<EndpointCommandsA187>;

export function configurateBehavior(model: string, duid: string, roborockService: RoborockService, logger: AnsiLogger): BehaviorFactoryResult {
  switch (model) {
    case DeviceModel.QREVO_EDGE_5V1: {
      const deviceHandler = new BehaviorDeviceGeneric<EndpointCommandsA187>(logger);
      setCommandHandlerA187(duid, deviceHandler, logger, roborockService);
      return deviceHandler;
    }

    default: {
      const deviceHandler = new BehaviorDeviceGeneric<DefaultEndpointCommands>(logger);
      setDefaultCommandHandler(duid, deviceHandler, logger, roborockService);
      return deviceHandler;
    }
  }
}
