import { DpsPayload, MessageContext, RequestMessage } from '../../models/index.js';
import { MessageBodyBuilder } from './messageBodyBuilder.js';

export class V01MessageBodyBuilder implements MessageBodyBuilder {
  buildPayload(request: RequestMessage, context: MessageContext): string {
    const data: DpsPayload = {
      id: request.messageId,
      method: request.method ?? '',
      params: request.params,
      security: undefined,
      result: undefined,
    };

    if (request.secure) {
      data.security = {
        endpoint: context.getEndpoint(),
        nonce: context.getSerializeNonceAsHex(),
      };
    }

    const payload = {
      dps: {
        [request.protocol]: JSON.stringify(data),
      },
      t: request.timestamp,
    };

    return JSON.stringify(payload);
  }
}
