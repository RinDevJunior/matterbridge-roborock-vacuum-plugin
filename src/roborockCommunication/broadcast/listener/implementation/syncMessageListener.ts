import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { DpsPayload } from '../../model/dps.js';
import { Protocol } from '../../model/protocol.js';
import { ResponseMessage } from '../../model/responseMessage.js';
import { AbstractMessageListener } from '../index.js';
import { RequestMessage } from '../../model/requestMessage.js';

export class SyncMessageListener implements AbstractMessageListener {
  private readonly pending = new Map<number, (response: ResponseMessage) => void>();
  logger: AnsiLogger;

  constructor(logger: AnsiLogger) {
    this.logger = logger;
  }

  public waitFor(messageId: number, request: RequestMessage, resolve: (response: ResponseMessage) => void, reject: (error?: Error) => void): void {
    this.pending.set(messageId, resolve);

    setTimeout(() => {
      this.pending.delete(messageId);
      reject(new Error(`Message timeout for messageId: ${messageId}, request: ${debugStringify(request)}`));
    }, 10000);
  }

  public async onMessage(message: ResponseMessage): Promise<void> {
    if (message.contain(Protocol.rpc_response)) {
      const dps = message.get(Protocol.rpc_response) as DpsPayload;
      const messageId = dps.id;

      const responseHandler = this.pending.get(messageId);
      const result = dps.result as Record<string, unknown>;
      if (result && result.length == 1 && result[0] == 'ok') {
        return;
      }

      if (responseHandler) {
        responseHandler(dps.result as ResponseMessage);
      }
      this.pending.delete(messageId);
      return;
    }

    // map data
    if (message.contain(Protocol.map_response)) {
      const dps = message.get(Protocol.map_response) as DpsPayload;
      this.pending.delete(dps.id);
      return;
    }
  }
}
