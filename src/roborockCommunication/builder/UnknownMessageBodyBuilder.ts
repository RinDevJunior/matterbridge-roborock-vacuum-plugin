import { MessageContext } from '../broadcast/model/messageContext.js';
import { RequestMessage } from '../broadcast/model/requestMessage.js';
import { MessageBodyBuilder } from './messageBodyBuilder.js';

export class UnknownMessageBodyBuilder implements MessageBodyBuilder {
  buildPayload(request: RequestMessage, context: MessageContext): string {
    if (!request.body) {
      throw new Error('Cannot build payload for unknown protocol without body');
    }

    const payload = JSON.parse(request.body);
    payload.t = request.timestamp;
    return JSON.stringify(payload);
  }
}
