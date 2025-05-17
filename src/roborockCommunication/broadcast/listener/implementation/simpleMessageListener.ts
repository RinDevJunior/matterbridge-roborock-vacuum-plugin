import { ResponseMessage } from '../../model/responseMessage.js';
import { AbstractMessageListener } from '../index.js';
import { Protocol } from '../../model/protocol.js';
import { AbstractMessageHandler } from '../abstractMessageHandler.js';

export class SimpleMessageListener implements AbstractMessageListener {
  private handler: AbstractMessageHandler | undefined;

  public registerListener(handler: AbstractMessageHandler): void {
    this.handler = handler;
  }

  public async onMessage(message: ResponseMessage): Promise<void> {
    if (!this.handler || message.contain(Protocol.rpc_response) || message.contain(Protocol.map_response)) {
      return;
    }

    if (message.contain(Protocol.status_update)) {
      await this.handler.onStatusChanged();
    }

    if (message.contain(Protocol.error)) {
      const value = <string>message.get(Protocol.error);
      await this.handler.onError(Number(value));
    }

    if (message.contain(Protocol.battery)) {
      const value = <string>message.get(Protocol.battery);
      await this.handler.onBatteryUpdate(Number(value));
    }

    if (message.contain(Protocol.additional_props)) {
      const value = <string>message.get(Protocol.additional_props);
      await this.handler.onAdditionalProps(Number(value));
    }
  }
}
