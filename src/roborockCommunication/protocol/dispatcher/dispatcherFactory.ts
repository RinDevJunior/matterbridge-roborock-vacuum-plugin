import { NewProtocolVersion, ProtocolVersion } from '../../enums/index.js';
import { calculateProtocol } from './protocolCalculator.js';
import { AbstractMessageDispatcher } from './abstractMessageDispatcher.js';
import { Q10MessageDispatcher } from './Q10MessageDispatcher.js';
import { Q7MessageDispatcher } from './Q7MessageDispatcher.js';
import { V01MessageDispatcher } from './V01MessageDispatcher.js';
import { AnsiLogger } from 'matterbridge/logger';
import { Client } from '../../routing/client.js';
import { DeviceModel } from '../../models/deviceModel.js';

export class MessageDispatcherFactory {
  private readonly builders: Record<NewProtocolVersion, AbstractMessageDispatcher>;

  constructor(
    client: Client,
    private readonly logger: AnsiLogger,
  ) {
    this.builders = {
      [NewProtocolVersion.V1]: new V01MessageDispatcher(logger, client),
      [NewProtocolVersion.Q7]: new Q7MessageDispatcher(logger, client),
      [NewProtocolVersion.Q10]: new Q10MessageDispatcher(logger, client),
    };
  }

  public getMessageDispatcher(version: ProtocolVersion | string, modelCode: DeviceModel): AbstractMessageDispatcher {
    if (version === undefined) {
      this.logger.error('Unable to send message: no version included');
    }

    const robotProtocol = calculateProtocol(version, modelCode);
    return this.builders[robotProtocol];
  }
}
