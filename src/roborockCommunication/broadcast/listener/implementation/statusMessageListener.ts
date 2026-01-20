import { AnsiLogger } from 'matterbridge/logger';
import { NotifyMessageTypes } from '@/notifyMessageTypes.js';
import { DeviceNotifyCallback } from '@/types/index.js';
import { Protocol, ResponseMessage, AbstractMessageListener } from '../../index.js';

export class StatusMessageListener implements AbstractMessageListener {
  private readonly shouldIgnoreProtocols = [Protocol.battery, Protocol.ping_response, Protocol.map_response];

  constructor(
    private readonly duid: string,
    private readonly logger: AnsiLogger,
    private readonly callback: DeviceNotifyCallback | undefined,
  ) {}

  public async onMessage(message: ResponseMessage): Promise<void> {
    if (this.shouldIgnoreProtocols.some((protocol) => message.isForProtocol(protocol))) {
      return;
    }

    if (this.callback) {
      this.logger.debug(`StatusMessageListener invoking callback for device ${this.duid} with message: ${JSON.stringify(message)}`);
      this.callback(NotifyMessageTypes.CloudMessage, message);
    }
  }
}
