import { MessageContext } from '../broadcast/model/messageContext.js';
import { RequestMessage } from '../broadcast/model/requestMessage.js';
import { MessageBodyBuilder } from './messageBodyBuilder.js';

export class A01MessageBodyBuilder implements MessageBodyBuilder {
  buildPayload(request: RequestMessage, context: MessageContext): string {
    return JSON.stringify({
      dps: request.dps,
      t: request.timestamp,
    });
  }
}
