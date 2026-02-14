import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { Protocol, ResponseMessage } from '../../../models/index.js';
import { AbstractMessageListener } from '../abstractMessageListener.js';

export class MapResponseListener implements AbstractMessageListener {
  readonly name = 'MapResponseListener';

  constructor(
    public readonly duid: string,
    private readonly logger: AnsiLogger,
  ) {}

  public onMessage(message: ResponseMessage): void {
    if (message.isForProtocol(Protocol.map_response)) {
      this.logger.debug(`Ignoring map response message: ${debugStringify(message)}`);
    }
  }
}
