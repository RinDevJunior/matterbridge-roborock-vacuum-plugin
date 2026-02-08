import { AnsiLogger } from 'matterbridge/logger';
import { AbstractMessageListener } from '../abstractMessageListener.js';
import { Protocol, ResponseMessage } from '../../../models/index.js';

export class SyncMessageListener implements AbstractMessageListener {
  readonly name = 'SyncMessageListener';

  private readonly acceptedProtocols: Protocol[] = [Protocol.general_request, Protocol.general_response, Protocol.rpc_response];

  constructor(
    public readonly duid: string,
    private readonly logger: AnsiLogger,
  ) {}

  public onMessage(message: ResponseMessage): void {
    // Handle general_request
    // general_request (protocol 4 - device uses request protocol for responses),
    // general_response (protocol 5)
    // rpc_response (protocol 102)
    // if (message.isForProtocols(this.acceptedProtocols)) {
    //   const protocolNum = message.header?.protocol;
    //   const protocolName = Object.entries(Protocol).find(([, v]) => v === protocolNum)?.[0] ?? protocolNum;
    //   this.logger.debug(`Processing response with protocol ${protocolName}`);
    //   // Data is always stored in key 102 (rpc_response), regardless of header protocol
    //   // This is because the deserializer parses all general_request/general_response messages
    //   // and stores them under the rpc_response key (102)
    //   let dps: DpsPayload | undefined = message.get(Protocol.rpc_response) as DpsPayload;
    //   // Fallback: try other protocols if not found in 102
    //   if (!dps && message.isForProtocol(Protocol.general_request)) {
    //     dps = message.get(Protocol.general_request) as DpsPayload;
    //   }
    //   if (!dps && message.isForProtocol(Protocol.general_response)) {
    //     dps = message.get(Protocol.general_response) as DpsPayload;
    //   }
    //   if (!dps && message.isForProtocol(Protocol.rpc_response)) {
    //     dps = message.get(Protocol.rpc_response) as DpsPayload;
    //   }
    //   const statusProtocolNumbers = [Protocol.suction_power, Protocol.water_box_mode, Protocol.status_update];
    //   if (message.isForProtocol(Protocol.rpc_response) && statusProtocolNumbers.some((p) => message.isForStatus(p))) {
    //     // skip message handling for status updates because they will be handled at statusMessageListener
    //     return;
    //   }
    //   if (!dps) {
    //     this.logger.warn(`Response missing DPS payload for protocol ${protocolName}`);
    //     this.logger.warn(`Full message: ${debugStringify(message)}`);
    //     return;
    //   }
    //   const messageId = dps.id;
    //   const resolved = this.tracker.tryResolve(messageId, dps.result as ResponseMessage);
    //   if (!resolved) {
    //     this.logger.warn(`No handler found for messageId: ${messageId}, message: ${debugStringify(message)}`);
    //   }
    //   return;
    // }
  }
}
