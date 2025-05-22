import { AnsiLogger } from 'node-ansi-logger';
import { DpsPayload } from '../../model/dps.js';
import { Protocol } from '../../model/protocol.js';
import { ResponseMessage } from '../../model/responseMessage.js';
import { AbstractMessageListener } from '../index.js';

export class SyncMessageListener implements AbstractMessageListener {
  private readonly pending = new Map<number, (response: ResponseMessage) => void>();
  logger: AnsiLogger;

  constructor(logger: AnsiLogger) {
    this.logger = logger;
  }

  public waitFor(messageId: number, resolve: (response: ResponseMessage) => void, reject: () => void) {
    this.pending.set(messageId, resolve);

    setTimeout(() => {
      this.pending.delete(messageId);
      reject();
    }, 10000);
  }

  public async onMessage(message: ResponseMessage): Promise<void> {
    if (message.contain(Protocol.rpc_response)) {
      const dps = <DpsPayload>message.get(Protocol.rpc_response);
      const messageId = dps.id;

      const responseHandler = this.pending.get(messageId);
      if (dps.result.length == 1 && dps.result[0] == 'ok') {
        return;
      }

      if (responseHandler) {
        responseHandler(dps.result);
      }
      this.pending.delete(messageId);
      return;
    }

    // map data
    if (message.contain(Protocol.map_response)) {
      const dps = <DpsPayload>message.get(Protocol.map_response);
      this.pending.delete(dps.id);
      return;
    }
  }
}
