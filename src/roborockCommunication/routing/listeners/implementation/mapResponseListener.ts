import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { Protocol, ResponseMessage } from '../../../models/index.js';
import { AbstractMessageListener } from '../abstractMessageListener.js';

export class MapResponseListener implements AbstractMessageListener {
  constructor(
    private readonly duid: string,
    private readonly logger: AnsiLogger,
  ) {}

  public async onMessage(message: ResponseMessage): Promise<void> {
    if (message.isForProtocol(Protocol.map_response)) {
      this.logger.debug(`Ingoring map response message: ${debugStringify(message)}`);
    }
  }
}
