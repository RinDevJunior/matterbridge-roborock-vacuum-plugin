import { DpsPayload } from '../broadcast/model/dps.js';
import { MessageContext } from '../broadcast/model/messageContext.js';
import { Protocol } from '../broadcast/model/protocol.js';
import { RequestMessage } from '../broadcast/model/requestMessage.js';
import { MessageBodyBuilder } from './messageBodyBuilder.js';

export class L01MessageBodyBuilder implements MessageBodyBuilder {
  buildPayload(request: RequestMessage, context: MessageContext): string {
    let protocol = request.protocol;
    if (protocol == Protocol.general_request) {
      protocol = Protocol.rpc_request;
    }

    const data: DpsPayload = {
      id: request.messageId,
      method: request.method ?? '',
      params: request.params ?? [],
      security: undefined,
      result: undefined,
    };

    const payload = {
      dps: {
        [protocol]: JSON.stringify(data),
      },
      t: request.timestamp,
    };

    return JSON.stringify(payload);
  }
}
