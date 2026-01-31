import { Protocol, ResponseMessage } from '../../../models/index.js';
import { AbstractMessageHandler } from '../../handlers/abstractMessageHandler.js';
import { AbstractMessageListener } from '../abstractMessageListener.js';
import { AnsiLogger } from 'matterbridge/logger';

export class SimpleMessageListener implements AbstractMessageListener {
  private readonly ignoredProtocols: Protocol[] = [Protocol.rpc_response, Protocol.map_response];
  private handler: AbstractMessageHandler | undefined;

  constructor(private readonly logger: AnsiLogger) {}

  public registerHandler(handler: AbstractMessageHandler): void {
    this.handler = handler;
  }

  public async onMessage(message: ResponseMessage): Promise<void> {
    if (!this.handler || message.isForProtocols(this.ignoredProtocols)) {
      this.logger.debug(`SimpleMessageListener: Ignoring message for protocols ${this.ignoredProtocols.map((p) => Protocol[p]).join(', ')}`);
      return;
    }

    if (message.isForProtocol(Protocol.status_update) && this.handler.onStatusChanged) {
      this.logger.debug(`SimpleMessageListener: Handling status update message for duid ${message.duid}, message: ${JSON.stringify(message)}`);
      await this.handler.onStatusChanged(message);
    }

    if (message.isForProtocol(Protocol.error) && this.handler.onError) {
      const value = message.get(Protocol.error) as string;
      this.logger.debug(`SimpleMessageListener: Handling error message with value ${value}`);
      await this.handler.onError(Number(value));
    }

    if (message.isForProtocol(Protocol.battery) && this.handler.onBatteryUpdate) {
      const value = message.get(Protocol.battery) as string;
      this.logger.debug(`SimpleMessageListener: Handling battery update message with value ${value}`);
      await this.handler.onBatteryUpdate(Number(value));
    }

    if (message.isForProtocol(Protocol.general_response) && this.handler.onBatteryUpdate) {
      const value = message.get(Protocol.battery) as string;
      this.logger.debug(`SimpleMessageListener: Handling general response message with battery value ${value}`);
      await this.handler.onBatteryUpdate(Number(value));
    }

    if (message.isForProtocol(Protocol.additional_props) && this.handler.onAdditionalProps) {
      const value = message.get(Protocol.additional_props) as string;
      this.logger.debug(`SimpleMessageListener: Handling additional props message with value ${value}`);
      await this.handler.onAdditionalProps(Number(value));
    }
  }
}
