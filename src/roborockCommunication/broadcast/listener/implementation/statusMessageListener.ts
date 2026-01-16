import { NotifyMessageTypes } from '../../../../notifyMessageTypes.js';
import { DeviceNotifyCallback } from '../../../../types/index.js';
import { AbstractMessageListener, Protocol, ResponseMessage } from '../../../index.js';

export class StatusMessageListener implements AbstractMessageListener {
  private readonly duid: string;
  private readonly callback: DeviceNotifyCallback | undefined;
  private readonly shouldIgnoreProtocols = [Protocol.battery, Protocol.ping_response, Protocol.map_response, Protocol.rpc_response];

  constructor(duid: string, callback: DeviceNotifyCallback | undefined) {
    this.duid = duid;
    this.callback = callback;
  }

  public async onMessage(message: ResponseMessage): Promise<void> {
    if (this.shouldIgnoreProtocols.some((protocol) => message.isForProtocol(protocol))) {
      return;
    }

    if (this.callback) {
      this.callback(NotifyMessageTypes.CloudMessage, message);
    }
  }
}
