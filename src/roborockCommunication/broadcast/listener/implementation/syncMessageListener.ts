import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { MESSAGE_TIMEOUT_MS } from '@/constants/index.js';
import { DpsPayload, Protocol, RequestMessage, ResponseMessage, AbstractMessageListener } from '../../index.js';

export class SyncMessageListener implements AbstractMessageListener {
  private readonly pending = new Map<number, (response: ResponseMessage) => void>();
  private readonly acceptedProtocols: Protocol[] = [Protocol.general_request, Protocol.general_response, Protocol.rpc_response];
  constructor(private readonly logger: AnsiLogger) {}

  public waitFor(messageId: number, request: RequestMessage, resolve: (response: ResponseMessage) => void, reject: (error?: Error) => void): void {
    this.logger.debug(`Waiting for response to messageId: ${messageId}, method: ${request.method}`);
    this.pending.set(messageId, resolve);

    setTimeout(() => {
      this.pending.delete(messageId);
      reject(new Error(`Message timeout for messageId: ${messageId}, request: ${debugStringify(request)}`));
    }, MESSAGE_TIMEOUT_MS);
  }

  public async onMessage(message: ResponseMessage): Promise<void> {
    // Handle general_request
    // general_request (protocol 4 - device uses request protocol for responses),
    // general_response (protocol 5)
    // rpc_response (protocol 102)
    if (message.isForProtocols(this.acceptedProtocols)) {
      const protocolNum = message.header?.protocol;
      const protocolName = Object.entries(Protocol).find(([, v]) => v === protocolNum)?.[0] ?? protocolNum;
      this.logger.debug(`Processing response with protocol ${protocolName}`);

      // Data is always stored in key 102 (rpc_response), regardless of header protocol
      // This is because the deserializer parses all general_request/general_response messages
      // and stores them under the rpc_response key (102)
      let dps = message.get<DpsPayload>(Protocol.rpc_response);

      // Fallback: try other protocols if not found in 102
      if (!dps && message.isForProtocol(Protocol.general_request)) {
        dps = message.get<DpsPayload>(Protocol.general_request);
      }
      if (!dps && message.isForProtocol(Protocol.general_response)) {
        dps = message.get<DpsPayload>(Protocol.general_response);
      }

      if (!dps && message.isForProtocol(Protocol.rpc_response)) {
        dps = message.get<DpsPayload>(Protocol.rpc_response);
      }

      const statusProtocolNumbers = [Protocol.suction_power, Protocol.water_box_mode];
      if (message.isForProtocol(Protocol.rpc_response) && message.isForStatuses(statusProtocolNumbers)) {
        // skip message handling for status updates because they will be handled at statusMessageListener
        return;
      }

      if (!dps) {
        this.logger.warn(`Response missing DPS payload for protocol ${protocolName}`);
        this.logger.warn(`Full message: ${debugStringify(message)}`);
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
  }
}
