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
    if (!this.handler || message.isForProtocol(Protocol.rpc_response) || message.isForProtocol(Protocol.map_response)) {
      return;
    }

    if (message.isForProtocol(Protocol.status_update) && this.handler.onStatusChanged) {
      await this.handler.onStatusChanged(message);
    }

    if (message.isForProtocol(Protocol.error) && this.handler.onError) {
      const value = message.get(Protocol.error) as string;
      await this.handler.onError(Number(value));
    }

    if (message.isForProtocol(Protocol.battery) && this.handler.onBatteryUpdate) {
      const value = message.get(Protocol.battery) as string;
      await this.handler.onBatteryUpdate(Number(value));
    }

    if (message.isForProtocol(Protocol.general_response) && this.handler.onBatteryUpdate) {
      const value = message.get(Protocol.battery) as string;
      await this.handler.onBatteryUpdate(Number(value));
    }

    if (message.isForProtocol(Protocol.additional_props) && this.handler.onAdditionalProps) {
      const value = message.get(Protocol.additional_props) as string;
      await this.handler.onAdditionalProps(Number(value));
    }
  }
}
