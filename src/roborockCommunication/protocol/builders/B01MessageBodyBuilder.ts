import { MessageContext, RequestMessage } from '../../models/index.js';
import { AbstractMessageBodyBuilder } from './abstractMessageBodyBuilder.js';

export class B01MessageBodyBuilder implements AbstractMessageBodyBuilder {
  buildPayload(request: RequestMessage, context: MessageContext): string {
    return JSON.stringify({
      dps: request.dps,
      t: request.timestamp,
    });
  }
}
