import { ResponseMessage, Protocol, AbstractMessageListener, AbstractMessageHandler } from '../../index.js';

export class SimpleMessageListener implements AbstractMessageListener {
  private readonly ignoredProtocols: Protocol[] = [Protocol.rpc_response, Protocol.map_response];
  private handler: AbstractMessageHandler | undefined;

  public registerListener(handler: AbstractMessageHandler): void {
    this.handler = handler;
  }

  public async onMessage(message: ResponseMessage): Promise<void> {
    if (!this.handler || message.isForProtocols(this.ignoredProtocols)) {
      return;
    }

    if (message.isForProtocol(Protocol.status_update) && this.handler.onStatusChanged) {
      await this.handler.onStatusChanged(message);
    }

    if (message.isForProtocol(Protocol.error) && this.handler.onError) {
      const value = message.get<number>(Protocol.error);
      await this.handler.onError(Number(value));
    }

    if (message.isForProtocol(Protocol.battery) && this.handler.onBatteryUpdate) {
      const value = message.get<number>(Protocol.battery);
      await this.handler.onBatteryUpdate(Number(value));
    }

    if (message.isForProtocol(Protocol.general_response) && this.handler.onBatteryUpdate) {
      const value = message.get<number>(Protocol.battery);
      await this.handler.onBatteryUpdate(Number(value));
    }

    if (message.isForProtocol(Protocol.additional_props) && this.handler.onAdditionalProps) {
      const value = message.get<number>(Protocol.additional_props);
      await this.handler.onAdditionalProps(Number(value));
    }
  }
}
