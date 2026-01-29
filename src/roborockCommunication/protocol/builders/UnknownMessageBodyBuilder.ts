import { MessageContext, RequestMessage } from '../../models/index.js';
import { AbstractMessageBodyBuilder } from './abstractMessageBodyBuilder.js';

export class UnknownMessageBodyBuilder implements AbstractMessageBodyBuilder {
  buildPayload(request: RequestMessage, context: MessageContext): string {
    if (!request.body) {
      throw new Error('Cannot build payload for unknown protocol without body');
    }

    const payload = JSON.parse(request.body);
    payload.t = request.timestamp;
    return JSON.stringify(payload);
  }
}
