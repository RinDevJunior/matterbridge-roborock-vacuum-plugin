import { AnsiLogger } from 'matterbridge/logger';
import { BehaviorDeviceGeneric } from './behaviors/BehaviorDeviceGeneric.js';
import { EndpointCommandsA187, setCommandHandlerA187 } from './behaviors/roborock.vacuum/QREVO_EDGE_5V1/a187.js';
import RoborockService from './roborockService.js';
import { DefaultEndpointCommands, setDefaultCommandHandler } from './behaviors/roborock.vacuum/default/default.js';
import { DeviceModel } from './roborockCommunication/Zmodel/deviceModel.js';
import { EndpointCommandsA27, setCommandHandlerA27 } from './behaviors/roborock.vacuum/S7_MAXV/a27.js';
import { CleanModeSettings } from './model/CleanModeSettings.js';

export type BehaviorFactoryResult = BehaviorDeviceGeneric<DefaultEndpointCommands> | BehaviorDeviceGeneric<EndpointCommandsA187>;

export function configurateBehavior(
  model: string,
  duid: string,
  roborockService: RoborockService,
  cleanModeSettings: CleanModeSettings | undefined,
  logger: AnsiLogger,
): BehaviorFactoryResult {
  switch (model) {
    case DeviceModel.QREVO_EDGE_5V1: {
      const deviceHandler = new BehaviorDeviceGeneric<EndpointCommandsA187>(logger);
      setCommandHandlerA187(duid, deviceHandler, logger, roborockService, cleanModeSettings);
      return deviceHandler;
    }

    case DeviceModel.S7_MAXV: {
      const deviceHandler = new BehaviorDeviceGeneric<EndpointCommandsA27>(logger);
      setCommandHandlerA27(duid, deviceHandler, logger, roborockService);
      return deviceHandler;
    }

    default: {
      const deviceHandler = new BehaviorDeviceGeneric<DefaultEndpointCommands>(logger);
      setDefaultCommandHandler(duid, deviceHandler, logger, roborockService);
      return deviceHandler;
    }
  }
}
