import { MessageContext, RequestMessage } from '../../models/index.js';
import { MessageBodyBuilder } from './messageBodyBuilder.js';

export class B01MessageBodyBuilder implements MessageBodyBuilder {
  buildPayload(request: RequestMessage, context: MessageContext): string {
    return JSON.stringify({
      dps: request.dps,
      t: request.timestamp,
    });
  }
}
