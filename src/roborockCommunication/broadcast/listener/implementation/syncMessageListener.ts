import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { DpsPayload } from '../../model/dps.js';
import { Protocol } from '../../model/protocol.js';
import { ResponseMessage } from '../../model/responseMessage.js';
import { AbstractMessageListener } from '../index.js';
import { RequestMessage } from '../../model/requestMessage.js';
import { MESSAGE_TIMEOUT_MS } from '../../../../constants/index.js';

export class SyncMessageListener implements AbstractMessageListener {
  private readonly pending = new Map<number, (response: ResponseMessage) => void>();
  logger: AnsiLogger;

  constructor(logger: AnsiLogger) {
    this.logger = logger;
  }

  public waitFor(messageId: number, request: RequestMessage, resolve: (response: ResponseMessage) => void, reject: (error?: Error) => void): void {
    this.logger.debug(`Waiting for response to messageId: ${messageId}, method: ${request.method}`);
    this.pending.set(messageId, resolve);

    setTimeout(() => {
      this.pending.delete(messageId);
      reject(new Error(`Message timeout for messageId: ${messageId}, request: ${debugStringify(request)}`));
    }, MESSAGE_TIMEOUT_MS);
  }

  public async onMessage(message: ResponseMessage): Promise<void> {
    // Handle general_request (protocol 4 - device uses request protocol for responses), general_response (protocol 5) and rpc_response (protocol 102)
    if (message.isForProtocol(Protocol.general_request) || message.isForProtocol(Protocol.general_response) || message.isForProtocol(Protocol.rpc_response)) {
      this.logger.debug(`Processing response with protocol ${message.header?.protocol}`);

      // Data is always stored in key 102 (rpc_response), regardless of header protocol
      // This is because the deserializer parses all general_request/general_response messages
      // and stores them under the rpc_response key (102)
      let dps: DpsPayload | undefined = message.get(Protocol.rpc_response) as DpsPayload;

      // Fallback: try other protocols if not found in 102
      if (!dps && message.isForProtocol(Protocol.general_request)) {
        dps = message.get(Protocol.general_request) as DpsPayload;
      }
      if (!dps && message.isForProtocol(Protocol.general_response)) {
        dps = message.get(Protocol.general_response) as DpsPayload;
      }

      if (!dps) {
        this.logger.warn(`Response missing DPS payload for protocol ${message.header?.protocol}`);
        return;
      }

      const messageId = dps.id;
      const responseHandler = this.pending.get(messageId);
      if (responseHandler) {
        this.logger.debug(`Resolved messageId: ${messageId}`);
        responseHandler(dps.result as ResponseMessage);
      } else {
        this.logger.warn(`No handler found for messageId: ${messageId}`);
      }
      this.pending.delete(messageId);
      return;
    }

    // map data
    if (message.isForProtocol(Protocol.map_response)) {
      const dps = message.get(Protocol.map_response) as DpsPayload;
      this.pending.delete(dps.id);
      return;
    }
  }
}
