import { NewProtocolVersion, ProtocolVersion } from '../../enums/index.js';
import { AbstractMessageDispatcher } from './abstractMessageDispatcher.js';
import { Q10MessageDispatcher } from './Q10MessageDispatcher.js';
import { Q7MessageDispatcher } from './Q7MessageDispatcher.js';
import { V10MessageDispatcher } from './V10MessageDispatcher.js';
import { AnsiLogger } from 'matterbridge/logger';
import { DeviceModel } from '../../models/deviceModel.js';
import { ClientRouter } from '../../routing/clientRouter.js';

export class MessageDispatcherFactory {
  private readonly builders: Record<NewProtocolVersion, AbstractMessageDispatcher>;

  constructor(
    clientRouter: ClientRouter,
    private readonly logger: AnsiLogger,
  ) {
    this.builders = {
      [NewProtocolVersion.V1]: new V10MessageDispatcher(logger, clientRouter),
      [NewProtocolVersion.B01_Q7]: new Q7MessageDispatcher(logger, clientRouter),
      [NewProtocolVersion.B01_Q10]: new Q10MessageDispatcher(logger, clientRouter),
    };
  }

  public getMessageDispatcher(version: ProtocolVersion | string, modelCode: DeviceModel): AbstractMessageDispatcher {
    if (version === undefined) {
      this.logger.error('Unable to send message: no version included');
    }

    const robotProtocol = calculateProtocol(version, modelCode);
    const dispatcher = this.builders[robotProtocol];
    this.logger.debug(
      `Using ${dispatcher.dispatcherName} for device model ${modelCode} with protocol version ${version}`,
    );
    return dispatcher;
  }
}

function calculateProtocol(protocol: ProtocolVersion | string, model: DeviceModel): NewProtocolVersion {
  switch (protocol) {
    case ProtocolVersion.V1:
    case ProtocolVersion.L01:
      return NewProtocolVersion.V1;

    case ProtocolVersion.B01: {
      const shortModelCode = model?.split('.').at(-1);
      if (shortModelCode === undefined) {
        throw new Error('Missing robot model, required for B01 protocol');
      }

      if (shortModelCode.startsWith('ss')) {
        return NewProtocolVersion.B01_Q10;
      } else if (shortModelCode.startsWith('sc')) {
        return NewProtocolVersion.B01_Q7;
      } else {
        // throw new Error('Unsupported robot model: ' + model + ', for B01 protocol');
        throw new Error(`Unsupported robot model: ${model}, protocol: ${protocol}, for B01 protocol`);
      }
    }

    default:
      throw new Error('Unsupported protocol version: ' + protocol);
  }
}
